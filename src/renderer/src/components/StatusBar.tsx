import { CheckCircle2, Wifi, Circle } from 'lucide-react'
import { useApp } from '../store/useApp'
import { useT } from '../lib/i18n'

export function StatusBar(): React.JSX.Element {
  const { connections, connected, settings, tabs, activeTabId } = useApp()
  const t = useT()
  const onlineCount = Object.keys(connected).length
  const active = tabs.find((x) => x.id === activeTabId)

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-line bg-surface px-3 text-[11px] text-fg-muted">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <Wifi size={12} /> {onlineCount}/{connections.length} {t.status.onlineCount}
        </span>
        {active?.database && (
          <span className="flex items-center gap-1.5">
            <Circle size={8} className="fill-current" /> {active.database}
            {active.table ? ` · ${active.table}` : ''}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <span>{t.status.density[settings.density]}</span>
        <span className="flex items-center gap-1">
          <CheckCircle2 size={12} className="text-ok" /> {t.status.version}
        </span>
      </div>
    </footer>
  )
}
