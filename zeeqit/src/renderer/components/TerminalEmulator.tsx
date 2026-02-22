import { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'

interface TerminalLine {
  text: string
  className?: string
}

interface TerminalEmulatorProps {
  lines: TerminalLine[]
  title?: string
  className?: string
}

/**
 * Terminal display component with monospace font, dark background,
 * and auto-scroll. Used in onboarding Step 4.
 *
 * @example
 * <TerminalEmulator
 *   title="Installing OpenClaw"
 *   lines={[{ text: '> Installing dependencies…', className: 'text-success' }]}
 * />
 */
export function TerminalEmulator({
  lines,
  title,
  className = ''
}: TerminalEmulatorProps): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [lines])

  return (
    <div
      className={[
        'flex flex-col overflow-hidden rounded-xl border border-border',
        className
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Title bar */}
      {title && (
        <div className="flex items-center gap-2 border-b border-border bg-bg-surface px-4 py-2.5">
          <span className="h-3 w-3 rounded-full bg-error" />
          <span className="h-3 w-3 rounded-full bg-warning" />
          <span className="h-3 w-3 rounded-full bg-success" />
          <span className="ml-2 text-xs text-text-muted">{title}</span>
        </div>
      )}

      {/* Terminal body */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-bg-base p-4"
        style={{ maxHeight: 320 }}
      >
        <div className="flex flex-col gap-0.5">
          {lines.map((line, i) => (
            <motion.pre
              key={i}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.12, delay: i * 0.02 }}
              className={[
                'whitespace-pre-wrap font-mono text-xs leading-5',
                line.className ?? 'text-text-main'
              ].join(' ')}
            >
              {line.text}
            </motion.pre>
          ))}
        </div>
      </div>
    </div>
  )
}
