import { X, Home, Terminal, Table2, FileJson, Hash, Wrench, Workflow, Settings } from 'lucide-react'
import { useApp, type Tab } from '../store/useApp'
import { useShowDbColor, useT } from '../lib/i18n'
import { dbColor } from '../lib/dbMeta'
import { cx } from './ui/primitives'

const KIND_ICON: Record<Tab['kind'], React.ReactNode> = {
  home: <Home size={13} />,
  sql: <Terminal size={13} />,
  data: <Table2 size={13} />,
  mongo: <FileJson size={13} />,
  redis: <Hash size={13} />,
  structure: <Wrench size={13} />,
  er: <Workflow size={13} />,
  settings: <Settings size={13} />
}

export function TabBar(): React.JSX.Element {
  const { tabs, activeTabId, setActiveTab, closeTab } = useApp()
  const showColor = useShowDbColor()
  const tt = useT()
  return (
    <div className="flex h-10 shrink-0 items-stretch overflow-x-auto border-b border-line bg-surface">
      {tabs.map((t) => {
        const active = t.id === activeTabId
        return (
          <div
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cx(
              'group flex min-w-0 cursor-pointer items-center gap-2 border-r border-line px-3 text-[13px] transition-colors',
              active ? 'bg-canvas text-fg' : 'text-fg-muted hover:bg-canvas/60'
            )}
          >
            {showColor && t.dbType && (
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dbColor(t.dbType) }} />
            )}
            <span className={cx('shrink-0', active && 'text-accent')}>{KIND_ICON[t.kind]}</span>
            <span className="max-w-40 truncate">{t.kind === 'home' ? tt.nav.overview : t.kind === 'settings' ? tt.nav.settings : t.title}</span>
            {t.closable && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(t.id)
                }}
                className="ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded text-fg-faint opacity-70 hover:bg-line hover:text-fg hover:opacity-100"
              >
                <X size={12} />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
