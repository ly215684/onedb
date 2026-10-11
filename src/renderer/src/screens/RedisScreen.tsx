import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Trash2, Hash, Search, Save, KeyRound } from 'lucide-react'
import { useApp, type Tab } from '../store/useApp'
import { useT } from '../lib/i18n'
import { Button, Badge, cx } from '../components/ui/primitives'
import type { RedisKeyInfo, RedisValue } from '../../../shared/types'

const TYPE_COLOR: Record<string, string> = {
  string: 'var(--db-redis)',
  hash: '#8A2EDD',
  list: '#22A2D9',
  set: '#2EB25E',
  zset: '#E1A125'
}

export function RedisScreen({ tab }: { tab: Tab }): React.JSX.Element {
  const app = useApp()
  const t = useT()
  const conn = app.connections.find((c) => c.id === tab.connectionId)
  const db = tab.redisDb ?? 0

  const [pattern, setPattern] = useState('*')
  const [keys, setKeys] = useState<RedisKeyInfo[]>([])
  const [stats, setStats] = useState<{ keys: number; memory: string } | null>(null)
  const [sel, setSel] = useState<string | null>(tab.key ?? null)
  const [detail, setDetail] = useState<RedisValue | null>(null)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const loadKeys = useCallback(async (): Promise<void> => {
    if (!conn) return
    setLoading(true)
    try {
      const [k, s] = await Promise.all([
        window.onedb.redis.scan(conn.id, db, pattern || '*'),
        window.onedb.redis.stats(conn.id, db)
      ])
      setKeys(k)
      setStats(s)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [conn, db, pattern])

  useEffect(() => {
    void loadKeys()
  }, [loadKeys])

  const openKey = useCallback(
    async (key: string): Promise<void> => {
      if (!conn) return
      setSel(key)
      setDetail(null)
      try {
        const v = await window.onedb.redis.value(conn.id, db, key)
        setDetail(v)
        setDraft(typeof v.value === 'string' ? v.value : JSON.stringify(v.value, null, 2))
      } catch (e) {
        setErr((e as Error).message)
      }
    },
    [conn, db]
  )

  useEffect(() => {
    if (sel) void openKey(sel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel])

  async function save(): Promise<void> {
    if (!conn || !detail || detail.type !== 'string') return
    try {
      await window.onedb.redis.set(conn.id, db, detail.key, draft)
      app.toast('success', t.redis.updated)
      await openKey(detail.key)
    } catch (e) {
      app.toast('error', (e as Error).message)
    }
  }

  async function del(key: string): Promise<void> {
    if (!conn) return
    try {
      await window.onedb.redis.delete(conn.id, db, key)
      app.toast('success', `${t.redis.deleted} ${key}`)
      if (sel === key) setSel(null)
      await loadKeys()
    } catch (e) {
      app.toast('error', (e as Error).message)
    }
  }

  if (!conn) return <div className="p-6 text-sm text-fg-muted">{t.sql.connInvalid}</div>

  return (
    <div className="flex h-full">
      {/* 键列表 */}
      <div className="flex w-72 shrink-0 flex-col border-r border-line bg-surface">
        <div className="flex items-center gap-2 border-b border-line p-2.5">
          <Hash size={15} className="text-redis" />
          <span className="text-[13px] font-semibold text-fg">db{db}</span>
          {stats && <span className="ml-auto text-[11px] text-fg-faint">{stats.keys} {t.redis.keys} · {stats.memory}</span>}
        </div>
        <div className="flex items-center gap-1.5 border-b border-line px-2.5 py-2">
          <div className="flex h-7 flex-1 items-center gap-1.5 rounded-md border border-line bg-canvas px-2">
            <Search size={12} className="text-fg-faint" />
            <input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder={t.redis.matchPh}
              className="w-full bg-transparent font-code text-xs text-fg outline-none placeholder:text-fg-faint"
            />
          </div>
          <button className="flex h-7 w-7 items-center justify-center rounded text-fg-muted hover:bg-canvas" onClick={() => void loadKeys()}>
            <RefreshCw size={13} className={cx(loading && 'animate-spin')} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {err && <div className="m-2 rounded bg-bad/10 p-2 text-[11px] text-bad">{err}</div>}
          {keys.length === 0 && !err && <div className="p-6 text-center text-xs text-fg-faint">{t.redis.noKeys}</div>}
          {keys.map((k) => (
            <div
              key={k.key}
              onClick={() => setSel(k.key)}
              className={cx(
                'group flex cursor-pointer items-center gap-2 border-b border-line-soft px-2.5 py-1.5 text-xs hover:bg-canvas',
                sel === k.key && 'bg-accent-soft'
              )}
            >
              <KeyRound size={12} style={{ color: TYPE_COLOR[k.type] ?? 'var(--text-secondary)' }} className="shrink-0" />
              <span className="truncate font-code text-fg">{k.key}</span>
              <span className="ml-auto flex shrink-0 items-center gap-1">
                <Badge color={TYPE_COLOR[k.type] ?? undefined}>{k.type}</Badge>
                <button className="hidden text-fg-faint hover:text-bad group-hover:block" onClick={(e) => { e.stopPropagation(); void del(k.key) }}>
                  <Trash2 size={12} />
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 详情 */}
      <div className="flex min-w-0 flex-1 flex-col bg-canvas">
        {!sel ? (
          <div className="flex h-full items-center justify-center text-sm text-fg-faint">{t.redis.selectKey}</div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2">
              <span className="font-code text-[13px] text-fg">{sel}</span>
              {detail && <Badge color={TYPE_COLOR[detail.type] ?? undefined}>{detail.type}</Badge>}
              {detail && <span className="text-[11px] text-fg-faint">{t.redis.ttl}: {detail.ttl < 0 ? t.redis.neverExpire : `${detail.ttl}s`}</span>}
              <div className="ml-auto">
                {detail?.type === 'string' && (
                  <Button size="sm" variant="primary" icon={<Save size={13} />} onClick={() => void save()}>
                    {t.common.save}
                  </Button>
                )}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-3">
              {!detail ? (
                <div className="text-xs text-fg-faint">{t.redis.loading}</div>
              ) : detail.type === 'string' ? (
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="h-full min-h-40 w-full resize-none rounded-md border border-line bg-code-bg p-3 font-code text-xs text-code-fg outline-none focus:border-accent"
                />
              ) : (
                <ValueView value={detail.value} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ValueView({ value }: { value: Record<string, string> | string | string[] }): React.JSX.Element {
  if (Array.isArray(value)) {
    return (
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        {value.map((v, i) => (
          <div key={i} className="flex items-center gap-2 border-b border-line-soft px-3 py-1.5 text-xs last:border-0">
            <span className="w-8 font-mono text-fg-faint">[{i}]</span>
            <span className="font-code text-fg">{v}</span>
          </div>
        ))}
      </div>
    )
  }
  if (typeof value === 'string') {
    return <pre className="rounded-md bg-code-bg p-3 font-code text-xs text-code-fg">{value}</pre>
  }
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      {Object.entries(value).map(([k, v]) => (
        <div key={k} className="flex items-start gap-3 border-b border-line-soft px-3 py-1.5 text-xs last:border-0">
          <span className="w-40 shrink-0 truncate font-code text-accent">{k}</span>
          <span className="font-code text-fg">{String(v)}</span>
        </div>
      ))}
    </div>
  )
}
