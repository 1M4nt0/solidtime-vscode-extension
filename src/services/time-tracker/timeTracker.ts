import {createTimeEntry} from '../../api/organizations/[orgId]/time-entries/post.index'
import {updateTimeEntry} from '../../api/organizations/[orgId]/time-entries/[entryId]'
import {Logger} from '../injection'
import {inject, injectable} from 'inversify'
import {getOrganizationTimeEntries} from '../../api/organizations/[orgId]/time-entries'
import {DateUtils} from '../../functions/date'
import type {TimeEntry} from '../../types/entities'
import type {SpendTimeNotification} from '../statusBar'
import {TimeSlice} from './timeSlice'
import type {TimeTrackerEvents} from './events'
import EventEmitter from 'events'

const DEFAULT_DESCRIPTION = 'Coding time from VSCode'

const TimeTrackerServiceSymbol = Symbol.for('TimeTrackerService')
const TimeTrackerServiceConfigSymbol = Symbol.for('TimeTrackerServiceConfig')
const SpendTimeNotificationSymbol = Symbol.for('SpendTimeNotification')

type TimeTrackerServiceConfig = {
  orgId: string
  memberId: string
  projectId: string
  maxTimeSpanForOpenSliceMs: number
  beatTimeoutMs: number
}

/**
 * Service responsible for tracking time, managing time slices, and syncing with a remote API.
 * It handles user activity, idle detection, and periodic synchronization of time entries.
 * This class emits events related to its lifecycle and activity.
 */
@injectable()
class TimeTrackerService extends EventEmitter<TimeTrackerEvents> {
  private readonly spentTimeNotification: SpendTimeNotification
  private readonly orgId: string
  private readonly projectId: string
  private readonly memberId: string
  private readonly maxTimeSpanForOpenSliceMs: number
  private readonly beatTimeoutMs: number
  private currentSlice: TimeSlice | null = null
  private lastActivity: number = Date.now()
  private beatInterval: NodeJS.Timeout | null = null
  private isPaused: boolean = false

  /**
   * Creates an instance of TimeTrackerService.
   * @param config - The configuration for the time tracker service.
   * @param spentTimeNotification - The notification service for displaying spent time.
   */
  constructor(
    @inject(TimeTrackerServiceConfigSymbol) config: TimeTrackerServiceConfig,
    @inject(SpendTimeNotificationSymbol) spentTimeNotification: SpendTimeNotification
  ) {
    super()
    this.orgId = config.orgId
    this.memberId = config.memberId
    this.projectId = config.projectId
    this.maxTimeSpanForOpenSliceMs = config.maxTimeSpanForOpenSliceMs
    this.beatTimeoutMs = config.beatTimeoutMs
    this.spentTimeNotification = spentTimeNotification
    this.resume()
  }

  /**
   * Checks if the time tracker is currently active (i.e., has a beat interval running).
   * @returns `true` if the tracker is active, `false` otherwise.
   */
  public isActive(): boolean {
    return !!this.beatInterval
  }

  /**
   * Pauses the time tracker.
   * This stops the beat and idle watcher, and disables notifications.
   * The `pause` event is emitted.
   */
  public pause(): void {
    this._deactivate()
    this.isPaused = true
    this.spentTimeNotification.disable()
    this.emit('pause')
  }

  /**
   * Stops the time tracker completely.
   * This deactivates the tracker and emits a `stop` event.
   */
  public stop(): void {
    this._deactivate()
    this.emit('stop')
  }

  /**
   * Resumes the time tracker from a paused state.
   * This re-initializes the tracker, enables notifications, and emits a `resume` event.
   */
  public resume(): void {
    this._init()
    this.isPaused = false
    this.spentTimeNotification.enable()
    this.emit('resume')
  }

  /**
   * Call this method when user activity is detected.
   * It updates the last activity timestamp and starts a new time slice if none is active.
   */
  async onActivity(): Promise<void> {
    try {
      if (this.isPaused) {
        return
      }
      if (!this.isActive()) {
        await this._init()
      }
      this.lastActivity = Date.now()
      if (!this.currentSlice) {
        this._beginSlice()
      }
      this.emit('activity')
    } catch (error) {
      Logger().error(`onActivity error: ${error}`)
    }
  }

  /**
   * Checks if a given time entry is recent enough to be continued.
   * An entry can be continued if it has no end time or if its end time is within
   * the configured `maxTimeSpanForOpenSliceMs`.
   * @param entry - The time entry to check.
   * @returns `true` if the entry is valid for continuation, `false` otherwise.
   */
  private _isAValidLastEntryForProject(entry: TimeEntry): boolean {
    const now = new Date()
    if (entry.end == null) {
      return true
    }
    return DateUtils.parseUTCtoZonedTime(entry.end) > DateUtils.subMilliseconds(now, this.maxTimeSpanForOpenSliceMs)
  }

