import * as vscode from 'vscode'
import {getCurrentUserOrganizationMemberData} from './api'
import {initLoggerInjection, Logger} from './services/injection'
import {initFetchWrapperInjection, initTimeTrackerServiceInjection, TimeTracker} from './services/injection'
import {createOrganizationProject} from './api/organizations/[orgId]/projects/post.index'
import {getOrganizationProjects} from './api/organizations/[orgId]/projects'
import {EventCurator} from './services/event-curator'
import uniqolor from 'uniqolor'
import {DateUtils} from './functions/date'
import {debounce} from './functions/debounce'

const ACTIVITY_DEBOUNCE_MS = 1000

const curator = new EventCurator({
  changeEventThrottleMs: 1000,
})

const CONFIGURATION_SLUG = 'solidtime-vscode-extension'

const bootstrap = async (): Promise<{currentProjectId: string | null}> => {
  const config = vscode.workspace.getConfiguration(CONFIGURATION_SLUG, null)
  const apiKey = config.get<string>('apiKey')
  const apiUrl = config.get<string>('apiUrl')
  const orgId = config.get<string>('organizationId')
  const idleThresholdMinutes = config.get<number>('idleThresholdMinutes')
  const maxTimeSpanForOpenSliceMinutes = config.get<number>('maxTimeSpanForOpenSliceMinutes')
  const beatTimeoutMinutes = config.get<number>('beatTimeoutMinutes')
  const projectName = vscode.workspace.name

  initLoggerInjection()

  if (!apiKey || !apiUrl || !orgId || !idleThresholdMinutes || !maxTimeSpanForOpenSliceMinutes || !beatTimeoutMinutes) {
    const missingFields = []
    if (!apiKey) missingFields.push('apiKey')
    if (!apiUrl) missingFields.push('apiUrl')
    if (!orgId) missingFields.push('organizationId')
    if (!idleThresholdMinutes) missingFields.push('idleThresholdMinutes')
    if (!maxTimeSpanForOpenSliceMinutes) missingFields.push('maxTimeSpanForOpenSliceMinutes')
    if (!beatTimeoutMinutes) missingFields.push('beatTimeoutMinutes')
    throw new Error(`Missing required configuration: ${missingFields.join(', ')}`)
  }

  // If no workspace is open, no project is selected.
  if (!projectName) {
    return {
      currentProjectId: null,
    }
  }

  initFetchWrapperInjection({
    apiUrl,
    apiKey,
  })

  const member = await getCurrentUserOrganizationMemberData(orgId)

  Logger().log(`checking if project ${projectName} exists`)

  const organizationProjects = await getOrganizationProjects({orgId})
  const currentProject = organizationProjects.data.find((p) => p.name === projectName)
  let currentProjectId = currentProject?.id

  if (!currentProjectId) {
    Logger().log(`project: ${projectName} does not exist, creating...`)
    const {color} = uniqolor(projectName)
    const project = await createOrganizationProject(
      {orgId},
      {client_id: null, color, is_billable: false, member_ids: [member.id], name: projectName}
    )
    Logger().log(`project created: ${JSON.stringify(project)}`)
    currentProjectId = project.data.id
  }

  initTimeTrackerServiceInjection({
    orgId,
    memberId: member.id,
    projectId: currentProjectId,
    idleThresholdMs: DateUtils.minutesToMilliseconds(idleThresholdMinutes),
    maxTimeSpanForOpenSliceMs: DateUtils.minutesToMilliseconds(maxTimeSpanForOpenSliceMinutes),
    beatTimeoutMs: DateUtils.minutesToMilliseconds(beatTimeoutMinutes),
  })

  return {
    currentProjectId,
  }
}

/**
 * Sets up activity handlers that track user interactions with the VS Code.
 * These handlers monitor various file and document events to detect when the user is actively working.
 *
 * @param context - The VS Code extension context for managing subscriptions
 * @param handleActivity - Callback function to invoke when user activity is detected
 */
const setupActivityHandlers = (context: vscode.ExtensionContext, handleActivity: () => void) => {
  curator.onDidChangeRelevantTextDocument(handleActivity, null, context.subscriptions)

  vscode.workspace.onDidCloseTextDocument(handleActivity, null, context.subscriptions)

  vscode.workspace.onDidOpenTextDocument(handleActivity, null, context.subscriptions)

  vscode.workspace.onDidCreateFiles(handleActivity, null, context.subscriptions)

  vscode.workspace.onDidDeleteFiles(handleActivity, null, context.subscriptions)

  vscode.workspace.onDidRenameFiles(handleActivity, null, context.subscriptions)

  vscode.workspace.onDidSaveTextDocument(handleActivity, null, context.subscriptions)

  vscode.window.onDidStartTerminalShellExecution(handleActivity, null, context.subscriptions)

  vscode.window.onDidEndTerminalShellExecution(handleActivity, null, context.subscriptions)

  vscode.window.onDidOpenTerminal(handleActivity, null, context.subscriptions)

  vscode.window.onDidCloseTerminal(handleActivity, null, context.subscriptions)
}

export async function activate(context: vscode.ExtensionContext) {
  try {
    const {currentProjectId} = await bootstrap()

    if (!currentProjectId) {
      Logger().warn('no workspace is open, extension will not activate')
      return
    }

    const startTime = Date.now()

    Logger().log('extension activating')
    Logger().log(`session started at ${new Date(startTime).toISOString()}`)

    const handleWindowStateChange = (state: vscode.WindowState) => {
      try {
        if (state.focused || state.active) {
          TimeTracker().start()
        } else {
          TimeTracker().stop()
        }
      } catch (error) {
        Logger().error(`Window state change error: ${error}`)
      }
    }

    setupActivityHandlers(
      context,
      debounce(() => TimeTracker().onActivity(), ACTIVITY_DEBOUNCE_MS)
    )

    vscode.window.onDidChangeWindowState(handleWindowStateChange, null, context.subscriptions)

    Logger().log(`current project id at startup: ${currentProjectId}`)

    TimeTracker().start()

    Logger().log('extension activated')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    Logger().error(`Extension activation failed: ${errorMessage}`)

    vscode.window
      .showErrorMessage(
        `Solidtime extension failed to activate: ${errorMessage}. Please check your configuration in Settings > Solidtime.`,
        'Open Settings'
      )
      .then((selection) => {
        if (selection === 'Open Settings') {
          vscode.commands.executeCommand('workbench.action.openSettings', 'solidtime')
        }
      })
  }
}

export function deactivate() {
  Logger().log('extension deactivating')
  if (TimeTracker()) {
    TimeTracker().dispose()
  }
}
