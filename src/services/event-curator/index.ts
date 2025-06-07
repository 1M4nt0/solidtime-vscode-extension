/**
 * Portions of this file are derived from the vscode-event-curator project
 *   https://github.com/claui/vscode-event-curator
 */

import {workspace, type DocumentSelector, type Event, type TextDocument} from 'vscode'
import {ignoreIfAlreadyClosed, relevantChangeEventsByScheme} from './filters'
import {throttleEvent} from './throttle'
import {stream} from './stream'

type EventCuratorConfig = DocumentSelector & {
  changeEventThrottleMs: number
}

export class EventCurator {
  private _config

  constructor(config: EventCuratorConfig) {
    this._config = config
  }

  onDidChangeRelevantTextDocument(...args: Parameters<Event<TextDocument>>) {
    return stream(workspace.onDidChangeTextDocument)
      .select(relevantChangeEventsByScheme)
      .map(throttleEvent(this._config.changeEventThrottleMs, (e) => e.document))
      .select(ignoreIfAlreadyClosed)(...args)
  }
}
