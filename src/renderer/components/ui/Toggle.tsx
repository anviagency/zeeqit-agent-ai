import { motion } from 'framer-motion'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label?: string
  id?: string
}

/**
 * Custom toggle switch: 60×34px, white when on, dim when off.
 *
 * @example
 * <Toggle checked={enabled} onChange={setEnabled} label="Auto-start" />
 */
export function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
  id
}: ToggleProps): React.JSX.Element {
  const toggleId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <label
      htmlFor={toggleId}
      className={[
        'inline-flex items-center gap-3',
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
      ].join(' ')}
    >
      <button
        id={toggleId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={[
          'relative inline-flex shrink-0 rounded-full transition-colors',
          checked ? 'bg-accent' : 'bg-border'
        ].join(' ')}
        style={{ width: 60, height: 34 }}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="absolute top-[3px] block h-7 w-7 rounded-full bg-bg-base shadow-md"
          style={{ left: checked ? 27 : 3 }}
        />
      </button>

      {label && (
        <span className="select-none text-sm text-text-main">{label}</span>
      )}
    </label>
  )
}
