import { AnimatePresence, motion } from 'framer-motion'
import type { NetworkNodeData } from './NetworkNode'
import { Button } from '@/components/ui/Button'

interface InspectorPanelProps {
  node: NetworkNodeData | null
  onClose: () => void
}

/**
 * Slide-in inspector panel showing details for the selected topology node.
 */
export function InspectorPanel({ node, onClose }: InspectorPanelProps): React.JSX.Element {
  return (
    <AnimatePresence>
      {node && (
        <motion.div
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 250 }}
          className="absolute right-0 top-0 bottom-0 z-20 flex w-[340px] flex-col border-l border-border bg-bg-base"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-5">
            <div className="flex items-center gap-3">
              <span className="text-text-muted">{node.icon}</span>
              <h3 className="text-sm font-semibold text-text-main">{node.label}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-text-muted hover:text-text-main transition-colors"
              aria-label="Close inspector"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-5">
              <InfoRow label="Status" value={node.status} />
              <InfoRow label="Node ID" value={node.id} />
              <InfoRow label="Position" value={`x: ${node.x}%, y: ${node.y}%`} />
            </div>

            <div className="mt-8">
              <h4 className="mb-3 text-[11px] font-semibold tracking-[0.1em] text-text-muted uppercase">
                Actions
              </h4>
              <div className="flex flex-col gap-2">
                <Button variant="secondary" size="sm">
                  Restart Module
                </Button>
                <Button variant="secondary" size="sm">
                  View Logs
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function InfoRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-text-muted">{label}</span>
      <span className="font-mono text-text-main">{value}</span>
    </div>
  )
}
