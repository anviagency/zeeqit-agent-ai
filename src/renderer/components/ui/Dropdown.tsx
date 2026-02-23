import { useState, useRef, useEffect, useId } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

interface DropdownOption {
  value: string
  label: string
}

interface DropdownProps {
  options: DropdownOption[]
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  disabled?: boolean
  className?: string
}

/**
 * Custom styled dropdown select with animated option list.
 *
 * @example
 * <Dropdown
 *   label="Region"
 *   options={[{ value: 'us', label: 'US East' }]}
 *   value={region}
 *   onChange={setRegion}
 * />
 */
export function Dropdown({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  label,
  disabled = false,
  className = ''
}: DropdownProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const labelId = useId()

  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    const handleOutside = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  return (
    <div className={`flex flex-col gap-1.5 ${className}`} ref={containerRef}>
      {label && (
        <span id={labelId} className="text-xs font-medium text-text-muted">
          {label}
        </span>
      )}

      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={label ? labelId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={[
          'flex w-full items-center justify-between rounded-lg border border-border bg-bg-surface px-4 py-2.5 text-sm transition-colors',
          'hover:border-border-hover focus:outline-none',
          disabled && 'cursor-not-allowed opacity-40'
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span className={selected ? 'text-text-main' : 'text-text-muted'}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown open={open} />
      </button>

      <div className="relative">
        <AnimatePresence>
          {open && (
            <motion.ul
              role="listbox"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute left-0 top-0 z-50 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-bg-surface py-1 shadow-xl"
            >
              {options.map((opt) => (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={opt.value === value}
                  onClick={() => {
                    onChange(opt.value)
                    setOpen(false)
                  }}
                  className={[
                    'cursor-pointer px-4 py-2 text-sm transition-colors',
                    opt.value === value
                      ? 'bg-bg-hover text-accent'
                      : 'text-text-main hover:bg-bg-hover'
                  ].join(' ')}
                >
                  {opt.label}
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function ChevronDown({ open }: { open: boolean }): React.JSX.Element {
  return (
    <motion.svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      animate={{ rotate: open ? 180 : 0 }}
      transition={{ duration: 0.15 }}
    >
      <polyline points="6 9 12 15 18 9" />
    </motion.svg>
  )
}
