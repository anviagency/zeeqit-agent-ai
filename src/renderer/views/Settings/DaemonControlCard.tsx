import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

type DaemonStatus = 'running' | 'stopped' | 'unknown'

const statusDisplay: Record<DaemonStatus, { color: string; label: string }> = {
  running: { color: 'bg-success', label: 'Running' },
  stopped: { color: 'bg-error', label: 'Stopped' },
  unknown: { color: 'bg-warning', label: 'Unknown' },
}

/**
 * Daemon lifecycle controls: start, stop, restart, and status indicator.
 */
export function DaemonControlCard(): React.JSX.Element {
  const [status, setStatus] = useState<DaemonStatus>('unknown')
  const [loading, setLoading] = useState<string | null>(null)

  const execAction = async (action: 'start' | 'stop' | 'restart'): Promise<void> => {
    try {
      setLoading(action)
      await window.zeeqitApi.daemon[action]()
      const result = await window.zeeqitApi.daemon.status()
      if (result.success) {
        const data = result.data as { running?: boolean } | undefined
        setStatus(data?.running ? 'running' : 'stopped')
      }
    } catch {
      setStatus('unknown')
    } finally {
      setLoading(null)
    }
  }

  const { color, label } = statusDisplay[status]

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-main">Daemon Control</h3>
          <p className="mt-1 text-xs text-text-muted">Manage the OpenClaw daemon lifecycle.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${color}`} />
          <span className="text-xs text-text-muted">{label}</span>
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        <Button variant="primary" size="sm" loading={loading === 'start'} onClick={() => execAction('start')}>
          Start
        </Button>
        <Button variant="danger" size="sm" loading={loading === 'stop'} onClick={() => execAction('stop')}>
          Stop
        </Button>
        <Button variant="secondary" size="sm" loading={loading === 'restart'} onClick={() => execAction('restart')}>
          Restart
        </Button>
      </div>
    </Card>
  )
}
