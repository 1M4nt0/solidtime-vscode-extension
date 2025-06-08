import {
  TimeTrackerServiceConfigSymbol,
  TimeTrackerServiceSymbol,
  type TimeTrackerServiceConfig,
  TimeTrackerService,
  SpendTimeNotificationSymbol,
} from './timeTracker'
import {FetchWrapper, FetchWrapperConfigSymbol, FetchWrapperSymbol, type FetchWrapperConfig} from './fetch'
import {Container} from 'inversify'
import {ConsoleLogger, type ILogger} from './logger'
import {StatusBar, type SpendTimeNotification} from './statusBar'

const _container = new Container()

const initFetchWrapperInjection = (config: {apiUrl: string; apiKey: string}) => {
  _container.bind<FetchWrapperConfig>(FetchWrapperConfigSymbol).toConstantValue({
    baseUrl: `${config.apiUrl}/api/v1`,
    apiKey: config.apiKey,
  })
  _container.bind<FetchWrapper>(FetchWrapperSymbol).to(FetchWrapper).inSingletonScope()
}

const initTimeTrackerServiceInjection = (config: {
  orgId: string
  memberId: string
  projectId: string
  idleThresholdMs: number
  maxTimeSpanForOpenSliceMs: number
  beatTimeoutMs: number
}) => {
  _container.bind<TimeTrackerServiceConfig>(TimeTrackerServiceConfigSymbol).toConstantValue({
    orgId: config.orgId,
    memberId: config.memberId,
    projectId: config.projectId,
    idleThresholdMs: config.idleThresholdMs,
    maxTimeSpanForOpenSliceMs: config.maxTimeSpanForOpenSliceMs,
    beatTimeoutMs: config.beatTimeoutMs,
  })
  _container.bind<TimeTrackerService>(TimeTrackerServiceSymbol).to(TimeTrackerService).inSingletonScope()
  _container.bind<SpendTimeNotification>(SpendTimeNotificationSymbol).to(StatusBar).inSingletonScope()
}

const initLoggerInjection = () => {
  _container.bind<ILogger>(ConsoleLogger).to(ConsoleLogger).inSingletonScope()
}

const API = (): FetchWrapper => {
  if (!_container.isBound(FetchWrapperSymbol)) {
    throw new Error(
      'FetchWrapper (API service) is not initialized. Ensure initFetchWrapperInjection() has been called before using API().'
    )
  }
  return _container.get<FetchWrapper>(FetchWrapperSymbol)
}

const TimeTracker = (): TimeTrackerService => {
  if (!_container.isBound(TimeTrackerServiceSymbol)) {
    throw new Error(
      'TimeTrackerService is not initialized. Ensure initTimeTrackerServiceInjection() has been called before using TimeTracker().'
    )
  }
  return _container.get<TimeTrackerService>(TimeTrackerServiceSymbol)
}

const Logger = (): ILogger => {
  if (!_container.isBound(ConsoleLogger)) {
    throw new Error('Logger is not initialized. Ensure initLoggerInjection() has been called before using Logger().')
  }
  return _container.get<ILogger>(ConsoleLogger)
}

export {initFetchWrapperInjection, initTimeTrackerServiceInjection, API, TimeTracker, Logger, initLoggerInjection}
