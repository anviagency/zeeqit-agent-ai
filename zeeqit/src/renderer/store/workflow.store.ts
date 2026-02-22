import { create } from 'zustand'

export type WorkflowStatus = 'idle' | 'running' | 'completed' | 'failed' | 'scheduled'

export interface WorkflowSummary {
  id: string
  name: string
  status: WorkflowStatus
  lastRunAt: string | null
  schedule: string | null
}

export interface WorkflowExecution {
  workflowId: string
  status: WorkflowStatus
  progress: number
  currentStep: string | null
  startedAt: string
  completedAt: string | null
  error: string | null
}

interface WorkflowState {
  workflows: WorkflowSummary[]
  selectedWorkflowId: string | null
  activeExecution: WorkflowExecution | null
  isLoading: boolean

  setWorkflows: (workflows: WorkflowSummary[]) => void
  selectWorkflow: (workflowId: string | null) => void
  setActiveExecution: (execution: WorkflowExecution | null) => void
  updateExecutionProgress: (progress: Partial<WorkflowExecution>) => void
  setLoading: (loading: boolean) => void
  getSelectedWorkflow: () => WorkflowSummary | undefined
}

export const useWorkflowStore = create<WorkflowState>()((set, get) => ({
  workflows: [],
  selectedWorkflowId: null,
  activeExecution: null,
  isLoading: false,

  setWorkflows: (workflows) => set({ workflows }),
  selectWorkflow: (selectedWorkflowId) => set({ selectedWorkflowId }),
  setActiveExecution: (activeExecution) => set({ activeExecution }),

  updateExecutionProgress: (progress) =>
    set((s) => ({
      activeExecution: s.activeExecution ? { ...s.activeExecution, ...progress } : null
    })),

  setLoading: (isLoading) => set({ isLoading }),

  getSelectedWorkflow: () => {
    const { workflows, selectedWorkflowId } = get()
    return workflows.find((w) => w.id === selectedWorkflowId)
  }
}))