  /**
   * Retrieves the last time entry for the current project that can be continued.
   * It fetches entries for the current day and checks for the latest one associated with the project.
   * @returns A promise that resolves to the last valid `TimeEntry` or `null` if none is found.
   */
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
      if (this._isAValidLastEntryForProject(lastEntry)) {
        return lastEntry
      }
      return null
    }
    return null
  }

  /**
   * Initializes the time tracker.
   * This resets its state, updates from the last entry, and starts the beat and idle watcher.
   * Emits an `init` event upon completion.
   */
  private async _init(): Promise<void> {
    try {
      this._reset()
      await this._updateLastEntry()
      this._startBeat()
      this.emit('init')
    } catch (error) {
      Logger().error(`start error: ${error}`)
    }
  }

  /**
   * Resets the time tracker state.
   * Clears the current slice and updates the last activity timestamp.
   */
  private _reset(): void {
    this.currentSlice = null
    this.lastActivity = Date.now()
  }

  /**
   * Starts the periodic beat interval that synchronizes time tracking data.
   */
  private _startBeat(): void {
    this.beatInterval = setInterval(() => {
      if (this.lastActivity < Date.now() - this.beatTimeoutMs) {
        return
      }
      this._beat().catch((error) => {
        Logger().error(`Beat failed: ${error}`)
      })
    }, this.beatTimeoutMs)
  }

  /**
   * Deactivates the time tracker.
   * This stops all intervals and performs a final beat to sync any pending time.
   */
  async _deactivate(): Promise<void> {
    if (!this.isActive()) {
      Logger().warn(`TimeTracker already stopped for workspace: ${this.projectId}`)
      return
    }
    try {
      this._cleanIntervals()
      await this._beat()
    } catch (error) {
      Logger().error(`stop error: ${error}`)
    }
  }

  /**
   * Begins a new time slice if one is not already active.
   * Sets the current slice with a new start time.
   */
  private _beginSlice(): void {
    if (this.currentSlice) {
      // If current slice already exists keep it
      return
    }

    // If no last entry exists, create a new slice
    const timeSlice = new TimeSlice({startedAt: new Date()})
    this._setCurrentSlice(timeSlice)
  }

  /**
   * Searches for the last time entry within the maximum time span.
   * If a last entry exists, it creates a new time slice based on that entry
   * and sets it as the current slice with the remote ID for synchronization.
   * Updates the spent time notification with the current total time.
   */
  private async _updateLastEntry(): Promise<void> {
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

  /**
   * Sets the current time slice and updates the spent time notification.
   * @param timeSlice - The time slice to set as current, or `null` to clear it.
   */
  private _setCurrentSlice(timeSlice: TimeSlice | null): void {
    this.currentSlice = timeSlice
    this.spentTimeNotification.update(this._getTotalTimeSpent())
  }

  /**
   * Ends the current active time slice by setting its `endedAt` property to the current time.
   */
  private _endSlice(): void {
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
   * The main beat function that runs periodically to sync time with the remote API.
   * It ensures the current slice is ended, then either updates an existing time entry
   * or creates a new one.
   */
  private async _beat(): Promise<void> {
    try {
      // If no slice is active or the last activity was less than the beat timeout, return
      if (!this.currentSlice) {
        return
      }

      this._endSlice()

      // An actual slice is running - sync it with the API
      if (this.currentSlice.remoteId) {
        this.emit('update-time-entry')
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
        this.emit('create-time-entry')
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
        const timeSlice = this.currentSlice.copyWith({remoteId: res.data.id})
        this._setCurrentSlice(timeSlice)
      }
    } catch (error: unknown) {
      Logger().error(
        `beat error for project ${this.projectId}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Clears the beat and idle intervals.
   */
  private _cleanIntervals(): void {
    if (this.beatInterval) {
      clearInterval(this.beatInterval)
      this.beatInterval = null
    }
  }

  /**
   * Disposes of the time tracker service.
   * This stops the tracker and disposes of any owned resources like notifications.
   */
  public dispose(): void {
    this.stop()
    this.spentTimeNotification.dispose()
  }
}

export type {TimeSlice, TimeTrackerServiceConfig}
export {TimeTrackerService, TimeTrackerServiceSymbol, TimeTrackerServiceConfigSymbol, SpendTimeNotificationSymbol}
