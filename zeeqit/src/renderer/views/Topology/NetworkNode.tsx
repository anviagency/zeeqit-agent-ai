import { motion } from 'framer-motion'

export interface NetworkNodeData {
  id: string
  label: string
  status: 'online' | 'offline' | 'degraded'
  icon: React.ReactNode
  x: number
  y: number
}

interface NetworkNodeProps {
  node: NetworkNodeData
  isSelected: boolean
  onClick: (id: string) => void
}

const statusColor: Record<NetworkNodeData['status'], string> = {
  online: 'bg-success',
  offline: 'bg-error',
  degraded: 'bg-warning',
}

const statusLabel: Record<NetworkNodeData['status'], string> = {
  online: 'Online',
  offline: 'Offline',
  degraded: 'Degraded',
}

/**
 * Individual topology node rendered absolutely within the canvas.
 *
 * @param node - Position, label, status, and icon data
 * @param isSelected - Whether the inspector panel is showing this node
 * @param onClick - Callback when the node is clicked
 */
export function NetworkNode({ node, isSelected, onClick }: NetworkNodeProps): React.JSX.Element {
  return (
    <motion.button
      type="button"
      onClick={() => onClick(node.id)}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.06 }}
      transition={{ duration: 0.3 }}
      className={[
        'absolute flex flex-col items-center gap-2 rounded-xl border px-5 py-4 transition-colors',
        isSelected
          ? 'border-accent bg-bg-hover'
          : 'border-border bg-bg-surface hover:border-border-hover',
      ].join(' ')}
      style={{ left: `${node.x}%`, top: `${node.y}%`, transform: 'translate(-50%, -50%)' }}
    >
      <span className="text-text-muted">{node.icon}</span>
      <span className="text-xs font-medium text-text-main whitespace-nowrap">{node.label}</span>
      <div className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${statusColor[node.status]}`} />
        <span className="text-[10px] text-text-muted">{statusLabel[node.status]}</span>
      </div>
    </motion.button>
  )
}
