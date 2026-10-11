import { Minus, Square, X, Database } from 'lucide-react'
import { useApp } from '../store/useApp'
import { useShowDbColor } from '../lib/i18n'
import { dbColor } from '../lib/dbMeta'

export function TitleBar(): React.JSX.Element {
  const active = useApp((s) => s.tabs.find((t) => t.id === s.activeTabId))
  const conn = useApp((s) => s.connections.find((c) => c.id === active?.connectionId))
  const connected = useApp((s) => s.connected)
  const showColor = useShowDbColor()

  return (
    <div className="drag-region flex h-11 shrink-0 items-center justify-between border-b border-line bg-surface px-3">
      <div className="flex items-center gap-2">
        <div className="flex h-5 w-5 items-center justify-center rounded bg-accent text-on-accent">
          <Database size={13} />
        </div>
        <span className="text-[13px] font-semibold tracking-wide text-fg">OneDB</span>
        {conn && (
          <span className="no-drag ml-2 flex items-center gap-1.5 text-xs text-fg-muted">
            {showColor && (
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: dbColor(conn.type) }} />
            )}
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: connected[conn.id] ? 'var(--success)' : 'var(--text-disabled)' }}
            />
            {conn.name}
          </span>
        )}
      </div>
      <div className="no-drag flex items-center">
        <button
          className="flex h-8 w-10 items-center justify-center rounded text-fg-muted hover:bg-canvas hover:text-fg"
          onClick={() => window.onedb.win.minimize()}
        >
          <Minus size={16} />
        </button>
        <button
          className="flex h-8 w-10 items-center justify-center rounded text-fg-muted hover:bg-canvas hover:text-fg"
          onClick={() => window.onedb.win.maximize()}
        >
          <Square size={13} />
        </button>
        <button
          className="flex h-8 w-10 items-center justify-center rounded text-fg-muted hover:bg-bad hover:text-white"
          onClick={() => window.onedb.win.close()}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
