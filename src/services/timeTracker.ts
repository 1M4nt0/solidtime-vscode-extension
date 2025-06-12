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

  constructor({startedAt, endedAt, remoteId}: {startedAt: Date; endedAt?: Date; remoteId?: string}) {
    this._startedAt = startedAt
    this._endedAt = endedAt
    this._remoteId = remoteId
  }

  get startedAt(): Date {
    return this._startedAt
  }

  get endedAt(): Date | undefined {
    return this._endedAt
  }

  get remoteId(): string | undefined {
    return this._remoteId
  }

  copyWith({startedAt, endedAt, remoteId}: {startedAt?: Date; endedAt?: Date; remoteId?: string}): TimeSlice {
    return new TimeSlice({
      startedAt: startedAt ?? this._startedAt,
      endedAt: endedAt ?? this._endedAt,
      remoteId: remoteId ?? this._remoteId,
    })
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
      if (!this.currentSlice) {
        this._beginSlice()
      }
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

  private async _getLastEntryInMaxTimeSpan(): Promise<TimeEntry | null> {
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
      this._reset()
      await this._updateLastEntry()
      this._beginSlice()
      this._startBeat()
      this._startIdleWatcher()
    } catch (error) {
      Logger().error(`start error: ${error}`)
    }
  }

  /**
   * Resets the time tracker state.
   * Clears the current slice and updates the last activity timestamp.
   */
  private _reset(): void {
    Logger().debug(`reset: ${this.projectId}`)
    this.currentSlice = null
    this.lastActivity = Date.now()
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
  private _beginSlice(): void {
    Logger().debug(`beginSlice: ${this.projectId}`)

    if (this.currentSlice) {
      // If current slice already exists keep it
      return
    }

    // If no last entry exists, create a new slice
    this._setCurrentSlice(new TimeSlice({startedAt: new Date()}))
  }

  /**
   * Searches for the last time entry within the maximum time span.
   * If a last entry exists, it creates a new time slice based on that entry
   * and sets it as the current slice with the remote ID for synchronization.
   * Updates the spent time notification with the current total time.
   */
  private async _updateLastEntry(): Promise<void> {
    Logger().debug(`updateLastEntry: ${this.projectId}`)
    const lastEntry = await this._getLastEntryInMaxTimeSpan()
    if (!lastEntry) {
      return
    }

    // If last entry exists, use it as the current slice
    const timeSlice = new TimeSlice({
      startedAt: DateUtils.parseUTCtoZonedTime(lastEntry.start),
      remoteId: lastEntry.id,
    })
    this._setCurrentSlice(timeSlice)
  }

  private _setCurrentSlice(timeSlice: TimeSlice | null): void {
    this.currentSlice = timeSlice
    this.spentTimeNotification.update(this._getTotalTimeSpent())
  }

  /**
   * Ends the current active time slice.
   * Sets the end time for the current slice and adds it to the buffer.
   * The current slice is then reset to null.
   */
  private _endSlice(): void {
    Logger().debug(`endSlice: ${this.projectId}`)
    if (!this.currentSlice) return
    const timeSlice = this.currentSlice.copyWith({endedAt: new Date()})
    this._setCurrentSlice(timeSlice)
  }

  /**
   * Calculates the total time spent on the current time slice in milliseconds.
   * @returns The total time spent in milliseconds. Returns 0 if no current slice exists.
   *          For active slices (no end time), returns time from start to now.
   *          For completed slices, returns time between start and end.
   */
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
      if (!this.currentSlice) {
        return
      }

      this._endSlice()

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
        this._setCurrentSlice(this.currentSlice.copyWith({remoteId: res.data.id}))
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
