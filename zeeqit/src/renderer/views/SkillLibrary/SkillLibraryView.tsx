import { useState } from 'react'

interface Skill {
  id: string
  name: string
  type: 'script' | 'browser' | 'tool'
  description: string
  content: string
}

const placeholderSkills: Skill[] = [
  {
    id: 'github-pr-review',
    name: 'github-pr-review',
    type: 'script',
    description: 'Analyzes diffs and posts structured review comments.',
    content: JSON.stringify({
      name: 'github-pr-review',
      adapter: 'shell',
      cost_tier: 'low',
      verification: {
        type: 'regex',
        pattern: 'Comment successfully posted'
      }
    }, null, 2),
  },
  {
    id: 'lead-extraction',
    name: 'lead-extraction',
    type: 'browser',
    description: 'Navigates dashboards to extract and format contact data.',
    content: JSON.stringify({
      name: 'lead-extraction',
      adapter: 'playwright',
      cost_tier: 'medium',
      requires: ['gologin'],
      verification: {
        type: 'row_count',
        min: 1
      }
    }, null, 2),
  },
  {
    id: 'data-validator',
    name: 'data-validator',
    type: 'tool',
    description: 'Validates extraction output against configurable schemas.',
    content: JSON.stringify({
      name: 'data-validator',
      adapter: 'internal',
      cost_tier: 'free',
      schemas: ['json-schema', 'zod']
    }, null, 2),
  },
]

/**
 * Skill library matching the spec HTML design: left card list + right JSON editor.
 */
export function SkillLibraryView(): React.JSX.Element {
  const [skills] = useState<Skill[]>(placeholderSkills)
  const [selectedId, setSelectedId] = useState(placeholderSkills[0].id)
  const [editContent, setEditContent] = useState(placeholderSkills[0].content)

  const selectedSkill = skills.find((s) => s.id === selectedId)

  const handleSelect = (id: string): void => {
    setSelectedId(id)
    const skill = skills.find((s) => s.id === id)
    if (skill) setEditContent(skill.content)
  }

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
          {skills.map((skill) => {
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
          })}
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
              {`workspace/skills/${selectedSkill?.name ?? ''}/skill.json`}
            </span>
            <button
              type="button"
              className="rounded-md px-4 py-1.5 text-xs font-semibold transition-transform hover:scale-[0.97]"
              style={{
                background: 'var(--color-text-main)',
                color: 'var(--color-bg-base)',
              }}
            >
              Save Changes
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
