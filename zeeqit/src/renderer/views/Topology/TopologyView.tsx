import { useState, useEffect, useRef, useCallback } from 'react'
import { InspectorPanel } from './InspectorPanel'
import { HealthLights } from './HealthLights'

interface NodeDef {
  id: string
  label: string
  sublabel: string
  description: string
  icon: React.ReactNode
  x: string
  y: string
  targets?: string[]
}

const NODES: NodeDef[] = [
  {
    id: 'ingress',
    label: 'Ingress',
    sublabel: 'events.receive',
    description: 'Receives events from Telegram and CLI, parsing intent before passing to the Orchestrator.',
    icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
    x: '5%', y: '40%',
    targets: ['core'],
  },
  {
    id: 'core',
    label: 'Controller',
    sublabel: 'core.process',
    description: 'The brain. Handles TDD enforcement, routing logic, and prevents fake success.',
    icon: <><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></>,
    x: '35%', y: '40%',
    targets: ['memory', 'llm', 'browser'],
  },
  {
    id: 'memory',
    label: 'Memory',
    sublabel: 'vector.search',
    description: 'Local ChromaDB vector store for past plans, failure patterns, and optimized routing weights.',
    icon: <><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></>,
    x: '70%', y: '10%',
  },
  {
    id: 'llm',
    label: 'Router / API',
    sublabel: 'api.generate',
    description: 'Funnels requests to Claude or GPT based on task complexity and error rates.',
    icon: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
    x: '70%', y: '40%',
  },
  {
    id: 'browser',
    label: 'Playwright',
    sublabel: 'cdp.connect',
    description: 'Controls real UI sessions via GoLogin persistent profiles for un-APIfiable tasks.',
    icon: <><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></>,
    x: '70%', y: '70%',
  },
]

/**
 * Live topology canvas matching the spec HTML design.
 * Features SVG bezier curves, animated data packets, and slide-in inspector.
 */
