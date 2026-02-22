import { type InputHTMLAttributes, useState, useId } from 'react'

type InputVariant = 'borderless' | 'bordered'

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  type?: 'text' | 'password'
  variant?: InputVariant
  label?: string
  error?: string
}

const variantStyles: Record<InputVariant, string> = {
  borderless: [
    'w-full bg-transparent border-0 border-b border-border',
    'px-0 py-3 text-lg',
    'focus:border-accent focus:outline-none',
    'placeholder:text-text-muted'
  ].join(' '),
  bordered: [
    'w-full bg-bg-surface border border-border rounded-lg',
    'px-4 py-2.5 text-sm',
    'focus:border-border-hover focus:outline-none',
    'placeholder:text-text-muted'
  ].join(' ')
}

/**
 * Text/password input with borderless (onboarding) and bordered (settings) variants.
 *
 * @example
 * <Input variant="borderless" label="API Key" type="password" />
 */
export function Input({
  type = 'text',
  variant = 'bordered',
  label,
  error,
  className = '',
  id,
  ...rest
}: InputProps): React.JSX.Element {
  const autoId = useId()
  const inputId = id ?? autoId
  const [showPassword, setShowPassword] = useState(false)

  const resolvedType = type === 'password' && showPassword ? 'text' : type

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-text-muted">
          {label}
        </label>
      )}

      <div className="relative">
        <input
          id={inputId}
          type={resolvedType}
          className={[
            variantStyles[variant],
            'text-text-main transition-colors',
            error && 'border-error',
            className
          ]
            .filter(Boolean)
            .join(' ')}
          {...rest}
        />

        {type === 'password' && (
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-main"
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>

      {error && (
        <span className="text-xs text-error">{error}</span>
      )}
    </div>
  )
}

function EyeIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}
