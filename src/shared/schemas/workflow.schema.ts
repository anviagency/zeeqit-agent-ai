import { z } from 'zod'

export const ExtractionModeSchema = z.enum(['auto', 'apify', 'browser'])

/** A single node in a workflow graph. */
export const WorkflowNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  desc: z.string().default(''),
  x: z.number().default(0),
  y: z.number().default(0),
  icon: z.string().default(''),
  config: z.record(z.string(), z.string()).default({}),
  missing: z.boolean().default(false),
})

export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>

export const WorkflowSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  prompt: z.string().default(''),
  nodes: z.array(WorkflowNodeSchema).default([]),
  schedule: z.string().nullable().default(null),
  enabled: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Workflow = z.infer<typeof WorkflowSchema>

export const WorkflowRunSchema = z.object({
  id: z.string().uuid(),
  workflowId: z.string().uuid(),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  mode: z.string().default('openclaw'),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  resultCount: z.number().int().optional(),
  evidenceChainId: z.string().optional(),
  error: z.string().optional(),
})

export type WorkflowRun = z.infer<typeof WorkflowRunSchema>
