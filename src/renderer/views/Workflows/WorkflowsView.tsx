import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/api'

/* ── Types ─────────────────────────────────────────────── */

interface WorkflowNode {
  id: string
  type: 'browser' | 'system' | 'api' | 'agent' | 'channel'
  title: string
  desc: string
  x: number
  y: number
  icon: string
  config: Record<string, string>
  missing: boolean
}

interface SavedWorkflow {
  id: string
  name: string
  prompt: string
  nodes: WorkflowNode[]
  schedule: string | null
  createdAt: string
}

type PanelState = { open: false } | { open: true; node: WorkflowNode }

/* ── Icon paths (SVG path d-strings) ──────────────────── */

const NODE_ICONS: Record<string, string> = {
  browser: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
  system: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  api: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
  agent: 'M12 2l9 4.5v7l-9 4.5L3 13.5v-7L12 2zM12 22V13.5M3 6.5l9 4.5 9-4.5',
  channel: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z',
}

/* ── Helpers ──────────────────────────────────────────── */

function nodeIcon(type: string): string {
  return NODE_ICONS[type] ?? NODE_ICONS.agent
}

const SCHEDULE_OPTIONS = [
  { value: '', label: 'No schedule (manual)' },
  { value: '*/5 * * * *', label: 'Every 5 minutes' },
  { value: '*/15 * * * *', label: 'Every 15 minutes' },
  { value: '*/30 * * * *', label: 'Every 30 minutes' },
  { value: '0 * * * *', label: 'Every hour' },
  { value: '0 */6 * * *', label: 'Every 6 hours' },
  { value: '0 0 * * *', label: 'Daily at midnight' },
  { value: '0 9 * * 1-5', label: 'Weekdays at 9am' },
  { value: 'custom', label: 'Custom cron...' },
]

/**
 * Full-screen n8n-style workflow builder.
 * Magic bar → AI generates graph → visual nodes with wires → inspector panel → save/schedule.
 */
