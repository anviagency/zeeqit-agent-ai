import { z } from 'zod'

export const ModelConfigSchema = z.object({
  primary: z.string().min(1),
  fallbacks: z.array(z.string()).default([])
})

export const AgentDefaultsSchema = z.object({
  workspace: z.string().default('~/.openclaw/workspace'),
  model: ModelConfigSchema,
  thinkingDefault: z.enum(['low', 'medium', 'high']).default('low'),
  maxConcurrent: z.number().int().min(1).max(20).default(3),
  timeoutSeconds: z.number().int().min(30).max(3600).default(600)
})

export const IdentitySchema = z.object({
  name: z.string().default('Zeeqit Agent'),
  theme: z.string().default(''),
  emoji: z.string().default('◇')
})

export const TelegramChannelSchema = z.object({
  enabled: z.boolean().default(false),
  botToken: z.string().default(''),
  dmPolicy: z.enum(['pairing', 'open', 'closed']).default('pairing')
})

export const ChannelsSchema = z.object({
  telegram: TelegramChannelSchema.optional()
})

export const ToolsSchema = z.object({
  profile: z.enum(['full', 'minimal', 'custom']).default('full')
})

export const SkillsSchema = z.object({
  load: z.object({
    watchForChanges: z.boolean().default(true)
  }).default({})
})

export const GatewaySchema = z.object({
  port: z.number().int().min(1024).max(65535).default(18789),
  reload: z.object({
    mode: z.enum(['hybrid', 'manual', 'auto']).default('hybrid')
  }).default({})
})

export const OpenClawConfigSchema = z.object({
  identity: IdentitySchema.default({}),
  agents: z.object({
    defaults: AgentDefaultsSchema
  }),
  channels: ChannelsSchema.default({}),
  tools: ToolsSchema.default({}),
  skills: SkillsSchema.default({}),
  gateway: GatewaySchema.default({})
})

export type OpenClawConfig = z.infer<typeof OpenClawConfigSchema>