export function TopologyView(): React.JSX.Element {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [lines, setLines] = useState<{ from: string; to: string; d: string }[]>([])
  const [activeWire, setActiveWire] = useState<string | null>(null)

  const selectedNode = NODES.find((n) => n.id === selectedId)

  const drawLines = useCallback(() => {
    if (!canvasRef.current) return
    const canvasRect = canvasRef.current.getBoundingClientRect()
    const newLines: typeof lines = []

    NODES.forEach((node) => {
      if (!node.targets) return
      const el = document.getElementById(`topo-${node.id}`)
      if (!el) return
      const startRect = el.getBoundingClientRect()
      const startX = startRect.right - canvasRect.left
      const startY = startRect.top - canvasRect.top + startRect.height / 2

      node.targets.forEach((targetId) => {
        const targetEl = document.getElementById(`topo-${targetId}`)
        if (!targetEl) return
        const endRect = targetEl.getBoundingClientRect()
        const endX = endRect.left - canvasRect.left
        const endY = endRect.top - canvasRect.top + endRect.height / 2

        const d = `M ${startX} ${startY} C ${startX + 80} ${startY}, ${endX - 80} ${endY}, ${endX} ${endY}`
        newLines.push({ from: node.id, to: targetId, d })
      })
    })

    setLines(newLines)
  }, [])

  useEffect(() => {
    const timer = setTimeout(drawLines, 100)
    window.addEventListener('resize', drawLines)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', drawLines)
    }
  }, [drawLines])

  useEffect(() => {
    if (lines.length === 0) return
    const interval = setInterval(() => {
      if (!canvasRef.current || !svgRef.current) return
      const line = lines[Math.floor(Math.random() * lines.length)]
      setActiveWire(line.from + '-' + line.to)
      setTimeout(() => setActiveWire(null), 500)

      const pathEl = svgRef.current.querySelector(`[data-wire="${line.from}-${line.to}"]`) as SVGPathElement | null
      if (!pathEl || !canvasRef.current) return

      const packet = document.createElement('div')
      packet.style.cssText = 'width:5px;height:5px;border-radius:50%;position:absolute;z-index:2;pointer-events:none;transform:translate(-50%,-50%);background:var(--packet-bg);box-shadow:0 0 10px var(--packet-glow);'
      canvasRef.current.appendChild(packet)

      const pathLength = pathEl.getTotalLength()
      let start: number | null = null
      const duration = 800

      function animate(time: number): void {
        if (!start) start = time
        const progress = (time - start) / duration
        if (progress < 1 && pathEl) {
          const point = pathEl.getPointAtLength(progress * pathLength)
          packet.style.left = point.x + 'px'
          packet.style.top = point.y + 'px'
          requestAnimationFrame(animate)
        } else {
          packet.remove()
        }
      }
      requestAnimationFrame(animate)
    }, 1800)

    return () => clearInterval(interval)
  }, [lines])

  const handleNodeClick = (node: NodeDef): void => {
    setSelectedId((prev) => (prev === node.id ? null : node.id))
    if (node.targets) {
      setActiveWire(node.id + '-' + (node.targets[0] ?? ''))
      setTimeout(() => setActiveWire(null), 500)
    }
  }

  const handleCanvasClick = (e: React.MouseEvent): void => {
    if (e.target === canvasRef.current || (e.target as Element).tagName === 'svg') {
      setSelectedId(null)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-10 py-5" style={{ borderColor: 'var(--color-border)' }}>
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-text-main">Live Topology</h1>
          <p className="mt-1 text-sm text-text-muted">System execution paths and data flow in real-time.</p>
        </div>
        <HealthLights />
      </div>

      <div
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="relative flex-1 m-6 rounded-xl border overflow-hidden"
        style={{
          borderColor: 'var(--color-border)',
          background: 'var(--color-canvas-bg)',
          minHeight: '500px',
          transition: 'border-color 0.3s, background 0.3s',
        }}
      >
        {/* SVG wires */}
        <svg ref={svgRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
          {lines.map((line) => (
            <path
              key={`${line.from}-${line.to}`}
              data-wire={`${line.from}-${line.to}`}
              d={line.d}
              fill="none"
              strokeWidth="1.5"
              style={{
                stroke: activeWire === `${line.from}-${line.to}`
                  ? `rgba(var(--ambient-rgb), 0.4)`
                  : 'var(--color-border)',
                transition: 'stroke 0.3s',
              }}
            />
          ))}
        </svg>

        {/* Nodes */}
        {NODES.map((node) => {
          const isSelected = selectedId === node.id
          return (
            <div
              key={node.id}
              id={`topo-${node.id}`}
              onClick={(e) => { e.stopPropagation(); handleNodeClick(node) }}
              className="absolute flex items-center gap-4 cursor-pointer rounded-xl border p-4 transition-all"
              style={{
                left: node.x,
                top: node.y,
                minWidth: '200px',
                background: 'var(--color-bg-surface)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                borderColor: isSelected ? 'var(--color-accent)' : 'var(--color-border)',
                boxShadow: isSelected
                  ? `0 0 0 1px var(--color-accent), var(--shadow-lg)`
                  : 'var(--shadow-lg)',
                zIndex: 10,
                transform: 'translateY(0)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg border"
                style={{
                  borderColor: isSelected ? 'var(--color-text-main)' : 'var(--color-border)',
                  color: isSelected ? 'var(--color-bg-base)' : 'var(--color-text-muted)',
                  background: isSelected ? 'var(--color-text-main)' : 'transparent',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {node.icon}
                </svg>
              </div>
              <div>
                <h4 className="text-[13px] font-medium text-text-main">{node.label}</h4>
                <p className="text-[11px] font-mono text-text-muted">{node.sublabel}</p>
              </div>
            </div>
          )
        })}

        {/* Inspector panel */}
        <div
          className="absolute right-5 top-5 bottom-5 w-[300px] flex flex-col rounded-xl border p-6 transition-transform duration-400"
          style={{
            background: 'var(--color-bg-surface)',
            backdropFilter: 'blur(20px)',
            borderColor: 'var(--color-border)',
            zIndex: 20,
            transform: selectedNode ? 'translateX(0)' : 'translateX(120%)',
            transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div
            className="mb-6 border-b pb-3 text-sm font-semibold uppercase tracking-wider text-text-muted"
            style={{ borderColor: 'var(--color-border)' }}
          >
            {selectedNode?.label ?? 'Node Details'}
          </div>

          <div className="mb-4">
            <div className="text-[11px] text-text-muted mb-1">Status</div>
            <div className="text-[13px] font-mono text-success">Running</div>
          </div>

          <div
            className="text-[13px] leading-relaxed text-text-muted mt-6 pt-6 border-t"
            style={{ borderColor: 'var(--color-border)' }}
          >
            {selectedNode?.description ?? 'Select a node to view its configuration and live trace.'}
          </div>

          <div
            className="mt-auto rounded-lg border p-3 font-mono text-[10px] text-text-muted overflow-y-auto"
            style={{
              background: 'var(--color-term-bg)',
              borderColor: 'var(--color-border)',
              height: '120px',
              transition: 'background 0.3s, border-color 0.3s',
            }}
          >
            <div className="mb-1">{`> System trace initialized.`}</div>
            {selectedNode && (
              <div className="mb-1">
                {`> `}<span className="text-success font-bold">[PING]</span>{` ${selectedNode.label} selected...`}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
