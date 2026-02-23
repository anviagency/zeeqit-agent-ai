import { type ReactNode, type HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

/**
 * Card container with surface background and border.
 *
 * @example
 * <Card className="p-6">Content here</Card>
 */
export function Card({
  children,
  className = '',
  ...rest
}: CardProps): React.JSX.Element {
  return (
    <div
      className={[
        'rounded-xl border border-border bg-bg-surface',
        className
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </div>
  )
}
