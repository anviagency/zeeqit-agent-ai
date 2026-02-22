interface AffiliateLinkProps {
  href: string
  label: string
  prompt?: string
  className?: string
}

/**
 * Styled external link that opens in the system browser.
 * Renders as a small button-like element with an arrow icon.
 *
 * @example
 * <AffiliateLink
 *   href="https://gologin.com/join/zeeqit-IILQREB"
 *   prompt="Don't have an account?"
 *   label="Get GoLogin"
 * />
 */
export function AffiliateLink({
  href,
  label,
  prompt,
  className = ''
}: AffiliateLinkProps): React.JSX.Element {
  const handleClick = (): void => {
    window.open(href, '_blank')
  }

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs text-text-muted ${className}`}>
      {prompt && <span>{prompt}</span>}
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-text-main transition-colors hover:border-border-hover hover:bg-bg-hover"
      >
        {label}
        <ArrowUpRight />
      </button>
    </span>
  )
}

function ArrowUpRight(): React.JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  )
}
