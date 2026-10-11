import { useEffect, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { sql } from '@codemirror/lang-sql'
import { vscodeLight, vscodeDark } from '@uiw/codemirror-theme-vscode'
import { Play, Loader2, Table2, Wrench, Workflow, Braces } from 'lucide-react'
import { useApp, type Tab } from '../store/useApp'
import { useT } from '../lib/i18n'
import { DataGrid } from '../components/DataGrid'
import { Button, Select, cx } from '../components/ui/primitives'
import type { QueryResult } from '../../../shared/types'

export function SqlEditorScreen({ tab }: { tab: Tab }): React.JSX.Element {
  const app = useApp()
  const t = useT()
  const dark = app.resolvedTheme === 'dark'
  const conn = app.connections.find((c) => c.id === tab.connectionId)

  const [databases, setDatabases] = useState<string[]>([])
  const [schemas, setSchemas] = useState<string[]>([])
  const [database, setDatabase] = useState<string | undefined>(tab.database)
  const [schema, setSchema] = useState<string | undefined>(tab.schema)
  const [text, setText] = useState(`-- ${conn?.name ?? 'SQL'}\nSELECT 1 AS hello;`)
  const [limit, setLimit] = useState(app.settings.defaultLimit)
  const [running, setRunning] = useState(false)
  const [res, setRes] = useState<QueryResult | null>(null)
  const [err, setErr] = useState<string | null>(null)

  // 加载数据库列表
  useEffect(() => {
    if (!tab.connectionId) return
    window.onedb.tree
      .databases(tab.connectionId)
      .then((d) => {
        setDatabases(d)
        setDatabase((cur) => cur ?? d[0])
      })
      .catch((e) => setErr((e as Error).message))
  }, [tab.connectionId])

  // postgres schema
  useEffect(() => {
    if (!tab.connectionId || !database || conn?.type !== 'postgres') return
    window.onedb.tree.schemas(tab.connectionId, database).then(setSchemas).catch(() => {})
  }, [tab.connectionId, database, conn?.type])

  const extensions = [sql()]

  async function run(): Promise<void> {
    if (!tab.connectionId) return
    setRunning(true)
    setErr(null)
    try {
      const r = await window.onedb.sql.query(tab.connectionId, {
        connectionId: tab.connectionId,
        database,
        schema,
        sql: text,
        limit
      })
      setRes(r)
    } catch (e) {
      setErr((e as Error).message)
      setRes(null)
    } finally {
      setRunning(false)
    }
  }

  useEffect(() => {
    const h = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        void run()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, database, schema, limit, tab.connectionId])

  if (!conn) return <div className="p-6 text-sm text-fg-muted">{t.sql.connInvalid}</div>

  const goTable = (kind: 'data' | 'structure' | 'er'): void => {
    app.openTab({
      kind,
      title: kind === 'er' ? `${t.sql.erPrefix} · ${database}` : `${database ?? ''} · ${kind === 'data' ? t.sql.dataBrowse : t.sql.structureDesign}`,
      connectionId: conn.id,
      dbType: conn.type,
      database,
      schema
    })
  }

  return (
    <div className="flex h-full flex-col">
      {/* 工具条 */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line bg-surface px-3">
        <Select
          className="w-40"
          value={database ?? ''}
          onChange={(v) => setDatabase(v)}
          options={databases.map((d) => ({ value: d, label: d }))}
        />
        {conn.type === 'postgres' && (
          <Select
            className="w-36"
            value={schema ?? 'public'}
            onChange={(v) => setSchema(v)}
            options={schemas.length ? schemas.map((d) => ({ value: d, label: d })) : [{ value: 'public', label: 'public' }]}
          />
        )}
        <Select
          className="w-28"
          value={String(limit)}
          onChange={(v) => setLimit(Number(v))}
          options={[50, 100, 200, 500, 1000].map((n) => ({ value: String(n), label: `${t.common.limit} ${n}` }))}
        />
        <Button variant="primary" icon={running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} onClick={() => void run()} disabled={running}>
          {t.sql.execute}
          <kbd className="ml-1 rounded bg-black/10 px-1 text-[10px]">Ctrl↵</kbd>
        </Button>
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" icon={<Table2 size={14} />} onClick={() => goTable('data')} disabled={!database}>
            {t.sql.dataBrowse}
          </Button>
          <Button size="sm" variant="ghost" icon={<Wrench size={14} />} onClick={() => goTable('structure')} disabled={!database}>
            {t.sql.structureDesign}
          </Button>
          <Button size="sm" variant="ghost" icon={<Workflow size={14} />} onClick={() => goTable('er')} disabled={!database}>
            {t.sql.erDiagram}
          </Button>
        </div>
      </div>

      {/* 编辑器 */}
      <div className={cx('min-h-0 flex-1 overflow-hidden', !app.settings.editorLigatures && 'code-ligatures-off')}>
        <CodeMirror
          value={text}
          height="100%"
          theme={dark ? vscodeDark : vscodeLight}
          extensions={extensions}
          onChange={setText}
          className="h-full !font-code text-[13px]"
          style={{ fontSize: 13 }}
        />
      </div>

      {/* 结果区 */}
      <div className="flex min-h-0 shrink-0 flex-col border-t border-line" style={{ height: '44%' }}>
        <div className="flex h-8 shrink-0 items-center gap-3 bg-raised px-3 text-[11px] text-fg-muted">
          <Braces size={13} /> {t.sql.result}
          {res && (
            <span className="flex items-center gap-3">
              <span className="text-fg">{res.rowCount} {t.common.rows}</span>
              {res.affectedRows != null && <span className="text-info">{t.sql.affected} {res.affectedRows}</span>}
              <span>{res.durationMs} ms</span>
            </span>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-hidden bg-surface">
          {err ? (
            <div className={cx('m-3 rounded-md border border-bad/40 bg-bad/10 p-3 font-code text-xs text-bad')}>{err}</div>
          ) : res ? (
            <DataGrid columns={res.columns} rows={res.rows} />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-fg-faint">{t.sql.emptyResult}</div>
          )}
        </div>
      </div>
    </div>
  )
}
