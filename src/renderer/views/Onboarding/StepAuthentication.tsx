import { useOnboardingStore } from '@/store/onboarding.store'

const GOLOGIN_AFFILIATE_URL = 'https://gologin.com/join/zeeqit-IILQREB'

/**
 * Step 3: External service authentication.
 * Conditionally shows fields based on modules selected in Step 1.
 * Matches the spec HTML with giant borderless inputs and affiliate button.
 */
export function StepAuthentication(): React.JSX.Element {
  const { modules, auth, setAuth } = useOnboardingStore()

  const showBrowser = modules.browser
  const showTelegram = modules.telegram
  const showApify = modules.apify
  const hasExternal = showBrowser || showTelegram || showApify

  return (
    <div>
      {showBrowser && (
        <div style={{ marginBottom: 40 }}>
          <label
            style={{
              display: 'block',
              fontSize: '0.9rem',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              color: '#666',
              marginBottom: 12,
            }}
          >
            GoLogin API Token
          </label>
          <input
            type="password"
            placeholder="Paste your token here"
            value={auth.gologinToken}
            onChange={(e) => setAuth('gologinToken', e.target.value)}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              borderBottom: '2px solid rgba(255,255,255,0.2)',
              color: '#fff',
              fontSize: '2rem',
              padding: '10px 0',
              outline: 'none',
              fontWeight: 500,
              letterSpacing: '-0.5px',
              transition: 'border-color 0.3s ease',
              fontFamily: 'inherit',
            }}
            onFocus={(e) => { e.currentTarget.style.borderBottomColor = '#fff' }}
            onBlur={(e) => { e.currentTarget.style.borderBottomColor = 'rgba(255,255,255,0.2)' }}
          />

          {/* Affiliate button */}
          <a
            href={GOLOGIN_AFFILIATE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 no-underline transition-all"
            style={{
              marginTop: 16,
              padding: '10px 16px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              color: '#666',
              fontSize: '0.85rem',
              fontWeight: 500,
              width: 'max-content',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
              e.currentTarget.style.color = '#fff'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
              e.currentTarget.style.color = '#666'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
            }}
          >
            Don&apos;t have an account? Get GoLogin
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>
      )}

      {showTelegram && (
        <div style={{ marginTop: showBrowser ? 60 : 0, marginBottom: 40 }}>
          <label
            style={{
              display: 'block',
              fontSize: '0.9rem',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              color: '#666',
              marginBottom: 12,
            }}
          >
            Telegram Bot Token
          </label>
          <input
            type="password"
            placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
            value={auth.telegramToken}
            onChange={(e) => setAuth('telegramToken', e.target.value)}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              borderBottom: '2px solid rgba(255,255,255,0.2)',
              color: '#fff',
              fontSize: '2rem',
              padding: '10px 0',
              outline: 'none',
              fontWeight: 500,
              letterSpacing: '-0.5px',
              transition: 'border-color 0.3s ease',
              fontFamily: 'inherit',
            }}
            onFocus={(e) => { e.currentTarget.style.borderBottomColor = '#fff' }}
            onBlur={(e) => { e.currentTarget.style.borderBottomColor = 'rgba(255,255,255,0.2)' }}
          />
        </div>
      )}

      {showApify && (
        <div style={{ marginTop: (showBrowser || showTelegram) ? 60 : 0, marginBottom: 40 }}>
          <label
            style={{
              display: 'block',
              fontSize: '0.9rem',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              color: '#666',
              marginBottom: 12,
            }}
          >
            Apify API Token
          </label>
          <input
            type="password"
            placeholder="apify_api_..."
            value={auth.apifyToken}
            onChange={(e) => setAuth('apifyToken', e.target.value)}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              borderBottom: '2px solid rgba(255,255,255,0.2)',
              color: '#fff',
              fontSize: '2rem',
              padding: '10px 0',
              outline: 'none',
              fontWeight: 500,
              letterSpacing: '-0.5px',
              transition: 'border-color 0.3s ease',
              fontFamily: 'inherit',
            }}
            onFocus={(e) => { e.currentTarget.style.borderBottomColor = '#fff' }}
            onBlur={(e) => { e.currentTarget.style.borderBottomColor = 'rgba(255,255,255,0.2)' }}
          />
        </div>
      )}

      {!hasExternal && (
        <div style={{ fontSize: '2rem', color: '#666' }}>
          No external dependencies selected. Ready to deploy.
        </div>
      )}
    </div>
  )
}
