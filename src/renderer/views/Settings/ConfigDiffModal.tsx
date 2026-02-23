import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'

interface ConfigDiffModalProps {
  isOpen: boolean
  diff: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

/**
 * Modal overlay displaying a config diff preview before applying changes.
 */
export function ConfigDiffModal({
  isOpen,
  diff,
  onConfirm,
  onCancel,
  loading = false,
}: ConfigDiffModalProps): React.JSX.Element {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onCancel}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative z-10 flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-bg-base shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-sm font-semibold text-text-main">Configuration Diff</h2>
              <button
                type="button"
                onClick={onCancel}
                className="rounded-md p-1 text-text-muted hover:text-text-main transition-colors"
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Diff content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-text-muted">
                {diff || 'No changes detected.'}
              </pre>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
              <Button variant="secondary" size="sm" onClick={onCancel}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" loading={loading} onClick={onConfirm}>
                Apply Changes
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
