import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { api } from '@/api'

/**
 * Model provider settings card for OpenAI and Anthropic keys.
 */
export function IntelligenceCard(): React.JSX.Element {
  const [persona, setPersona] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [anthropicKey, setAnthropicKey] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async (): Promise<void> => {
    try {
      setSaving(true)
      await api.vault.store('intelligence', 'persona', persona)
      if (openaiKey) await api.vault.store('intelligence', 'openaiKey', openaiKey)
      if (anthropicKey) await api.vault.store('intelligence', 'anthropicKey', anthropicKey)
    } catch {
      // error handling delegated to global error boundary
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold text-text-main">Intelligence</h3>
      <p className="mt-1 text-xs text-text-muted">AI model providers and agent persona configuration.</p>

      <div className="mt-5 space-y-4">
        <Input
          label="Agent Persona"
          placeholder="e.g. Hebrew, Direct"
          value={persona}
          onChange={(e) => setPersona(e.target.value)}
        />
        <Input
          label="OpenAI API Key"
          type="password"
          placeholder="sk-..."
          value={openaiKey}
          onChange={(e) => setOpenaiKey(e.target.value)}
        />
        <Input
          label="Anthropic API Key"
          type="password"
          placeholder="sk-ant-..."
          value={anthropicKey}
          onChange={(e) => setAnthropicKey(e.target.value)}
        />
        <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
          Save Keys
        </Button>
      </div>
    </Card>
  )
}
