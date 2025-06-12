import {createTimeEntry} from '../api/organizations/[orgId]/time-entries/post.index'
import {updateTimeEntry} from '../api/organizations/[orgId]/time-entries/[entryId]'
import {Logger} from './injection'
import {inject, injectable} from 'inversify'
import {getOrganizationTimeEntries} from '../api/organizations/[orgId]/time-entries'
import {DateUtils} from '../functions/date'
import type {TimeEntry} from '../types/entities'
import type {SpendTimeNotification} from './statusBar'

const DEFAULT_DESCRIPTION = 'Coding time from VSCode'

class TimeSlice {
  private readonly _startedAt: Date
  private _endedAt?: Date
  private _remoteId?: string

  constructor(startedAt: Date) {
    this._startedAt = startedAt
  }

  get startedAt(): Date {
    return this._startedAt
  }

  get endedAt(): Date | undefined {
    return this._endedAt
  }

  set end(endedAt: Date) {
    this._endedAt = endedAt
  }

  set remoteId(id: string) {
    this._remoteId = id
  }

  get remoteId(): string | undefined {
    return this._remoteId
  }
}

const TimeTrackerServiceSymbol = Symbol.for('TimeTrackerService')
const TimeTrackerServiceConfigSymbol = Symbol.for('TimeTrackerServiceConfig')
const SpendTimeNotificationSymbol = Symbol.for('SpendTimeNotification')

type TimeTrackerServiceConfig = {
  orgId: string
  memberId: string
  projectId: string
  idleThresholdMs: number
  maxTimeSpanForOpenSliceMs: number
  beatTimeoutMs: number
}

/**
 * Service responsible for tracking time, managing time slices, and syncing with a remote API.
 * It handles user activity, idle detection, and periodic synchronization of time entries.
 */
@injectable()
class TimeTrackerService {
  private readonly spentTimeNotification: SpendTimeNotification
  private readonly orgId: string
  private readonly projectId: string
  private readonly memberId: string
  private readonly idleThresholdMs: number
  private readonly maxTimeSpanForOpenSliceMs: number
  private readonly beatTimeoutMs: number
  private currentSlice: TimeSlice | null = null
  private lastActivity: number = Date.now()
  private beatInterval: NodeJS.Timeout | null = null
  private idleInterval: NodeJS.Timeout | null = null

  /**
   * Creates an instance of TimeTrackerService.
   * @param orgId - The organization ID.
   * @param memberId - The member ID.
   * @param opts - Configuration options for the tracker.
   */
  constructor(
    @inject(TimeTrackerServiceConfigSymbol) config: TimeTrackerServiceConfig,
    @inject(SpendTimeNotificationSymbol) spentTimeNotification: SpendTimeNotification
  ) {
    this.orgId = config.orgId
    this.memberId = config.memberId
    this.projectId = config.projectId
    this.idleThresholdMs = config.idleThresholdMs
    this.maxTimeSpanForOpenSliceMs = config.maxTimeSpanForOpenSliceMs
    this.beatTimeoutMs = config.beatTimeoutMs
    this.spentTimeNotification = spentTimeNotification
  }

  public isActive(): boolean {
    return !!this.beatInterval
  }

  /**
   * Call this method when user activity is detected.
   * It updates the last activity timestamp and starts a new time slice if none is active.
   */
  onActivity(): void {
    try {
      if (!this.isActive()) {
        Logger().debug(`TimeTracker not started for workspace: ${this.projectId}`)
        return
      }
      Logger().debug(`onActivity: ${this.projectId}`)
      this.lastActivity = Date.now()
      if (!this.currentSlice) this._beginSlice()
    } catch (error) {
      Logger().error(`onActivity error: ${error}`)
    }
  }

  private _isAValidLastEntryForProject(entry: TimeEntry): boolean {
    const now = new Date()
    if (entry.end == null) {
      return true
    }
    return DateUtils.parseUTCtoZonedTime(entry.end) > DateUtils.subMilliseconds(now, this.maxTimeSpanForOpenSliceMs)
  }

  async getLastEntryInMaxTimeSpan(): Promise<TimeEntry | null> {
    const now = new Date()

    const lastEntries = await getOrganizationTimeEntries({
      orgId: this.orgId,
      start: DateUtils.startOfDay(now),
      end: DateUtils.endOfDay(now),
    })

    const orderedEntries = lastEntries.data.sort((a, b) => {
      return new Date(a.start).getTime() - new Date(b.start).getTime()
    })

    const lastEntry = orderedEntries[orderedEntries.length - 1]

    if (lastEntry && lastEntry.project_id !== this.projectId) {
      // If the last entry is not for the current project, return null
      return null
    }

    const projectEntries = lastEntries.data.filter((entry) => entry.project_id === this.projectId)

    if (projectEntries.length > 0) {
      Logger().debug(`found last entry: ${lastEntry.id} ${lastEntry.end} ${lastEntry.project_id}`)
      if (this._isAValidLastEntryForProject(lastEntry)) {
        Logger().debug(`lastEntry is valid.`)
        return lastEntry
      }
      Logger().debug(`last entry is not valid or too old, skipping`)
      return null
    }
    return null
  }

