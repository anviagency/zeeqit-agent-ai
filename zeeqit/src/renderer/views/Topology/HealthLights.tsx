import { GreenLight } from '@/components/ui/GreenLight'

interface HealthLightsData {
  zeeqitService: { status: 'green' | 'red' | 'yellow'; tooltip: string }
  openclawGateway: { status: 'green' | 'red' | 'yellow'; tooltip: string }
  browserEngine: { status: 'green' | 'red' | 'yellow'; tooltip: string }
}

interface HealthLightsProps {
  data?: HealthLightsData
}

const defaults: HealthLightsData = {
  zeeqitService: { status: 'green', tooltip: 'Daemon running' },
  openclawGateway: { status: 'green', tooltip: 'WebSocket connected' },
  browserEngine: { status: 'yellow', tooltip: 'No active sessions' },
}

/**
 * Three health indicator lights displayed in the Topology header.
 */
export function HealthLights({ data = defaults }: HealthLightsProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-5">
      <GreenLight
        status={data.zeeqitService.status}
        label="Zeeqit"
        tooltip={data.zeeqitService.tooltip}
      />
      <GreenLight
        status={data.openclawGateway.status}
        label="Gateway"
        tooltip={data.openclawGateway.tooltip}
      />
      <GreenLight
        status={data.browserEngine.status}
        label="Browser"
        tooltip={data.browserEngine.tooltip}
      />
    </div>
  )
}
