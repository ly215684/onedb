import { Home, Settings, Sun, Moon, Plus, Database } from 'lucide-react'
import { useApp } from '../store/useApp'
import { useT } from '../lib/i18n'
import { cx } from './ui/primitives'

function RailBtn({
  icon,
  label,
  active,
  onClick
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      title={label}
      onClick={onClick}
      className={cx(
        'group relative flex h-11 w-11 items-center justify-center rounded-lg transition-colors',
        active ? 'bg-accent-soft text-accent' : 'text-fg-muted hover:bg-canvas hover:text-fg'
      )}
    >
      {active && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-accent" />}
      {icon}
    </button>
  )
}

export function IconRail(): React.JSX.Element {
  const s = useApp()
  const t = useT()
  const activeKind = s.tabs.find((x) => x.id === s.activeTabId)?.kind
  const isDark = s.resolvedTheme === 'dark'

  return (
    <nav className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-line bg-surface py-2">
      <div className="mb-1 flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-on-accent">
        <Database size={16} />
      </div>
      <RailBtn
        icon={<Home size={18} />}
        label={t.nav.overview}
        active={activeKind === 'home'}
        onClick={() => s.openTab({ kind: 'home', title: t.nav.overview })}
      />
      <RailBtn
        icon={<Plus size={18} />}
        label={t.nav.newConnection}
        onClick={() => s.openQuickConnect()}
      />
      <div className="my-1 h-px w-7 bg-line" />
      <RailBtn
        icon={<Settings size={18} />}
        label={t.nav.settings}
        active={activeKind === 'settings'}
        onClick={() => s.openTab({ kind: 'settings', title: t.nav.settings })}
      />
      <div className="flex-1" />
      <RailBtn
        icon={isDark ? <Sun size={18} /> : <Moon size={18} />}
        label={isDark ? t.nav.toLight : t.nav.toDark}
        onClick={() => s.saveSettings({ theme: isDark ? 'light' : 'dark' })}
      />
    </nav>
  )
}
