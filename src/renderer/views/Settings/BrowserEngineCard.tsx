import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

/**
 * GoLogin browser engine settings card.
 */
export function BrowserEngineCard(): React.JSX.Element {
  const [token, setToken] = useState('')
  const [validating, setValidating] = useState(false)

  const handleValidate = async (): Promise<void> => {
    try {
      setValidating(true)
      await window.zeeqitApi.gologin.validate(token)
    } catch {
      // error handling delegated to global error boundary
    } finally {
      setValidating(false)
    }
  }

  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold text-text-main">Browser Engine</h3>
      <p className="mt-1 text-xs text-text-muted">GoLogin anti-detect browser integration.</p>

      <div className="mt-5 space-y-4">
        <Input
          label="GoLogin API Token"
          type="password"
          placeholder="Enter your GoLogin token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />

        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            loading={validating}
            onClick={handleValidate}
          >
            Validate Token
          </Button>
          <Button variant="secondary" size="sm">
            List Profiles
          </Button>
        </div>
      </div>
    </Card>
  )
}
