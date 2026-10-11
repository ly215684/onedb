import { Plus, PlugZap, Power, Pencil, Trash2, Terminal, ArrowRight, LayoutGrid } from 'lucide-react'
import { useApp } from '../store/useApp'
import { DB_META, DB_ORDER, dbColor } from '../lib/dbMeta'
import { useT, useShowDbColor } from '../lib/i18n'
import { Button, EmptyState } from '../components/ui/primitives'
import type { ConnectionConfig } from '../../../shared/types'

function endpoint(c: ConnectionConfig, localLabel: string): string {
  if (c.type === 'sqlite') return c.database || localLabel
  if (c.type === 'mongo-srv') return c.srvUrl || c.host || '—'
  return `${c.host || '127.0.0.1'}:${c.port ?? DB_META[c.type].defaultPort}`
}

export function HomeScreen(): React.JSX.Element {
  const app = useApp()
  const t = useT()
  const showColor = useShowDbColor()

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-5xl px-8 py-7">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-semibold text-fg">{t.home.title}</h1>
            <p className="mt-0.5 text-[13px] text-fg-muted">{t.home.subtitle}</p>
          </div>
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => app.openQuickConnect()}>
            {t.nav.newConnection}
          </Button>
        </div>

        {/* 按类型快速新建 */}
        <div className="mt-6">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-fg-muted">
            <LayoutGrid size={13} /> {t.home.quickCreate}
          </div>
          <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
            {DB_ORDER.map((type) => (
              <button
                key={type}
                onClick={() => app.openQuickConnect(type)}
                className="group flex flex-col items-center gap-2 rounded-lg border border-line bg-surface p-3 transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-md"
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white"
                  style={{ background: dbColor(type) }}
                >
                  {DB_META[type].label.slice(0, 1)}
                </span>
                <span className="text-xs font-medium text-fg">{DB_META[type].label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 已保存连接 */}
        <div className="mb-2 mt-8 text-xs font-semibold uppercase tracking-wider text-fg-muted">{t.home.saved}</div>
        {app.connections.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line bg-surface">
            <EmptyState
              icon={<PlugZap size={28} />}
              title={t.home.emptyTitle}
              desc={t.home.emptyDesc}
              action={
                <Button variant="soft" icon={<Plus size={15} />} onClick={() => app.openQuickConnect()}>
                  {t.nav.newConnection}
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {app.connections.map((c) => {
              const online = !!app.connected[c.id]
              const version = app.connected[c.id]
              return (
                <div
                  key={c.id}
                  className="relative overflow-hidden rounded-lg border border-line bg-surface p-4 pl-5 transition-shadow hover:shadow-md"
                >
                  {showColor && <span className="absolute inset-y-0 left-0 w-1" style={{ background: dbColor(c.type) }} />}
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[15px] font-semibold text-fg">{c.name}</span>
                        {showColor ? (
                          <span
                            className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold"
                            style={{ color: dbColor(c.type), background: `color-mix(in srgb, ${dbColor(c.type)} 15%, transparent)` }}
                          >
                            {DB_META[c.type].label}
                          </span>
                        ) : (
                          <span className="shrink-0 rounded bg-canvas px-1.5 py-0.5 text-[10px] font-medium text-fg-muted">
                            {DB_META[c.type].label}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 truncate font-code text-xs text-fg-muted">{endpoint(c, t.home.localFile)}</div>
                    </div>
                    <span
                      className="flex shrink-0 items-center gap-1 text-[11px]"
                      style={{ color: online ? 'var(--success)' : 'var(--text-disabled)' }}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: 'currentColor' }} />
                      {online ? t.common.online : t.common.offline}
                    </span>
                  </div>

                  {online && version && <div className="mt-2 text-[11px] text-fg-faint">{version}</div>}

                  <div className="mt-3 flex items-center gap-1.5">
                    {online ? (
                      <>
                        <Button
                          size="sm"
                          variant="primary"
                          icon={<ArrowRight size={13} />}
                          onClick={() =>
                            app.openTab({
                              kind: DB_META[c.type].kind === 'relational' ? 'sql' : DB_META[c.type].kind === 'document' ? 'mongo' : 'redis',
                              title: c.name,
                              connectionId: c.id,
                              dbType: c.type,
                              database: c.database,
                              redisDb: 0
                            })
                          }
                        >
                          {t.home.open}
                        </Button>
                        <Button size="sm" variant="ghost" icon={<Power size={13} />} onClick={() => app.disconnect(c.id)}>
                          {t.home.disconnect}
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="soft" icon={<PlugZap size={13} />} onClick={() => app.connect(c.id)}>
                        {t.home.connect}
                      </Button>
                    )}
                    {DB_META[c.type].kind === 'relational' && online && (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Terminal size={13} />}
                        onClick={() =>
                          app.openTab({
                            kind: 'sql',
                            title: `${c.name} · ${t.sql.querySuffix}`,
                            connectionId: c.id,
                            dbType: c.type,
                            database: c.database
                          })
                        }
                      >
                        SQL
                      </Button>
                    )}
                    <div className="ml-auto flex items-center gap-0.5">
                      <button
                        className="flex h-7 w-7 items-center justify-center rounded text-fg-muted hover:bg-canvas hover:text-fg"
                        onClick={() => app.openQuickConnect(c.type, c)}
                        title={t.home.edit}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="flex h-7 w-7 items-center justify-center rounded text-fg-muted hover:bg-bad/10 hover:text-bad"
                        onClick={() => app.removeConnection(c.id)}
                        title={t.home.delete}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
