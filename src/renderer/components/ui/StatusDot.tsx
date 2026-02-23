import { motion } from 'framer-motion'

type DotColor = 'green' | 'red' | 'yellow'

interface StatusDotProps {
  color: DotColor
  pulse?: boolean
  size?: number
  className?: string
}

const colorMap: Record<DotColor, { bg: string; ring: string }> = {
  green: { bg: 'bg-success', ring: 'ring-success/30' },
  red: { bg: 'bg-error', ring: 'ring-error/30' },
  yellow: { bg: 'bg-warning', ring: 'ring-warning/30' }
}

/**
 * Small colored status dot with optional pulse animation.
 *
 * @example
 * <StatusDot color="green" pulse />
 */
export function StatusDot({
  color,
  pulse = false,
  size = 8,
  className = ''
}: StatusDotProps): React.JSX.Element {
  const { bg, ring } = colorMap[color]

  return (
    <span className={`relative inline-flex ${className}`}>
      {pulse && (
        <motion.span
          className={`absolute inset-0 rounded-full ${bg} opacity-40`}
          animate={{ scale: [1, 1.8, 1], opacity: [0.4, 0, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ width: size, height: size }}
        />
      )}
      <span
        className={`relative inline-block rounded-full ${bg} ${pulse ? `ring-2 ${ring}` : ''}`}
        style={{ width: size, height: size }}
      />
    </span>
  )
}
