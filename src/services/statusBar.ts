import {injectable} from 'inversify'
import type {StatusBarItem} from 'vscode'
import {StatusBarAlignment, window} from 'vscode'

abstract class SpendTimeNotification {
  abstract update(workingTime: number): void
  abstract dispose(): void
}

@injectable()
class StatusBar implements SpendTimeNotification {
  private readonly statusBarItem: StatusBarItem

  constructor() {
    this.statusBarItem = window.createStatusBarItem('solidtime-vscode-extension.time', StatusBarAlignment.Left, 3)
    this.statusBarItem.name = 'Solidtime VSCode Extension'
    this.statusBarItem.text = `$(clock) 0 hrs 0 mins`
    this.statusBarItem.tooltip = 'Solidtime VSCode Extension: current working time on this project.'
    this.statusBarItem.show()
  }

  update(workingTime: number): void {
    this.statusBarItem.text = `$(clock) ${this._formatTimeSpent(workingTime)}`
  }

  dispose(): void {
    this.statusBarItem.dispose()
  }

  private _formatTimeSpent(totalTime: number): string {
    const hours = Math.floor(totalTime / (1000 * 60 * 60))
    const minutes = Math.floor((totalTime % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours} hrs ${minutes} mins`
  }
}

export {StatusBar}
export type {SpendTimeNotification}
