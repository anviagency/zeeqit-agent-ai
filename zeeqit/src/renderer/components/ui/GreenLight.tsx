import { motion } from 'framer-motion'

type LightStatus = 'green' | 'red' | 'yellow'

interface GreenLightProps {
  status: LightStatus
  label: string
  tooltip?: string
}

const statusColors: Record<LightStatus, { bg: string; glow: string }> = {
  green: { bg: 'bg-success', glow: 'shadow-[0_0_8px_rgba(50,215,75,0.6)]' },
  red: { bg: 'bg-error', glow: 'shadow-[0_0_8px_rgba(255,69,58,0.6)]' },
  yellow: { bg: 'bg-warning', glow: 'shadow-[0_0_8px_rgba(255,159,10,0.6)]' },
}

/**
 * Status indicator light: 10px circle with pulse animation and optional label.
 *
 * @example
 * <GreenLight status="green" label="Daemon" tooltip="Process running" />
 */
export function GreenLight({ status, label, tooltip }: GreenLightProps): React.JSX.Element {
  const { bg, glow } = statusColors[status]

  return (
    <div className="flex items-center gap-2" title={tooltip}>
      <motion.div
        className={`h-2.5 w-2.5 rounded-full ${bg} ${glow}`}
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <span className="text-xs text-text-muted">{label}</span>
    </div>
  )
}
