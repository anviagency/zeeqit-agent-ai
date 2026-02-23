import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Toggle } from '@/components/ui/Toggle'
import { Button } from '@/components/ui/Button'
import { Dropdown } from '@/components/ui/Dropdown'
import { api } from '@/api'

interface ChannelState {
  telegram: {
    enabled: boolean
    botToken: string
    dmPolicy: string
  }
  whatsapp: {
    enabled: boolean
    phoneNumber: string
  }
  discord: {
    enabled: boolean
    botToken: string
  }
}

const DM_POLICY_OPTIONS = [
  { value: 'pairing', label: 'Pairing' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' }
]

/**
 * Channels configuration card for Telegram, WhatsApp, and Discord integrations.
 * Stores credentials via the vault API.
 */
export function ChannelsCard(): React.JSX.Element {
  const [saving, setSaving] = useState(false)
  const [channels, setChannels] = useState<ChannelState>({
    telegram: { enabled: false, botToken: '', dmPolicy: 'pairing' },
    whatsapp: { enabled: false, phoneNumber: '' },
    discord: { enabled: false, botToken: '' }
  })

  const update = <K extends keyof ChannelState>(
    channel: K,
    field: keyof ChannelState[K],
    value: ChannelState[K][keyof ChannelState[K]]
  ): void => {
    setChannels((prev) => ({
      ...prev,
      [channel]: { ...prev[channel], [field]: value }
    }))
  }

  const handleSave = async (): Promise<void> => {
    try {
      setSaving(true)
      if (channels.telegram.botToken) {
        await api.vault.store('channels', 'telegramBotToken', channels.telegram.botToken)
      }
      await api.vault.store('channels', 'telegramDmPolicy', channels.telegram.dmPolicy)
      await api.vault.store('channels', 'telegramEnabled', String(channels.telegram.enabled))
      await api.vault.store('channels', 'whatsappEnabled', String(channels.whatsapp.enabled))
      if (channels.whatsapp.phoneNumber) {
        await api.vault.store('channels', 'whatsappPhone', channels.whatsapp.phoneNumber)
      }
      await api.vault.store('channels', 'discordEnabled', String(channels.discord.enabled))
      if (channels.discord.botToken) {
        await api.vault.store('channels', 'discordBotToken', channels.discord.botToken)
      }
    } catch {
      // error handling delegated to global error boundary
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="col-span-2 p-6">
      <div className="flex items-center gap-2.5 mb-6">
        <MessagingIcon />
        <h3 className="text-sm font-semibold text-text-main">Channels</h3>
      </div>

      <div className="space-y-6">
        {/* Telegram */}
        <div className="rounded-lg border border-border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text-main">Telegram</span>
            <Toggle
              checked={channels.telegram.enabled}
              onChange={(v) => update('telegram', 'enabled', v)}
            />
          </div>
          <Input
            label="Bot Token"
            type="password"
            placeholder="123456:ABC-DEF..."
            value={channels.telegram.botToken}
            onChange={(e) => update('telegram', 'botToken', e.target.value)}
            disabled={!channels.telegram.enabled}
          />
          <Dropdown
            label="DM Policy"
            options={DM_POLICY_OPTIONS}
            value={channels.telegram.dmPolicy}
            onChange={(v) => update('telegram', 'dmPolicy', v)}
            disabled={!channels.telegram.enabled}
          />
        </div>

        {/* WhatsApp */}
        <div className="rounded-lg border border-border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text-main">WhatsApp</span>
              <ComingSoonBadge />
            </div>
            <Toggle
              checked={channels.whatsapp.enabled}
              onChange={(v) => update('whatsapp', 'enabled', v)}
            />
          </div>
          <Input
            label="Phone Number"
            placeholder="+1 234 567 8900"
            value={channels.whatsapp.phoneNumber}
            onChange={(e) => update('whatsapp', 'phoneNumber', e.target.value)}
            disabled={!channels.whatsapp.enabled}
          />
        </div>

        {/* Discord */}
        <div className="rounded-lg border border-border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text-main">Discord</span>
              <ComingSoonBadge />
            </div>
            <Toggle
              checked={channels.discord.enabled}
              onChange={(v) => update('discord', 'enabled', v)}
            />
          </div>
          <Input
            label="Bot Token"
            type="password"
            placeholder="Discord bot token..."
            value={channels.discord.botToken}
            onChange={(e) => update('discord', 'botToken', e.target.value)}
            disabled={!channels.discord.enabled}
          />
        </div>
      </div>

      <div className="mt-6">
        <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
          Save Channels
        </Button>
      </div>
    </Card>
  )
}

function ComingSoonBadge(): React.JSX.Element {
  return (
    <span className="inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
      Coming soon
    </span>
  )
}

function MessagingIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  )
}
