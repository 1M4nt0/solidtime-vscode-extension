import {injectable} from 'inversify'
import type {StatusBarItem} from 'vscode'
import {StatusBarAlignment, window} from 'vscode'

abstract class SpendTimeNotification {
  abstract update(workingTime: number): void
  abstract dispose(): void
  abstract enable(): void
  abstract disable(): void
}

@injectable()
class StatusBar implements SpendTimeNotification {
  private readonly statusBarItem: StatusBarItem
  private readonly _iconRegex = /\$\([a-z-]+\)/
  private isEnabled = true

  constructor() {
    this.statusBarItem = window.createStatusBarItem('solidtime-vscode-extension.time', StatusBarAlignment.Left, 3)
    this.statusBarItem.name = 'Solidtime VSCode Extension'
    this.statusBarItem.text = `$(clock) 0 hrs 0 mins`
    this.statusBarItem.tooltip = 'Solidtime VSCode Extension: current working time on this project.'
    this.statusBarItem.show()
  }

  update(workingTime: number): void {
    const iconMatch = this.statusBarItem.text.match(this._iconRegex)
    const icon = iconMatch ? iconMatch[0] : '$(clock)'
    let formattedTime = this._formatTimeSpent(workingTime)
    if (!this.isEnabled) {
      formattedTime = formattedTime.replace(/./g, '$&\u0336')
    }
    this.statusBarItem.text = `${icon} ${formattedTime}`
  }

  enable(): void {
    this.isEnabled = true
    const text = this.statusBarItem.text.replace(/\u0336/g, '')
    this.statusBarItem.text = text.replace(this._iconRegex, '$(clock)')
    this.statusBarItem.command = 'solidtime.pauseTracking'
  }

  disable(): void {
    this.isEnabled = false
    const timeText = this.statusBarItem.text.replace(this._iconRegex, '').trim()
    const struckTimeText = timeText.replace(/./g, '$&\u0336')
    this.statusBarItem.text = `$(debug-pause) ${struckTimeText}`
    this.statusBarItem.command = 'solidtime.resumeTracking'
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
