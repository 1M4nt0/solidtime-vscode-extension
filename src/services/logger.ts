import {window} from 'vscode'
import type {OutputChannel} from 'vscode'

const OUTPUT_CHANNEL_NAME = 'Solidtime'

interface ILogger {
  log(message: string): void
  error(message: string): void
  warn(message: string): void
  info(message: string): void
  debug(message: string): void
}

class ConsoleLogger implements ILogger {
  private readonly outputChannel: OutputChannel

  constructor() {
    this.outputChannel = window.createOutputChannel(OUTPUT_CHANNEL_NAME)
  }

  error(message: string): void {
    this.outputChannel.appendLine(`[${new Date().toLocaleString()}] [ERROR] ${message}`)
  }
  warn(message: string): void {
    this.outputChannel.appendLine(`[${new Date().toLocaleString()}] [WARN] ${message}`)
  }
  info(message: string): void {
    this.outputChannel.appendLine(`[${new Date().toLocaleString()}] [INFO] ${message}`)
  }
  debug(message: string): void {
    this.outputChannel.appendLine(`[${new Date().toLocaleString()}] [DEBUG] ${message}`)
  }
  log(message: string): void {
    this.outputChannel.appendLine(`[${new Date().toLocaleString()}] [LOG] ${message}`)
  }
}

export {ConsoleLogger, type ILogger}