export function WorkflowsView(): React.JSX.Element {
  const [nodes, setNodes] = useState<WorkflowNode[]>([])
  const [panel, setPanel] = useState<PanelState>({ open: false })
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [savedWorkflows, setSavedWorkflows] = useState<SavedWorkflow[]>([])
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveSchedule, setSaveSchedule] = useState('')
  const [customCron, setCustomCron] = useState('')
  const [saving, setSaving] = useState(false)
  const [showList, setShowList] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    drawWires()
  }, [nodes])

  useEffect(() => {
    const handleResize = (): void => { drawWires() }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [nodes])

  const drawWires = useCallback(() => {
    const svg = svgRef.current
    const canvas = canvasRef.current
    if (!svg || !canvas || nodes.length < 2) {
      if (svg) svg.innerHTML = ''
      return
    }

    svg.innerHTML = ''
    const canvasRect = canvas.getBoundingClientRect()

    for (let i = 0; i < nodes.length - 1; i++) {
      const n1El = canvas.querySelector(`[data-node-id="${nodes[i].id}"]`) as HTMLElement | null
      const n2El = canvas.querySelector(`[data-node-id="${nodes[i + 1].id}"]`) as HTMLElement | null
      if (!n1El || !n2El) continue

      const r1 = n1El.getBoundingClientRect()
      const r2 = n2El.getBoundingClientRect()

      const x1 = r1.right - canvasRect.left - 22
      const y1 = r1.bottom - canvasRect.top - 16
      const x2 = r2.left - canvasRect.left + 22
      const y2 = r2.bottom - canvasRect.top - 16

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path.setAttribute('d', `M ${x1} ${y1} C ${x1} ${y1 + 60}, ${x2} ${y2 + 60}, ${x2} ${y2}`)
      path.setAttribute('fill', 'none')
      path.setAttribute('stroke', 'rgba(255,255,255,0.1)')
      path.setAttribute('stroke-width', '2')
      path.setAttribute('stroke-dasharray', '8')
      path.style.animation = 'wireFlow 1s linear infinite'
      svg.appendChild(path)
    }
  }, [nodes])

  const generateGraph = async (): Promise<void> => {
    if (!prompt.trim() || generating) return
    setGenerating(true)
    setNodes([])
    setPanel({ open: false })

    try {
      const result = await api.workflow.create({
        prompt: prompt.trim(),
        action: 'generate-graph',
      })

      if (result.success && result.data) {
        const data = result.data as { nodes?: WorkflowNode[] }
        if (data.nodes && data.nodes.length > 0) {
          setNodes(data.nodes)
          return
        }
      }
    } catch {
      // fallback to local generation
    }

    const generatedNodes = generateLocalNodes(prompt.trim())
    setNodes(generatedNodes)
    setGenerating(false)
  }

  const selectNode = (node: WorkflowNode): void => {
    setSelectedNodeId(node.id)
    setPanel({ open: true, node })
  }

  const closePanel = (): void => {
    setPanel({ open: false })
    setSelectedNodeId(null)
  }

  const updateNodeConfig = (nodeId: string, key: string, value: string): void => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== nodeId) return n
        const updated = { ...n, config: { ...n.config, [key]: value } }
        if (n.missing && value.trim()) {
          const stillMissing = Object.values(updated.config).some((v) => !v.trim())
          updated.missing = stillMissing
        }
        return updated
      })
    )
    if (panel.open && panel.node.id === nodeId) {
      setPanel({
        open: true,
        node: {
          ...panel.node,
          config: { ...panel.node.config, [key]: value },
          missing: panel.node.missing && !value.trim(),
        },
      })
    }
  }

  const deleteNode = (nodeId: string): void => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId))
    if (panel.open && panel.node.id === nodeId) {
      closePanel()
    }
  }

  const handleSave = async (): Promise<void> => {
    if (!saveName.trim() || nodes.length === 0) return
    setSaving(true)

    const schedule = saveSchedule === 'custom' ? customCron : saveSchedule

    try {
      await api.workflow.create({
        action: 'save',
        name: saveName.trim(),
        prompt,
        nodes,
        schedule: schedule || null,
      })

      const wf: SavedWorkflow = {
        id: `wf-${Date.now()}`,
        name: saveName.trim(),
        prompt,
        nodes,
        schedule: schedule || null,
        createdAt: new Date().toISOString(),
      }
      setSavedWorkflows((prev) => [wf, ...prev])
      setShowSaveModal(false)
      setSaveName('')
      setSaveSchedule('')
    } catch {
      // save failed
    } finally {
      setSaving(false)
    }
  }

  const loadWorkflow = (wf: SavedWorkflow): void => {
    setNodes(wf.nodes)
    setPrompt(wf.prompt)
    setShowList(false)
    setTimeout(drawWires, 50)
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden" style={{ background: 'var(--color-canvas-bg, #050505)' }}>
      <style>{`@keyframes wireFlow { to { stroke-dashoffset: -16; } }`}</style>

      {/* Magic Bar */}
      <div style={{ position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)', width: 'min(640px, 90%)', zIndex: 20 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'var(--color-bg-surface)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            padding: '12px 16px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--color-text-main)', flexShrink: 0 }}>
            <path d="M12 2l9 4.5v7l-9 4.5L3 13.5v-7L12 2z" />
            <path d="M12 22V13.5" />
            <path d="M3 6.5l9 4.5 9-4.5" />
          </svg>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void generateGraph() }}
            placeholder="e.g. 'Go to Google, download a cat image, and send to Telegram'"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-main)',
              fontSize: 14,
              outline: 'none',
              fontFamily: 'var(--font-sans)',
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setShowList(!showList)}
              style={{
                background: 'transparent',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-muted)',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {savedWorkflows.length > 0 ? `${savedWorkflows.length} saved` : 'History'}
            </button>
            <button
              type="button"
              onClick={() => void generateGraph()}
              disabled={generating || !prompt.trim()}
              style={{
                background: 'var(--color-text-main)',
                color: 'var(--color-bg-base)',
                border: 'none',
                borderRadius: 6,
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 600,
                cursor: generating ? 'wait' : 'pointer',
                opacity: generating || !prompt.trim() ? 0.5 : 1,
              }}
            >
              {generating ? 'Generating...' : 'Generate Graph'}
            </button>
          </div>
        </div>

        {/* Saved workflows dropdown */}
        <AnimatePresence>
          {showList && savedWorkflows.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              style={{
                marginTop: 8,
                background: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 10,
                padding: 8,
                maxHeight: 200,
                overflowY: 'auto',
                backdropFilter: 'blur(20px)',
              }}
            >
              {savedWorkflows.map((wf) => (
                <button
                  key={wf.id}
                  type="button"
                  onClick={() => loadWorkflow(wf)}
                  style={{
                    display: 'flex',
                    width: '100%',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-text-main)',
                    fontSize: 13,
                    borderRadius: 6,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span>{wf.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                    {wf.schedule ? `⏱ ${wf.schedule}` : 'manual'} · {wf.nodes.length} nodes
                  </span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Canvas */}
      <div ref={canvasRef} className="relative flex-1" style={{ paddingTop: 100 }}>
        <svg ref={svgRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }} />

        {/* Nodes */}
        <div style={{ position: 'relative', zIndex: 2, height: '100%' }}>
          {nodes.length === 0 && !generating && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <div style={{ textAlign: 'center', maxWidth: 400 }}>
                <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.1 }}>◇</div>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 14, lineHeight: 1.6 }}>
                  Describe what you want to automate. The AI will generate a visual workflow
                  using OpenClaw&apos;s available models, skills, and browser automation.
                </p>
              </div>
            </div>
          )}

          {generating && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <div style={{ textAlign: 'center' }}>
                <div className="animate-spin" style={{ width: 32, height: 32, border: '2px solid var(--color-border)', borderTopColor: 'var(--color-text-main)', borderRadius: '50%', margin: '0 auto 16px' }} />
                <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Translating intent to execution graph...</p>
              </div>
            </div>
          )}

          {nodes.map((node, idx) => (
            <motion.div
              key={node.id}
              data-node-id={node.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1, duration: 0.3 }}
              onClick={() => selectNode(node)}
              style={{
                position: 'absolute',
                left: node.x,
                top: node.y,
                width: 260,
                background: 'var(--color-bg-surface)',
                backdropFilter: 'blur(10px)',
                border: `1px solid ${node.missing ? 'var(--color-danger)' : selectedNodeId === node.id ? 'var(--color-text-main)' : 'var(--color-border)'}`,
                borderRadius: 12,
                boxShadow: selectedNodeId === node.id
                  ? '0 0 0 1px var(--color-text-main), 0 10px 30px rgba(0,0,0,0.5)'
                  : '0 10px 30px rgba(0,0,0,0.5)',
                cursor: 'pointer',
                transition: 'transform 0.2s, border-color 0.2s',
                zIndex: selectedNodeId === node.id ? 10 : 1,
              }}
              onMouseEnter={(e) => { if (selectedNodeId !== node.id) e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
            >
              {/* Header */}
              <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '12px 12px 0 0',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 6,
                  background: 'var(--color-bg-base)',
                  border: '1px solid var(--color-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={nodeIcon(node.type)} />
                  </svg>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{node.title}</span>
                <div style={{
                  marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%',
                  background: node.missing ? 'var(--color-danger)' : 'var(--color-success)',
                  boxShadow: node.missing ? '0 0 8px var(--color-danger)' : '0 0 8px var(--color-success)',
                }} />
              </div>

              {/* Body */}
              <div style={{ padding: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>{node.desc}</div>
              </div>

              {/* Ports */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 16px 16px' }}>
                <div style={{ width: 10, height: 10, background: 'var(--color-text-muted)', borderRadius: '50%', border: '2px solid var(--color-bg-base)' }} />
                <div style={{ width: 10, height: 10, background: 'var(--color-text-muted)', borderRadius: '50%', border: '2px solid var(--color-bg-base)' }} />
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Bottom bar: Save button */}
      {nodes.length > 0 && (
        <div style={{
          position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 12, zIndex: 20,
        }}>
          <button
            type="button"
            onClick={() => { void generateGraph() }}
            style={{
              background: 'transparent',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-main)',
              borderRadius: 100,
              padding: '12px 24px',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Regenerate
          </button>
          <button
            type="button"
            onClick={() => setShowSaveModal(true)}
            style={{
              background: 'var(--color-text-main)',
              color: 'var(--color-bg-base)',
              border: 'none',
              borderRadius: 100,
              padding: '12px 32px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Save & Schedule
          </button>
        </div>
      )}

      {/* Inspector Panel */}
      <AnimatePresence>
        {panel.open && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              position: 'absolute', right: 0, top: 0, bottom: 0, width: 360,
              background: 'var(--color-bg-surface)',
              backdropFilter: 'blur(20px)',
              borderLeft: '1px solid var(--color-border)',
              padding: 24,
              display: 'flex', flexDirection: 'column',
              zIndex: 30,
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: '1px solid var(--color-border)', paddingBottom: 12 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{panel.node.title}</span>
              <button type="button" onClick={closePanel} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 18 }}>×</button>
            </div>

            {panel.node.missing && (
              <div style={{
                display: 'inline-flex', padding: '6px 10px', borderRadius: 6,
                background: 'rgba(255, 69, 58, 0.1)', border: '1px solid rgba(255, 69, 58, 0.3)',
                color: 'var(--color-danger)', fontSize: 11, fontWeight: 600, marginBottom: 20,
                alignItems: 'center', gap: 6,
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                Missing Credentials
              </div>
            )}

            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 16, lineHeight: 1.4 }}>
              {panel.node.desc}
            </div>

            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
              Type: {panel.node.type}
            </div>

            <div style={{ flex: 1 }}>
              {Object.entries(panel.node.config).map(([key, val]) => (
                <div key={key} style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {key}
                  </label>
                  <input
                    type={key.includes('token') || key.includes('key') || key.includes('secret') ? 'password' : 'text'}
                    value={val}
                    onChange={(e) => updateNodeConfig(panel.node.id, key, e.target.value)}
                    placeholder={`Enter ${key}...`}
                    style={{
                      width: '100%',
                      background: 'var(--color-bg-base)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-main)',
                      padding: 10,
                      borderRadius: 6,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      outline: 'none',
                    }}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button
                type="button"
                onClick={() => deleteNode(panel.node.id)}
                style={{
                  flex: 1, padding: '10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', border: '1px solid rgba(255,69,58,0.3)',
                  background: 'transparent', color: 'var(--color-danger)',
                }}
              >
                Delete
              </button>
              <button
                type="button"
                onClick={closePanel}
                style={{
                  flex: 2, padding: '10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', border: 'none',
                  background: 'var(--color-text-main)', color: 'var(--color-bg-base)',
                }}
              >
                Save Settings
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save & Schedule Modal */}
      <AnimatePresence>
        {showSaveModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute', inset: 0, zIndex: 50,
              background: 'rgba(0,0,0,0.6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onClick={() => setShowSaveModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 440, padding: 32, borderRadius: 16,
                background: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
                backdropFilter: 'blur(20px)',
              }}
            >
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Save Workflow</h3>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 24 }}>
                Name your workflow and optionally set a recurring schedule via OpenClaw cron.
              </p>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Workflow Name
                </label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="e.g. Daily competitor price check"
                  style={{
                    width: '100%', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)',
                    color: 'var(--color-text-main)', padding: 10, borderRadius: 6, fontSize: 13, outline: 'none',
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Schedule
                </label>
                <select
                  value={saveSchedule}
                  onChange={(e) => setSaveSchedule(e.target.value)}
                  style={{
                    width: '100%', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)',
                    color: 'var(--color-text-main)', padding: 10, borderRadius: 6, fontSize: 13, outline: 'none',
                  }}
                >
                  {SCHEDULE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {saveSchedule === 'custom' && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Custom Cron Expression
                  </label>
                  <input
                    type="text"
                    value={customCron}
                    onChange={(e) => setCustomCron(e.target.value)}
                    placeholder="*/30 * * * *"
                    style={{
                      width: '100%', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)',
                      color: 'var(--color-text-main)', padding: 10, borderRadius: 6,
                      fontFamily: 'var(--font-mono)', fontSize: 12, outline: 'none',
                    }}
                  />
                </div>
              )}

              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 24, padding: '8px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)' }}>
                {nodes.length} node(s) · {nodes.filter((n) => n.missing).length === 0 ? 'All configured' : `${nodes.filter((n) => n.missing).length} missing credentials`}
                {(saveSchedule || customCron) && ` · Will be added to OpenClaw cron scheduler`}
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                  style={{
                    flex: 1, padding: 12, borderRadius: 8, fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', border: '1px solid var(--color-border)',
                    background: 'transparent', color: 'var(--color-text-main)',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving || !saveName.trim()}
                  style={{
                    flex: 2, padding: 12, borderRadius: 8, fontSize: 13, fontWeight: 600,
                    cursor: saving ? 'wait' : 'pointer', border: 'none',
                    background: 'var(--color-text-main)', color: 'var(--color-bg-base)',
                    opacity: saving || !saveName.trim() ? 0.5 : 1,
                  }}
                >
                  {saving ? 'Saving...' : 'Save Workflow'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * Generates workflow nodes locally by parsing the user's natural language prompt.
 * This is used as a fallback when the API is not available.
 */
function generateLocalNodes(prompt: string): WorkflowNode[] {
  const lower = prompt.toLowerCase()
  const nodes: WorkflowNode[] = []
  let xPos = 80

  const addNode = (type: WorkflowNode['type'], title: string, desc: string, config: Record<string, string>, missing = false): void => {
    nodes.push({
      id: `n${nodes.length + 1}`,
      type,
      title,
      desc,
      x: xPos,
      y: 180,
      icon: nodeIcon(type),
      config,
      missing,
    })
    xPos += 340
  }

  if (lower.includes('google') || lower.includes('search') || lower.includes('browse') || lower.includes('scrape') || lower.includes('website') || lower.includes('url') || lower.includes('navigate')) {
    const url = lower.includes('google') ? 'https://google.com' : 'https://example.com'
    addNode('browser', 'Browse URL', 'Navigate to URL and interact with page via GoLogin CDP bridge.', {
      url,
      selector: '',
      action: 'navigate + extract',
    })
  }

  if (lower.includes('download') || lower.includes('save') || lower.includes('extract') || lower.includes('collect')) {
    addNode('system', 'Extract Data', 'Extract structured data from page or download files.', {
      targetPath: '/tmp/zeeqit-data/',
      format: 'json',
    })
  }

  if (lower.includes('api') || lower.includes('webhook') || lower.includes('midjourney') || lower.includes('discord') || lower.includes('openai') || lower.includes('send to')) {
    addNode('api', 'API Call', 'Send data to external API endpoint.', {
      endpoint: '',
      method: 'POST',
      token: '',
    }, true)
  }

  if (lower.includes('telegram') || lower.includes('whatsapp') || lower.includes('message') || lower.includes('notify') || lower.includes('send')) {
    const channel = lower.includes('telegram') ? 'telegram' : lower.includes('whatsapp') ? 'whatsapp' : 'telegram'
    addNode('channel', `Send via ${channel.charAt(0).toUpperCase() + channel.slice(1)}`, `Deliver results to ${channel} channel via OpenClaw.`, {
      channel,
      target: '',
      messageTemplate: 'Results: {{data}}',
    })
  }

  if (lower.includes('agent') || lower.includes('analyze') || lower.includes('summarize') || lower.includes('think') || lower.includes('ai') || lower.includes('decision')) {
    addNode('agent', 'AI Agent', 'Run OpenClaw agent to process and analyze data.', {
      model: 'anthropic/claude-sonnet-4-20250514',
      message: prompt,
      thinking: 'medium',
    })
  }

  if (nodes.length === 0) {
    addNode('agent', 'AI Agent', 'Run OpenClaw agent with your instruction.', {
      model: 'anthropic/claude-sonnet-4-20250514',
      message: prompt,
      thinking: 'medium',
    })
    addNode('channel', 'Deliver Result', 'Send agent output to your preferred channel.', {
      channel: 'last',
      target: '',
      messageTemplate: '{{result}}',
    })
  }

  return nodes
}
