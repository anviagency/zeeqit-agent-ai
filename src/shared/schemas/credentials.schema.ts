import { z } from 'zod'

export const CredentialEntrySchema = z.object({
  id: z.string(),
  service: z.enum([
    'openai',
    'anthropic',
    'openrouter',
    'gologin',
    'apify',
    'telegram',
    'instagram',
    'tiktok',
    'whatsapp',
    'nanobanano',
    's3',
    'gdrive',
    'custom'
  ]),
  label: z.string(),
  encryptedValue: z.string(),
  salt: z.string(),
  iv: z.string(),
  keyVersion: z.number().int().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

export type CredentialEntry = z.infer<typeof CredentialEntrySchema>

export const CredentialVaultSchema = z.object({
  version: z.number().int().default(1),
  credentials: z.array(CredentialEntrySchema).default([])
})

export type CredentialVault = z.infer<typeof CredentialVaultSchema>
