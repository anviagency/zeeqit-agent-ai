/**
 * Installation state machine types.
 *
 * States: NotInstalled -> Installing -> Healthy / Unhealthy -> Repairing -> Healthy
 * The `Interrupted` state is detected on app launch via checkpoint file.
 */

export type InstallationState =
  | 'not_installed'
  | 'installing'
  | 'interrupted'
  | 'healthy'
  | 'unhealthy'
  | 'repairing'

export type InstallStep =
  | 'runtime'
  | 'openclaw'
  | 'config'
  | 'credentials'
  | 'daemon'
  | 'health'
  | 'complete'

export interface InstallCheckpoint {
  step: InstallStep
  completedAt: string
  version: string
  error?: string
}

export interface RepairStepResult {
  step: string
  passed: boolean
  message: string
  suggestedAction?: string
}

export interface RepairReport {
  overallSuccess: boolean
  steps: RepairStepResult[]
  completedAt: string
}

export const INSTALL_STEP_ORDER: InstallStep[] = [
  'runtime',
  'openclaw',
  'config',
  'credentials',
  'daemon',
  'health',
  'complete'
]

/**
 * Determines the next step to execute given the last completed step.
 */
export function getNextStep(lastCompleted: InstallStep | null): InstallStep | null {
  if (lastCompleted === null) return 'runtime'
  const idx = INSTALL_STEP_ORDER.indexOf(lastCompleted)
  if (idx === -1 || idx >= INSTALL_STEP_ORDER.length - 1) return null
  return INSTALL_STEP_ORDER[idx + 1]
}
