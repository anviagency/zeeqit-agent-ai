import { z } from 'zod'

export const ExtractionModeSchema = z.enum(['auto', 'apify', 'browser'])

export const WorkflowSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  targetUrl: z.string().url(),
  extractionGoal: z.string().min(1),
  mode: ExtractionModeSchema.default('auto'),
  schedule: z.string().optional(),
  enabled: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

export type Workflow = z.infer<typeof WorkflowSchema>

export const WorkflowRunSchema = z.object({
  id: z.string().uuid(),
  workflowId: z.string().uuid(),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  mode: ExtractionModeSchema,
  engineUsed: z.enum(['apify', 'browser']).optional(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  resultCount: z.number().int().optional(),
  evidenceChainId: z.string().optional(),
  error: z.string().optional()
})

export type WorkflowRun = z.infer<typeof WorkflowRunSchema>