  /**
   * Starts the time tracking service.
   * This initiates the periodic beat for syncing data.
   */
  async start(): Promise<void> {
    try {
      if (this.isActive()) {
        Logger().debug(`TimeTracker already started for workspace: ${this.projectId}`)
        return
      }
      Logger().debug(`TimeTracker started for workspace: ${this.projectId}`)
      this._beginSlice()
      this._startBeat()
      this._startIdleWatcher()
    } catch (error) {
      Logger().error(`start error: ${error}`)
    }
  }

  /**
   * Starts the periodic beat interval that synchronizes time tracking data.
   */
  private _startBeat(): void {
    this.beatInterval = setInterval(() => {
      this._beat().catch((error) => {
        Logger().error(`Beat failed: ${error}`)
      })
      Logger().debug(`beat: ${this.projectId}`)
    }, this.beatTimeoutMs)
  }

  /**
   * Stops the time tracking service.
   * This clears the periodic beat interval.
   */
  stop(): void {
    if (!this.isActive()) {
      Logger().debug(`TimeTracker already stopped for workspace: ${this.projectId}`)
      return
    }
    try {
      Logger().debug(`TimeTracker stopping for workspace: ${this.projectId}`)
      this._beat()
      this._cleanIntervals()
    } catch (error) {
      Logger().error(`stop error: ${error}`)
    }
  }

  /**
   * Starts the idle watcher interval.
   * If the user is inactive for longer than the configured idle threshold,
   * the current slice is automatically ended.
   */
  private _startIdleWatcher(): void {
    this.idleInterval = setInterval(() => {
      if (this.currentSlice && Date.now() - this.lastActivity >= this.idleThresholdMs) {
        this.stop()
      }
    }, this.idleThresholdMs / 2)
  }

  /**
   * Begins a new time slice.
   * Sets the current slice with the current workspace and start time.
   */
  private async _beginSlice(): Promise<void> {
    Logger().debug(`beginSlice: ${this.projectId}`)

    if (this.currentSlice) {
      // If current slice already exists keep it
      return
    }

    const lastEntry = await this.getLastEntryInMaxTimeSpan()
    if (lastEntry) {
      // If last entry exists, use it as the current slice
      this.currentSlice = new TimeSlice(DateUtils.parseUTCtoZonedTime(lastEntry.start))
      this.currentSlice.remoteId = lastEntry.id
      this.spentTimeNotification.update(this._getTotalTimeSpent())
      return
    }

    // If no last entry exists, create a new slice
    this.currentSlice = new TimeSlice(new Date())
  }

  /**
   * Ends the current active time slice.
   * Sets the end time for the current slice and adds it to the buffer.
   * The current slice is then reset to null.
   */
  private _endSlice(): void {
    Logger().debug(`endSlice: ${this.projectId}`)
    if (!this.currentSlice) return
    this.currentSlice.end = new Date()
    this.spentTimeNotification.update(this._getTotalTimeSpent())
  }

  private _getTotalTimeSpent(): number {
    if (!this.currentSlice) {
      return 0
    }
    if (!this.currentSlice.endedAt) {
      // If the slice is not ended, return the time spent since the slice started
      return DateUtils.differenceInMilliseconds(new Date(), this.currentSlice.startedAt)
    }
    // If the slice is ended, calculate the time spent between the start and end dates
    return DateUtils.differenceInMilliseconds(this.currentSlice.endedAt, this.currentSlice.startedAt)
  }

  /**
   * The main beat function that runs periodically.
   * It flushes any buffered slices, and then syncs the current active slice
   * or the last closed slice with the remote API.
   * It creates a new time entry if one doesn't exist for the current session,
   * or updates an existing one.
   */
  private async _beat(): Promise<void> {
    try {
      this._endSlice()

      if (!this.currentSlice) {
        return
      }

      // An actual slice is running - sync it with the API
      if (this.currentSlice.remoteId) {
        Logger().debug(`updateTimeEntry for project: ${this.projectId} from ${new Date(this.currentSlice.startedAt)}`)
        await updateTimeEntry(
          {
            orgId: this.orgId,
            entryId: this.currentSlice.remoteId,
          },
          {
            end: this.currentSlice.endedAt,
            description: DEFAULT_DESCRIPTION,
          }
        )
      } else {
        // Active slice, but no remote ID. Create a new remote entry.
        Logger().debug(`createTimeEntry for project: ${this.projectId} from ${new Date(this.currentSlice.startedAt)}`)
        const res = await createTimeEntry(
          {
            orgId: this.orgId,
          },
          {
            member_id: this.memberId,
            project_id: this.projectId,
            start: new Date(this.currentSlice.startedAt),
            end: new Date(this.currentSlice.endedAt!),
            billable: true,
            description: DEFAULT_DESCRIPTION,
          }
        )
        this.currentSlice.remoteId = res.data.id
      }
    } catch (error: unknown) {
      Logger().error(
        `beat error for project ${this.projectId}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  private _cleanIntervals(): void {
    if (this.beatInterval) {
      clearInterval(this.beatInterval)
      this.beatInterval = null
    }
    if (this.idleInterval) {
      clearInterval(this.idleInterval)
      this.idleInterval = null
    }
  }

  public dispose(): void {
    this.stop()
    this.spentTimeNotification.dispose()
  }
}

export type {TimeSlice, TimeTrackerServiceConfig}
export {TimeTrackerService, TimeTrackerServiceSymbol, TimeTrackerServiceConfigSymbol, SpendTimeNotificationSymbol}
