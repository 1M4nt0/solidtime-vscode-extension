/**
 * Portions of this file are derived from the vscode-event-curator project
 *   https://github.com/claui/vscode-event-curator
 */

import {type Event, type TextDocument, type TextDocumentChangeEvent, type Uri} from 'vscode'

const schemesToExclude: string[] = ['git', 'gitfs', 'output', 'vscode']

export function relevantChangeEventsByScheme(event: Event<TextDocumentChangeEvent>) {
  return excludeUriSchemes((e) => e.document.uri, event)
}

export function excludeUriSchemes<T>(extractUri: (event: T) => Uri, upstreamEvent: Event<T>): Event<T> {
  const schemesToExcludeArray: string[] = Array.from(schemesToExclude)
  function isSchemeRelevant(uri: Uri) {
    return !schemesToExcludeArray.includes(uri.scheme)
  }
  return select((e: T) => isSchemeRelevant(extractUri(e)), upstreamEvent)
}

export function ignoreIfAlreadyClosed(upstreamEvent: Event<TextDocument>) {
  return select((document) => !document.isClosed, upstreamEvent)
}

/**
 * @this unknown passed through to the upstream event.
 */
export function select<T>(match: (e: T) => boolean, upstreamEvent: Event<T>): Event<T> {
  return (...[listener, listenerThisArgs, disposables]) => {
    const upstreamListener: (e: T) => unknown = (e) => {
      return match(e) ? listener.call(listenerThisArgs, e) : null
    }
    return upstreamEvent(upstreamListener, listenerThisArgs, disposables)
  }
}
