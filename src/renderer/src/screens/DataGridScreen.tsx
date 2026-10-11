import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Plus, Trash2, Upload, Undo2, Loader2, Table2 } from 'lucide-react'
import { useApp, type Tab } from '../store/useApp'
import { useT } from '../lib/i18n'
import { Button, cx, Badge } from '../components/ui/primitives'
import { Pagination } from '../components/ui/Pagination'
import { fmtCell } from '../lib/dbMeta'
import type { PendingChange, TableSchema } from '../../../shared/types'

function quoteIdent(name: string, type: string): string {
  if (type === 'mysql') return '`' + name.replace(/`/g, '``') + '`'
  return '"' + name.replace(/"/g, '""') + '"'
}
function fullTable(table: string, type: string, schema?: string): string {
  if (type === 'postgres' && schema && schema !== 'public') return `${quoteIdent(schema, type)}.${quoteIdent(table, type)}`
  return quoteIdent(table, type)
}

interface CellEdit {
  row: number
  col: string
  value: string
}

export function DataGridScreen({ tab }: { tab: Tab }): React.JSX.Element {
  const app = useApp()
  const t = useT()
  const conn = app.connections.find((c) => c.id === tab.connectionId)
  const table = tab.table ?? ''
  const type = conn?.type ?? 'mysql'

  const [schema, setSchema] = useState<TableSchema | null>(null)
  const [columns, setColumns] = useState<string[]>([])
  const [rows, setRows] = useState<unknown[][]>([])
  const [pageSize, setPageSize] = useState(100)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [edits, setEdits] = useState<Record<string, string>>({}) // `${row}|${col}` -> value
  const [deletes, setDeletes] = useState<Set<number>>(new Set())
  const [newRows, setNewRows] = useState<Record<string, string>[]>([])
  const [editing, setEditing] = useState<CellEdit | null>(null)

  const colIndex = useCallback((name: string) => columns.indexOf(name), [columns])

  const idxOfPk = (schema?.columns ?? []).filter((c) => c.isPrimary).map((c) => c.name)
  const editable = idxOfPk.length > 0 && !!conn

  async function load(): Promise<void> {
    if (!conn) return
    setLoading(true)
    setErr(null)
    try {
      const s = await window.onedb.sql.schema(conn.id, tab.database!, tab.schema, table)
      setSchema(s)
      const base = fullTable(table, type, tab.schema)
      const pkCols = s.columns.filter((c) => c.isPrimary).map((c) => c.name)
      const order = pkCols.length ? ` ORDER BY ${pkCols.map((p) => quoteIdent(p, type)).join(', ')}` : ''
      const offset = page * pageSize
      const r = await window.onedb.sql.query(conn.id, {
        connectionId: conn.id,
        database: tab.database,
        schema: tab.schema,
        sql: `SELECT * FROM ${base}${order} LIMIT ${pageSize} OFFSET ${offset}`
      })
      setColumns(r.columns)
      setRows(r.rows)
      setEdits({})
      setDeletes(new Set())
      setNewRows([])
      try {
        const cnt = await window.onedb.sql.query(conn.id, {
          connectionId: conn.id,
          database: tab.database,
          schema: tab.schema,
          sql: `SELECT COUNT(*) FROM ${base}`
        })
        setTotal(Number(cnt.rows[0]?.[0] ?? offset + r.rowCount))
      } catch {
        setTotal(offset + r.rowCount)
      }
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, pageSize, page, tab.database, tab.schema])

  function pkFor(rowIdx: number): Record<string, unknown> {
    const pk: Record<string, unknown> = {}
    for (const p of idxOfPk) pk[p] = rows[rowIdx][colIndex(p)]
    return pk
  }

  const pendingCount = Object.keys(edits).length + deletes.size + newRows.length

  function buildChanges(): PendingChange[] {
    const changes: PendingChange[] = []
    for (const [key, value] of Object.entries(edits)) {
      const [rStr, col] = key.split('|')
      const r = Number(rStr)
      changes.push({ id: key, kind: 'update', table, pk: pkFor(r), column: col, value })
    }
    for (const r of deletes) changes.push({ id: `del-${r}`, kind: 'delete', table, pk: pkFor(r) })
    for (let i = 0; i < newRows.length; i++) {
      const row: Record<string, unknown> = {}
      for (const c of columns) if (newRows[i][c] !== undefined && newRows[i][c] !== '') row[c] = newRows[i][c]
      changes.push({ id: `new-${i}`, kind: 'insert', table, pk: {}, row })
    }
    return changes
  }

  async function submit(): Promise<void> {
    if (!conn) return
    const changes = buildChanges()
    if (!changes.length) return
    setLoading(true)
    try {
      const n = await window.onedb.sql.applyData(conn.id, tab.database!, tab.schema, table, changes)
      app.toast('success', `${t.data.submitted} ${changes.length} · ${t.data.affectedRows} ${n} ${t.common.rows}`)
      await load()
    } catch (e) {
      app.toast('error', (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function discard(): void {
    setEdits({})
    setDeletes(new Set())
    setNewRows([])
  }

  function commitEdit(): void {
    if (!editing) return
    const { row, col, value } = editing
    setEdits((prev) => ({ ...prev, [`${row}|${col}`]: value }))
    setRows((prev) => prev.map((r, i) => (i === row ? r.map((c, j) => (columns[j] === col ? value : c)) : r)))
    setEditing(null)
  }

  if (!conn) return <div className="p-6 text-sm text-fg-muted">{t.sql.connInvalid}</div>

  return (
    <div className="flex h-full flex-col">
      {/* 工具条 */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line bg-surface px-3">
        <Table2 size={15} className="text-accent" />
        <span className="font-code text-[13px] text-fg">
          {tab.database}
          {tab.schema ? `.${tab.schema}` : ''}.{table}
        </span>
        {!editable && <Badge color="var(--warning)">{t.data.noPkReadonly}</Badge>}
        <Button size="sm" variant="ghost" icon={<RefreshCw size={13} className={cx(loading && 'animate-spin')} />} onClick={() => void load()}>
          {t.common.refresh}
        </Button>
        <div className="ml-auto flex items-center gap-1.5">
          {pendingCount > 0 && (
            <>
              <span className="text-xs text-fg-muted">{t.data.pending} {pendingCount}</span>
              <Button size="sm" variant="ghost" icon={<Undo2 size={13} />} onClick={discard} disabled={loading}>
                {t.data.discard}
              </Button>
              <Button size="sm" variant="primary" icon={loading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} onClick={() => void submit()} disabled={loading}>
                {t.data.submit}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 网格 */}
      <div className="min-h-0 flex-1 overflow-auto bg-surface">
        {err ? (
          <div className="m-3 rounded-md border border-bad/40 bg-bad/10 p-3 font-code text-xs text-bad">{err}</div>
        ) : (
          <table className="w-full border-collapse text-[12.5px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-raised">
                <th className="w-16 border-b border-r border-line px-2 py-1.5 text-center text-[11px] text-fg-faint">{t.data.op}</th>
                <th className="w-10 border-b border-r border-line px-2 py-1.5 text-right font-mono text-[11px] text-fg-faint">#</th>
                {columns.map((c) => {
                  const isPk = idxOfPk.includes(c)
                  return (
                    <th key={c} className="whitespace-nowrap border-b border-r border-line px-2.5 py-1.5 text-left font-semibold text-fg">
                      <span className="flex items-center gap-1">
                        {isPk && <span className="text-warn">🔑</span>}
                        {c}
                      </span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const del = deletes.has(i)
                return (
                  <tr key={i} className={cx(del ? 'bg-bad/10' : 'odd:bg-canvas/30', 'group')}>
                    <td className="border-b border-r border-line-soft px-2 py-0.5 text-center">
                      {editable && !del && (
                        <button
                          className="opacity-0 group-hover:opacity-100 text-fg-faint hover:text-bad"
                          onClick={() => setDeletes((p) => new Set(p).add(i))}
                          title={t.data.deleteRow}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                      {del && (
                        <button className="text-bad" onClick={() => setDeletes((p) => { const n = new Set(p); n.delete(i); return n })}>
                          <Undo2 size={13} />
                        </button>
                      )}
                    </td>
                    <td className={cx('border-b border-r border-line-soft px-2 py-0.5 text-right font-mono text-[11px]', del ? 'text-bad line-through' : 'text-fg-faint')}>
                      {i + 1}
                    </td>
                    {columns.map((c, j) => {
                      const key = `${i}|${c}`
                      const dirty = key in edits
                      const isEditing = editing?.row === i && editing?.col === c
                      return (
                        <td
                          key={c}
                          onDoubleClick={() => editable && !del && setEditing({ row: i, col: c, value: String(r[j] ?? '') })}
                          className={cx(
                            'max-w-[260px] cursor-cell truncate border-b border-r border-line-soft px-2.5 py-0.5',
                            del && 'bg-bad/10 text-fg-faint line-through',
                            dirty && 'bg-accent-soft font-medium text-fg ring-1 ring-inset ring-accent/40',
                            !dirty && (r[j] === null || r[j] === undefined ? 'italic text-fg-faint' : 'font-code')
                          )}
                          title={t.data.doubleClickEdit}
                        >
                          {isEditing ? (
                            <input
                              autoFocus
                              value={editing.value}
                              onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                              onBlur={commitEdit}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitEdit()
                                if (e.key === 'Escape') setEditing(null)
                              }}
                              className="w-full bg-surface font-code text-fg outline-none"
                            />
                          ) : (
                            fmtCell(r[j])
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}

              {/* 新增行 */}
              {newRows.map((nr, k) => (
                <tr key={`new-${k}`} className="bg-ok/10">
                  <td className="border-b border-r border-line-soft px-2 py-0.5 text-center">
                    <button className="text-ok" onClick={() => setNewRows((p) => p.filter((_, i) => i !== k))} title={t.data.undoInsert}>
                      <Undo2 size={13} />
                    </button>
                  </td>
                  <td className="border-b border-r border-line-soft px-2 py-0.5 text-right font-mono text-[11px] text-ok">{t.data.newTag}</td>
                  {columns.map((c) => (
                    <td key={c} className="border-b border-r border-line-soft px-1 py-0.5">
                      <input
                        value={nr[c] ?? ''}
                        placeholder="—"
                        onChange={(e) => setNewRows((p) => p.map((row, i) => (i === k ? { ...row, [c]: e.target.value } : row)))}
                        className="w-full bg-transparent font-code text-fg outline-none placeholder:text-fg-faint"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 底栏 */}
      <div className="flex h-11 shrink-0 items-center justify-between border-t border-line bg-raised px-3">
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          pageSizeOptions={[20, 50, 100, 200, 500, 1000]}
          disabled={pendingCount > 0}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPage(0)
            setPageSize(s)
          }}
        />
        {editable && (
          <button className="flex items-center gap-1 text-accent hover:underline" onClick={() => setNewRows((p) => [...p, {}])}>
            <Plus size={13} /> {t.data.addRow}
          </button>
        )}
      </div>
    </div>
  )
}
