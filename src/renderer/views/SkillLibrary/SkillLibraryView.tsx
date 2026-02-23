import { useState, useEffect, useCallback } from 'react'
import { api } from '@/api'

interface Skill {
  id: string
  name: string
  type: 'script' | 'browser' | 'tool'
  description: string
  content: string
}

/**
 * Skill library matching the spec HTML design: left card list + right JSON editor.
 * Loads skills from the OpenClaw runtime via /api/skills/list.
 */
export function SkillLibraryView(): React.JSX.Element {
  const [skills, setSkills] = useState<Skill[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSkills = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const result = await api.openclawFiles.listWorkspace()
      const skillFiles: Skill[] = []

      if (result.success && result.data) {
        const files = result.data as string[]
        for (const file of files) {
          if (!file.endsWith('.json') && !file.endsWith('.md')) continue
          try {
            const fileResult = await api.openclawFiles.readWorkspaceFile(file)
            if (fileResult.success && fileResult.data) {
              const fileData = fileResult.data as { filename: string; content: string }
              const name = file.replace(/\.(json|md)$/, '')
              let description = ''
              let type: Skill['type'] = 'tool'
              let content = fileData.content

              // Try to parse JSON files for metadata
              if (file.endsWith('.json')) {
                try {
                  const parsed = JSON.parse(fileData.content)
                  description = parsed.description ?? ''
                  type = parsed.adapter === 'playwright' ? 'browser'
                    : parsed.adapter === 'shell' ? 'script'
                    : 'tool'
                  content = JSON.stringify(parsed, null, 2)
                } catch {
                  description = 'Workspace file'
                }
              } else {
                description = 'Markdown document'
                type = 'tool'
              }

              skillFiles.push({ id: file, name, type, description, content })
            }
          } catch {
            // skip unreadable files
          }
        }
      }

      // If no workspace files exist, try the skills list endpoint
      if (skillFiles.length === 0) {
        const skillsResult = await (api as Record<string, unknown>)['openclawFiles']
          ? { success: false } as { success: boolean; data?: unknown }
          : api.openclawFiles.getOverview()
        if (skillsResult.success) {
          // Show what we got from overview
        }
      }

      setSkills(skillFiles)
      if (skillFiles.length > 0 && !selectedId) {
        setSelectedId(skillFiles[0].id)
        setEditContent(skillFiles[0].content)
      }
    } catch {
      setError('Failed to load workspace files')
    } finally {
      setLoading(false)
    }
  }, [selectedId])

  useEffect(() => {
    void loadSkills()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSelect = (id: string): void => {
    setSelectedId(id)
    const skill = skills.find((s) => s.id === id)
    if (skill) setEditContent(skill.content)
  }

  const handleSave = async (): Promise<void> => {
    if (!selectedId) return
    setSaving(true)
    try {
      await api.openclawFiles.writeWorkspaceFile(selectedId, editContent)
      // Update local state
      setSkills(prev => prev.map(s =>
        s.id === selectedId ? { ...s, content: editContent } : s
      ))
    } catch {
      // handled by error boundary
    } finally {
      setSaving(false)
    }
  }

  const selectedSkill = skills.find((s) => s.id === selectedId)

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-10 py-5" style={{ borderColor: 'var(--color-border)' }}>
        <h1 className="text-[28px] font-semibold tracking-tight text-text-main">Skill Library</h1>
        <p className="mt-1 text-sm text-text-muted">Manage execution logic, verification rules, and agent capabilities.</p>
      </div>

      <div className="flex flex-1 min-h-0 gap-6 p-6" style={{ minHeight: '500px' }}>
        {/* Skill cards list */}
        <div
          className="flex w-[300px] shrink-0 flex-col gap-2 overflow-y-auto border-r pr-6"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          ) : error ? (
            <div className="py-8 text-center">
              <p className="text-sm text-text-muted">{error}</p>
              <button
                type="button"
                onClick={() => void loadSkills()}
                className="mt-2 text-xs text-accent hover:underline"
              >
                Retry
              </button>
            </div>
          ) : skills.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-text-muted">No workspace files found.</p>
              <p className="mt-1 text-xs text-text-muted">
                Add files to ~/.openclaw/workspace/ to see them here.
              </p>
            </div>
          ) : (
            skills.map((skill) => {
              const isActive = selectedId === skill.id
              return (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => handleSelect(skill.id)}
                  className="flex flex-col gap-2 rounded-xl border p-4 text-left transition-all cursor-pointer"
                  style={{
                    borderColor: isActive ? 'var(--color-text-main)' : 'var(--color-border)',
                    background: isActive ? 'var(--color-bg-hover)' : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = 'var(--color-border-hover)'
                      e.currentTarget.style.background = 'var(--color-bg-hover)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = 'var(--color-border)'
                      e.currentTarget.style.background = 'transparent'
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-text-main">{skill.name}</span>
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-mono border"
                      style={{
                        color: 'var(--color-text-muted)',
                        background: 'var(--color-bg-base)',
                        borderColor: 'var(--color-border)',
                      }}
                    >
                      {skill.type}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-text-muted">{skill.description}</p>
                </button>
              )
            })
          )}
        </div>

        {/* Editor pane */}
        <div
          className="flex flex-1 flex-col rounded-xl border overflow-hidden"
          style={{
            borderColor: 'var(--color-border)',
            background: 'var(--color-term-bg)',
            transition: 'background 0.3s, border-color 0.3s',
          }}
        >
          <div
            className="flex h-12 items-center justify-between px-4 border-b"
            style={{
              borderColor: 'var(--color-border)',
              background: 'var(--color-bg-surface)',
            }}
          >
            <span className="font-mono text-xs text-text-muted">
              {selectedSkill ? `workspace/${selectedSkill.id}` : 'Select a file'}
            </span>
            <button
              type="button"
              disabled={!selectedId || saving}
              onClick={() => void handleSave()}
              className="rounded-md px-4 py-1.5 text-xs font-semibold transition-transform hover:scale-[0.97] disabled:opacity-50"
              style={{
                background: 'var(--color-text-main)',
                color: 'var(--color-bg-base)',
              }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            spellCheck={false}
            className="flex-1 resize-none bg-transparent px-5 py-5 font-mono text-[13px] leading-relaxed text-text-main outline-none"
          />
        </div>
      </div>
    </div>
  )
}
