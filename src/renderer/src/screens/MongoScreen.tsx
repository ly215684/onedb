import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Plus, Trash2, FileJson, ChevronRight, Search, ChevronDown, Upload, Undo2, Loader2 } from 'lucide-react'
import { useApp, type Tab } from '../store/useApp'
import { useT } from '../lib/i18n'
import { Button, Modal, cx } from '../components/ui/primitives'
import { Pagination } from '../components/ui/Pagination'
import type { MongoDoc } from '../../../shared/types'

export function MongoScreen({ tab }: { tab: Tab }): React.JSX.Element {
  const app = useApp()
  const t = useT()
  const conn = app.connections.find((c) => c.id === tab.connectionId)
  const db = tab.database ?? ''
  const col = tab.collection ?? ''

  const [docs, setDocs] = useState<MongoDoc[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [insertOpen, setInsertOpen] = useState(false)
  const [draft, setDraft] = useState('{\n  \n}')
  const [editing, setEditing] = useState<{ id: string; field: string; value: string } | null>(null)
  const [pending, setPending] = useState<Record<string, { id: string; field: string; value: string }>>({})

  const load = useCallback(async (): Promise<void> => {
    if (!conn) return
    setLoading(true)
    setErr(null)
    try {
      const r = await window.onedb.mongo.find(conn.id, db, col, filter.trim() || undefined, page + 1, pageSize)
      setDocs(r.docs)
      setTotal(r.total)
      setEditing(null)
      setPending({})
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [conn, db, col, filter, page, pageSize])

  useEffect(() => {
    void load()
  }, [load])

  // 表格列：_id + 当前页文档出现过的所有顶层字段（按首次出现顺序）
  const columns = useMemo(() => {
    const set: string[] = []
    for (const d of docs) for (const k of Object.keys(d.preview)) if (!set.includes(k)) set.push(k)
    return set
  }, [docs])

  function toggle(id: string): void {
    setExpanded((p) => {
      const n = new Set(p)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  async function del(id: string): Promise<void> {
    if (!conn) return
    try {
      await window.onedb.mongo.delete(conn.id, db, col, id)
      app.toast('success', t.mongo.deleted)
      await load()
    } catch (e) {
      app.toast('error', (e as Error).message)
    }
  }

  async function insert(): Promise<void> {
    if (!conn) return
    try {
      JSON.parse(draft)
      const id = await window.onedb.mongo.insert(conn.id, db, col, draft)
      app.toast('success', `${t.mongo.inserted} ${id}`)
      setInsertOpen(false)
      await load()
    } catch (e) {
      app.toast('error', (e as Error).message)
    }
  }

  const pendingCount = Object.keys(pending).length

  function commitEdit(): void {
    if (!editing) return
    const { id, field, value } = editing
    const cur = docs.find((d) => d._id === id)?.preview[field] ?? ''
    if (cur !== value) {
      setPending((p) => ({ ...p, [`${id}|${field}`]: { id, field, value } }))
      setDocs((prev) => prev.map((d) => (d._id === id ? { ...d, preview: { ...d.preview, [field]: value } } : d)))
    }
    setEditing(null)
  }

  async function submitEdits(): Promise<void> {
    if (!conn) return
    const list = Object.values(pending)
    if (!list.length) return
    setLoading(true)
    try {
      let n = 0
      for (const ch of list) n += await window.onedb.mongo.updateField(conn.id, db, col, ch.id, ch.field, ch.value)
      app.toast('success', `${t.mongo.saved} ${list.length} · ${t.data.affectedRows} ${n}`)
      setPending({})
      await load()
    } catch (e) {
      app.toast('error', (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function discardEdits(): void {
    setPending({})
    void load()
  }

  if (!conn) return <div className="p-6 text-sm text-fg-muted">{t.sql.connInvalid}</div>
  // 表头 + 展开列 + 操作列
  const colSpan = columns.length + 3

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line bg-surface px-3">
        <FileJson size={15} className="text-mongo" />
        <span className="font-code text-[13px] text-fg">
          {db}.{col}
        </span>
        <span className="text-xs text-fg-faint">{total} {t.mongo.docs}</span>
        <div className="ml-3 flex h-7 w-64 items-center gap-1.5 rounded-md border border-line bg-canvas px-2">
          <Search size={12} className="text-fg-faint" />
          <input
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value)
              setPage(0)
            }}
            placeholder={t.mongo.filterPh}
            className="w-full bg-transparent font-code text-xs text-fg outline-none placeholder:text-fg-faint"
          />
        </div>
        <Button size="sm" variant="ghost" icon={<RefreshCw size={13} className={cx(loading && 'animate-spin')} />} onClick={() => void load()}>
          {t.common.refresh}
        </Button>
        <div className="ml-auto flex items-center gap-1.5">
          {pendingCount > 0 && (
            <>
              <span className="text-xs text-fg-muted">{t.data.pending} {pendingCount}</span>
              <Button size="sm" variant="ghost" icon={<Undo2 size={13} />} onClick={discardEdits} disabled={loading}>
                {t.data.discard}
              </Button>
              <Button size="sm" variant="primary" icon={loading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} onClick={() => void submitEdits()} disabled={loading}>
                {t.data.submit}
              </Button>
            </>
          )}
          <Button size="sm" variant="primary" icon={<Plus size={13} />} onClick={() => setInsertOpen(true)}>
            {t.mongo.insertDoc}
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-canvas">
        {err ? (
          <div className="m-3 rounded-md border border-bad/40 bg-bad/10 p-3 font-code text-xs text-bad">{err}</div>
        ) : docs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-fg-faint">{t.mongo.empty}</div>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-surface text-left">
                <th className="w-8 border-b border-line" />
                <th className="whitespace-nowrap border-b border-line bg-surface px-3 py-1.5 font-code font-medium text-fg-muted">_id</th>
                {columns.map((k) => (
                  <th key={k} className="whitespace-nowrap border-b border-line bg-surface px-3 py-1.5 font-code font-medium text-fg-muted">
                    {k}
                  </th>
                ))}
                <th className="w-10 border-b border-line" />
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => {
                const open = expanded.has(d._id)
                return (
                  <Fragment key={d._id}>
                    <tr className={cx('border-b border-line hover:bg-raised', open && 'bg-raised')}>
                      <td className="px-1 align-top">
                        <button
                          className="flex h-6 w-6 items-center justify-center rounded text-fg-faint hover:text-fg"
                          onClick={() => toggle(d._id)}
                          title={open ? t.mongo.collapse : t.mongo.expand}
                        >
                          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      </td>
                      <td className="max-w-[220px] truncate px-3 py-1.5 font-code text-fg" title={d._id}>
                        {d._id}
                      </td>
                      {columns.map((k) => {
                        const dirty = `${d._id}|${k}` in pending
                        const isEditing = editing?.id === d._id && editing?.field === k
                        return (
                          <td
                            key={k}
                            onDoubleClick={() => setEditing({ id: d._id, field: k, value: d.preview[k] ?? '' })}
                            className={cx(
                              'max-w-[280px] cursor-cell truncate px-3 py-1.5 font-code text-fg-muted',
                              dirty && 'bg-accent-soft font-medium text-fg ring-1 ring-inset ring-accent/40'
                            )}
                            title={t.mongo.cellEdit}
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
                              d.preview[k] ?? ''
                            )}
                          </td>
                        )
                      })}
                      <td className="px-1 align-top">
                        <button
                          className="flex h-6 w-6 items-center justify-center rounded text-fg-muted hover:bg-bad/10 hover:text-bad"
                          onClick={() => void del(d._id)}
                          title={t.home.delete}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                    {open && (
                      <tr className="border-b border-line">
                        <td colSpan={colSpan} className="bg-code-bg p-0">
                          <pre className="max-h-80 overflow-auto p-3 font-code text-xs text-code-fg">{d.raw}</pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 分页 */}
      <div className="flex h-11 shrink-0 items-center border-t border-line bg-raised px-3">
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          pageSizeOptions={[10, 20, 50, 100]}
          disabled={pendingCount > 0}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPage(0)
            setPageSize(s)
          }}
        />
      </div>

      {insertOpen && (
        <Modal
          title={t.mongo.insertDoc}
          onClose={() => setInsertOpen(false)}
          footer={
            <>
              <Button onClick={() => setInsertOpen(false)}>{t.common.cancel}</Button>
              <Button variant="primary" onClick={() => void insert()}>
                {t.mongo.insert}
              </Button>
            </>
          }
        >
          <div className="mb-2 text-xs text-fg-muted">{t.mongo.insertHint}</div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-64 w-full resize-none rounded-md border border-line bg-code-bg p-3 font-code text-xs text-code-fg outline-none focus:border-accent"
            spellCheck={false}
          />
        </Modal>
      )}
    </div>
  )
}
