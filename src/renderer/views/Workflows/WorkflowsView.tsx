import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/api'
import {
  getNodeDefinition,
  getDefaultConfig,
  hasMissingRequired,
  type ExtendedNodeType,
  type NodeConfigField,
} from './node-registry'
import { WORKFLOW_TEMPLATES, expandTemplate, type WorkflowTemplate } from './workflow-templates'

/* ── Types ─────────────────────────────────────────────── */

interface WorkflowNode {
  id: string
  type: ExtendedNodeType
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

/* ── Helpers ──────────────────────────────────────────── */

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

const TEXTAREA_LINE_HEIGHT = 20
const TEXTAREA_MAX_LINES = 6

/**
 * Full-screen n8n-style workflow builder.
 * Magic bar (bottom) → AI generates graph → visual nodes with wires → inspector panel → save/schedule.
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
  const [showTemplates, setShowTemplates] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    drawWires()
  }, [nodes])

  useEffect(() => {
    const handleResize = (): void => { drawWires() }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [nodes])

  /* ── Auto-resize textarea ───────────────────────── */

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const maxH = TEXTAREA_LINE_HEIGHT * TEXTAREA_MAX_LINES
    el.style.height = `${Math.min(el.scrollHeight, maxH)}px`
  }, [])

  useEffect(() => {
    resizeTextarea()
  }, [prompt, resizeTextarea])

  /* ── Wire drawing ───────────────────────────────── */

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

  /* ── Graph generation ───────────────────────────── */

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
          setGenerating(false)
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

  /* ── Template loading ───────────────────────────── */

  const loadTemplate = (template: WorkflowTemplate): void => {
    const expanded = expandTemplate(template)
    setPrompt(expanded.prompt)
    setNodes(expanded.nodes as WorkflowNode[])
    setShowTemplates(false)
    setTimeout(drawWires, 50)
  }

  /* ── Node interactions ──────────────────────────── */

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
        const updatedConfig = { ...n.config, [key]: value }
        return {
          ...n,
          config: updatedConfig,
          missing: hasMissingRequired(n.type, updatedConfig),
        }
      })
    )
    if (panel.open && panel.node.id === nodeId) {
      const updatedConfig = { ...panel.node.config, [key]: value }
      setPanel({
        open: true,
        node: {
          ...panel.node,
          config: updatedConfig,
          missing: hasMissingRequired(panel.node.type, updatedConfig),
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

  /* ── Save workflow ──────────────────────────────── */

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

  /* ── Inspector field renderer ───────────────────── */

  const renderConfigField = (field: NodeConfigField, nodeId: string, value: string): React.JSX.Element => {
    const commonStyle = {
      width: '100%',
      background: 'var(--color-bg-base)',
      border: '1px solid var(--color-border)',
      color: 'var(--color-text-main)',
      padding: 10,
      borderRadius: 6,
      fontSize: 12,
      outline: 'none' as const,
    }

    if (field.type === 'select' && field.options) {
      return (
        <select
          value={value}
          onChange={(e) => updateNodeConfig(nodeId, field.key, e.target.value)}
          style={{ ...commonStyle, fontFamily: 'var(--font-sans)' }}
        >
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )
    }

    if (field.type === 'textarea') {
      return (
        <textarea
          value={value}
          onChange={(e) => updateNodeConfig(nodeId, field.key, e.target.value)}
          placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}...`}
          rows={3}
          style={{
            ...commonStyle,
            fontFamily: 'var(--font-mono)',
            resize: 'vertical',
            minHeight: 60,
          }}
        />
      )
    }

    if (field.type === 'number') {
      return (
        <input
          type="number"
          value={value}
          onChange={(e) => updateNodeConfig(nodeId, field.key, e.target.value)}
          placeholder={field.placeholder ?? '0'}
          style={{ ...commonStyle, fontFamily: 'var(--font-mono)' }}
        />
      )
    }

    return (
      <input
        type={field.type === 'password' ? 'password' : 'text'}
        value={value}
        onChange={(e) => updateNodeConfig(nodeId, field.key, e.target.value)}
        placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}...`}
        style={{ ...commonStyle, fontFamily: 'var(--font-mono)' }}
      />
    )
  }

  /* ── Get config fields for inspector ────────────── */

  const getInspectorFields = (node: WorkflowNode): NodeConfigField[] => {
    const def = getNodeDefinition(node.type)
    if (def) return def.configFields
    // Fallback: derive fields from config keys
    return Object.keys(node.config).map((key) => ({
      key,
      label: key,
      type: (key.includes('token') || key.includes('key') || key.includes('secret') ? 'password' : 'text') as NodeConfigField['type'],
    }))
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden" style={{ background: 'var(--color-canvas-bg, #050505)' }}>
      <style>{`@keyframes wireFlow { to { stroke-dashoffset: -16; } }`}</style>

      {/* Canvas */}
      <div ref={canvasRef} className="relative flex-1" style={{ paddingBottom: 140 }}>
        <svg ref={svgRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }} />

        {/* Nodes */}
        <div style={{ position: 'relative', zIndex: 2, height: '100%' }}>
          {nodes.length === 0 && !generating && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <div style={{ textAlign: 'center', maxWidth: 400 }}>
                <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.1 }}>&#9671;</div>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 14, lineHeight: 1.6 }}>
                  Describe what you want to automate. The AI will generate a visual workflow
                  using OpenClaw&apos;s available models, skills, and browser automation.
                </p>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 12, opacity: 0.6 }}>
                  Or pick a template below to get started quickly.
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
                    <path d={node.icon} />
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

      {/* Bottom action bar: Regenerate + Save (only when nodes exist) */}
      {nodes.length > 0 && (
        <div style={{
          position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)',
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
              padding: '10px 20px',
              fontSize: 12,
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
              padding: '10px 28px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Save &amp; Schedule
          </button>
        </div>
      )}

      {/* Magic Bar — positioned at BOTTOM */}
      <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', width: 'min(680px, 92%)', zIndex: 20 }}>
        {/* Templates dropdown (opens ABOVE the bar) */}
        <AnimatePresence>
          {showTemplates && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              style={{
                marginBottom: 8,
                background: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 10,
                padding: 8,
                maxHeight: 280,
                overflowY: 'auto',
                backdropFilter: 'blur(20px)',
              }}
            >
              <div style={{ padding: '4px 8px 8px', fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Workflow Templates
              </div>
              {WORKFLOW_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => loadTemplate(tmpl)}
                  style={{
                    display: 'flex',
                    width: '100%',
                    flexDirection: 'column',
                    padding: '10px 12px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-text-main)',
                    borderRadius: 6,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-hover, rgba(255,255,255,0.05))' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{tmpl.name}</span>
                    <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'var(--color-accent, #6366f1)', color: '#fff', opacity: 0.8 }}>
                      {tmpl.category}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                    {tmpl.description}
                  </span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* History dropdown (opens ABOVE the bar) */}
        <AnimatePresence>
          {showList && savedWorkflows.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              style={{
                marginBottom: 8,
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
                    {wf.schedule ? `&#9201; ${wf.schedule}` : 'manual'} &middot; {wf.nodes.length} nodes
                  </span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 12,
            background: 'var(--color-bg-surface)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid var(--color-border)',
            borderRadius: 14,
            padding: '12px 16px',
            boxShadow: '0 -4px 30px rgba(0,0,0,0.4)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--color-text-main)', flexShrink: 0, marginBottom: 3 }}>
            <path d="M12 2l9 4.5v7l-9 4.5L3 13.5v-7L12 2z" />
            <path d="M12 22V13.5" />
            <path d="M3 6.5l9 4.5 9-4.5" />
          </svg>
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void generateGraph()
              }
            }}
            placeholder="Describe your workflow... e.g. 'search images on Google, upload to NanoBanano, then post to Instagram'"
            rows={1}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-main)',
              fontSize: 14,
              lineHeight: `${TEXTAREA_LINE_HEIGHT}px`,
              outline: 'none',
              fontFamily: 'var(--font-sans)',
              resize: 'none',
              overflow: 'auto',
              maxHeight: TEXTAREA_LINE_HEIGHT * TEXTAREA_MAX_LINES,
            }}
          />
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => { setShowTemplates(!showTemplates); setShowList(false) }}
              style={{
                background: showTemplates ? 'var(--color-accent, #6366f1)' : 'transparent',
                border: '1px solid var(--color-border)',
                color: showTemplates ? '#fff' : 'var(--color-text-muted)',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              Templates
            </button>
            <button
              type="button"
              onClick={() => { setShowList(!showList); setShowTemplates(false) }}
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
              {generating ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </div>
      </div>

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
              <button type="button" onClick={closePanel} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 18 }}>&times;</button>
            </div>

            {panel.node.missing && (
              <div style={{
                display: 'inline-flex', padding: '6px 10px', borderRadius: 6,
                background: 'rgba(255, 69, 58, 0.1)', border: '1px solid rgba(255, 69, 58, 0.3)',
                color: 'var(--color-danger)', fontSize: 11, fontWeight: 600, marginBottom: 20,
                alignItems: 'center', gap: 6,
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                Missing Required Fields
              </div>
            )}

            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 16, lineHeight: 1.4 }}>
              {panel.node.desc}
            </div>

            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>
              Type: {panel.node.type}
            </div>

            <div style={{ flex: 1 }}>
              {getInspectorFields(panel.node).map((field) => (
                <div key={field.key} style={{ marginBottom: 16 }}>
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6,
                    textTransform: 'uppercase', letterSpacing: '0.5px',
                  }}>
                    {field.label}
                    {field.required && (
                      <span style={{ color: 'var(--color-danger)', fontSize: 10 }}>*</span>
                    )}
                  </label>
                  {renderConfigField(field, panel.node.id, panel.node.config[field.key] ?? '')}
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
                Done
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
                {nodes.length} node(s) &middot; {nodes.filter((n) => n.missing).length === 0 ? 'All configured' : `${nodes.filter((n) => n.missing).length} missing credentials`}
                {(saveSchedule || customCron) && ` \u00B7 Will be added to OpenClaw cron scheduler`}
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

/* ── Enhanced local parser ─────────────────────────────── */

interface KeywordMatch {
  type: ExtendedNodeType
  keywords: string[]
  priority: number
}

const KEYWORD_MAP: KeywordMatch[] = [
  // Web — specific first
  { type: 'google-search', keywords: [
    'google search', 'search google', 'google',
    'חיפוש גוגל', 'חפש בגוגל', 'גוגל', 'לגוגל',
  ], priority: 10 },
  { type: 'web-scrape', keywords: [
    'scrape', 'crawl', 'extract from page', 'extract data',
    'download images', 'download photos', 'download files', 'download content',
    'get images', 'get photos', 'grab images', 'pull images', 'collect images',
    'תוריד תמונות', 'הורד תמונות', 'תוריד קבצים', 'הורד קבצים',
    'תוריד פוסטים', 'תאסוף תמונות', 'תאסוף מידע', 'חלץ מידע',
    'תוריד', 'להוריד', 'הורדה', 'לחלץ', 'לאסוף',
  ], priority: 8 },
  { type: 'screenshot', keywords: [
    'screenshot', 'capture page', 'snapshot', 'screen capture',
    'צילום מסך', 'צלם מסך', 'תצלם',
  ], priority: 8 },
  { type: 'navigate', keywords: [
    'navigate', 'go to', 'visit', 'open url', 'browse', 'open page',
    'gologin', 'go login', 'go-login',
    'facebook', 'fb', 'פייסבוק', 'פיסבוק',
    'twitter', 'x.com',
    'linkedin', 'לינקדאין',
    'youtube', 'יוטיוב',
    'כנס ל', 'תכנס ל', 'היכנס ל', 'תיכנס', 'לגלוש', 'גלוש',
    'פתח', 'תפתח', 'לפתוח',
    'לפרופיל', 'פרופיל',
  ], priority: 5 },

  // Social — publishing / posting
  { type: 'instagram-post', keywords: [
    'instagram', 'insta', 'ig post', 'post to instagram', 'ig',
    'אינסטגרם', 'אינסטה', 'לאינסטגרם',
    'פרסום', 'לפרסם', 'תפרסם', 'פרסם', 'לפרסום', 'שלח לפרסום', 'תשלח לפרסום',
    'publish', 'post it', 'share it', 'upload post',
  ], priority: 10 },
  { type: 'telegram-send', keywords: [
    'telegram', 'tg', 'send telegram', 'telegram message',
    'טלגרם', 'לטלגרם', 'שלח בטלגרם', 'תשלח בטלגרם',
  ], priority: 10 },
  { type: 'tiktok-upload', keywords: [
    'tiktok', 'tik tok', 'tik-tok', 'post to tiktok',
    'טיקטוק', 'טיק טוק', 'לטיקטוק',
  ], priority: 10 },
  { type: 'whatsapp-send', keywords: [
    'whatsapp', 'whats app', 'send whatsapp',
    'וואטסאפ', 'ווטסאפ', 'וואצאפ', 'לוואטסאפ',
  ], priority: 10 },

  // Storage
  { type: 'nanobanano-upload', keywords: [
    'nanobanano', 'nano banano', 'nanobana', 'nano-banano',
    'ננו בננו', 'ננובננו', 'נאנו בננו', 'נאנובננו',
    'תעביר עם ננו', 'העבר עם ננו', 'העלה לננו',
  ], priority: 10 },
  { type: 's3-upload', keywords: [
    's3', 'aws s3', 'amazon s3', 'upload to s3',
    'אס3', 'העלה לאמזון',
  ], priority: 10 },
  { type: 'gdrive-upload', keywords: [
    'google drive', 'gdrive', 'drive upload',
    'גוגל דרייב', 'דרייב', 'לדרייב',
  ], priority: 10 },

  // AI — specific
  { type: 'openai-generate', keywords: [
    'openai', 'gpt', 'chatgpt', 'gpt-4', 'gpt4',
    'ג\'יפיטי',
  ], priority: 10 },
  { type: 'anthropic-generate', keywords: [
    'anthropic', 'claude', 'קלוד',
  ], priority: 10 },
  { type: 'ai-summarize', keywords: [
    'summarize', 'summary', 'tldr', 'shorten',
    'סכם', 'תסכם', 'סיכום', 'לסכם', 'תקצר', 'לקצר',
  ], priority: 8 },
  { type: 'ai-analyze', keywords: [
    'analyze', 'analysis', 'classify', 'categorize',
    'נתח', 'תנתח', 'ניתוח', 'לנתח', 'מיין', 'תמיין', 'לסווג',
  ], priority: 8 },

  // Generic
  { type: 'api', keywords: [
    'api', 'webhook', 'endpoint', 'rest', 'fetch url',
  ], priority: 4 },
  { type: 'agent', keywords: [
    'agent', 'ai agent', 'think', 'decision',
    'סוכן', 'אייג\'נט',
  ], priority: 3 },
]

/**
 * Split prompt into semantic "steps" separated by commas, periods, "then", "after that",
 * or Hebrew equivalents like "אחרי זה", "ואז", "אח״כ".
 * Each segment is matched independently so the same type can appear in different steps.
 */
function splitIntoSteps(prompt: string): { text: string; startOffset: number }[] {
  // Split on common step delimiters (keep track of character offsets)
  const delimiters = /[,;.]|\bthen\b|\bafter that\b|\bnext\b|\band then\b|אחרי זה|אח"כ|אח״כ|ואז|לאחר מכן|אחר כך/gi
  const steps: { text: string; startOffset: number }[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = delimiters.exec(prompt)) !== null) {
    const segment = prompt.slice(lastIndex, match.index).trim()
    if (segment.length > 0) {
      steps.push({ text: segment, startOffset: lastIndex })
    }
    lastIndex = match.index + match[0].length
  }
  // Last segment
  const remaining = prompt.slice(lastIndex).trim()
  if (remaining.length > 0) {
    steps.push({ text: remaining, startOffset: lastIndex })
  }

  return steps.length > 0 ? steps : [{ text: prompt, startOffset: 0 }]
}

function generateLocalNodes(prompt: string): WorkflowNode[] {
  const lower = prompt.toLowerCase()
  const steps = splitIntoSteps(lower)
  const matched: { type: ExtendedNodeType; index: number }[] = []

  // Match each step against keyword map
  for (const step of steps) {
    let bestMatch: { type: ExtendedNodeType; priority: number; kwIndex: number } | null = null

    for (const km of KEYWORD_MAP) {
      for (const kw of km.keywords) {
        const idx = step.text.indexOf(kw)
        if (idx !== -1) {
          // Skip if this type was already matched (dedup)
          if (matched.some((m) => m.type === km.type)) break
          // Pick highest priority match within this step
          if (!bestMatch || km.priority > bestMatch.priority) {
            bestMatch = { type: km.type, priority: km.priority, kwIndex: step.startOffset + idx }
          }
          break
        }
      }
    }

    if (bestMatch && !matched.some((m) => m.type === bestMatch!.type)) {
      matched.push({ type: bestMatch.type, index: bestMatch.kwIndex })
    }
  }

  // Also do a full-prompt scan for any remaining keywords not yet matched
  for (const km of KEYWORD_MAP) {
    if (matched.some((m) => m.type === km.type)) continue
    for (const kw of km.keywords) {
      const idx = lower.indexOf(kw)
      if (idx !== -1) {
        matched.push({ type: km.type, index: idx })
        break
      }
    }
  }

  // Sort by position in the prompt (preserves user's intended order)
  matched.sort((a, b) => a.index - b.index)

  const nodes: WorkflowNode[] = []
  let xPos = 80

  for (const m of matched) {
    const def = getNodeDefinition(m.type)
    if (!def) continue
    const config = getDefaultConfig(m.type)
    nodes.push({
      id: `n${nodes.length + 1}`,
      type: m.type,
      title: def.title,
      desc: def.description,
      x: xPos,
      y: 180,
      icon: def.iconPath,
      config,
      missing: hasMissingRequired(m.type, config),
    })
    xPos += 340
  }

  // Fallback: if nothing matched, create agent + channel
  if (nodes.length === 0) {
    const agentDef = getNodeDefinition('agent')!
    const agentConfig = { ...getDefaultConfig('agent'), message: prompt }
    nodes.push({
      id: 'n1',
      type: 'agent',
      title: agentDef.title,
      desc: agentDef.description,
      x: 80,
      y: 180,
      icon: agentDef.iconPath,
      config: agentConfig,
      missing: hasMissingRequired('agent', agentConfig),
    })

    const channelDef = getNodeDefinition('channel')!
    const channelConfig = getDefaultConfig('channel')
    nodes.push({
      id: 'n2',
      type: 'channel',
      title: channelDef.title,
      desc: channelDef.description,
      x: 420,
      y: 180,
      icon: channelDef.iconPath,
      config: channelConfig,
      missing: hasMissingRequired('channel', channelConfig),
    })
  }

  return nodes
}
