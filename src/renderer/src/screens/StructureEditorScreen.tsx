import { useEffect, useMemo, useState } from 'react'
import { Wrench, Plus, Trash2, Upload, RotateCcw, KeyRound, Hash, Link2 } from 'lucide-react'
import { useApp, type Tab } from '../store/useApp'
import { useT } from '../lib/i18n'
import { Button, Toggle, Badge, Modal, cx } from '../components/ui/primitives'
import type { ColumnDef, TableSchema } from '../../../shared/types'

type SubTab = 'fields' | 'indexes' | 'fks'

const TYPE_PRESETS: Record<string, string[]> = {
  relational: ['int', 'bigint', 'varchar(255)', 'text', 'boolean', 'datetime', 'timestamp', 'decimal(10,2)', 'json'],
  postgres: ['integer', 'bigint', 'varchar(255)', 'text', 'boolean', 'timestamptz', 'numeric(10,2)', 'jsonb', 'uuid'],
  sqlite: ['INTEGER', 'TEXT', 'REAL', 'BLOB', 'NUMERIC']
}

export function StructureEditorScreen({ tab }: { tab: Tab }): React.JSX.Element {
  const app = useApp()
  const t = useT()
  const conn = app.connections.find((c) => c.id === tab.connectionId)
  const type = conn?.type ?? 'mysql'

  const [original, setOriginal] = useState<TableSchema | null>(null)
  const [cols, setCols] = useState<ColumnDef[]>([])
  const [sub, setSub] = useState<SubTab>('fields')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [applying, setApplying] = useState(false)

  async function load(): Promise<void> {
    if (!conn) return
    try {
      const s = await window.onedb.sql.schema(conn.id, tab.database!, tab.schema, tab.table!)
      setOriginal(s)
      setCols(s.columns.map((c) => ({ ...c })))
    } catch (e) {
      app.toast('error', (e as Error).message)
    }
  }
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.table, tab.database, tab.schema])

  const presets = useMemo(() => (type === 'postgres' ? TYPE_PRESETS.postgres : type === 'sqlite' ? TYPE_PRESETS.sqlite : TYPE_PRESETS.relational), [type])

  const changedCount = useMemo(() => {
    if (!original) return 0
    const origMap = new Map(original.columns.map((c) => [c.name, c]))
    let n = 0
    for (const c of cols) {
      const o = origMap.get(c.name)
      if (!o || JSON.stringify(o) !== JSON.stringify(c)) n++
      origMap.delete(c.name)
    }
    return n + origMap.size
  }, [cols, original])

  function patch(i: number, p: Partial<ColumnDef>): void {
    setCols((prev) => prev.map((c, j) => (j === i ? { ...c, ...p } : c)))
  }
  function addCol(): void {
    setCols((prev) => [...prev, { name: '', type: presets[0], nullable: true, defaultValue: null }])
  }
  function removeCol(i: number): void {
    setCols((prev) => prev.filter((_, j) => j !== i))
  }
  function togglePK(i: number): void {
    setCols((prev) => prev.map((c, j) => (j === i ? { ...c, isPrimary: !c.isPrimary } : c)))
  }

  async function apply(): Promise<void> {
    if (!conn || !original) return
    setApplying(true)
    try {
      const modified: TableSchema = { ...original, columns: cols.filter((c) => c.name.trim()) }
      const ddl = await window.onedb.sql.applySchema(conn.id, {
        connectionId: conn.id,
        database: tab.database!,
        schema: tab.schema,
        table: tab.table!,
        original,
        modified
      })
      const real = ddl.filter((d) => !d.trim().startsWith('--'))
      app.toast('success', real.length ? `${t.struct.appliedDDL} ${real.length} ${t.struct.ddlUnit}` : t.struct.noChange)
      setPreviewOpen(false)
      await load()
    } catch (e) {
      app.toast('error', (e as Error).message)
    } finally {
      setApplying(false)
    }
  }

  if (!conn) return <div className="p-6 text-sm text-fg-muted">{t.sql.connInvalid}</div>
  if (!original) return <div className="p-6 text-sm text-fg-faint">{t.struct.loading}</div>

  return (
    <div className="flex h-full flex-col">
      {/* 头部 */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line bg-surface px-3">
        <Wrench size={15} className="text-accent" />
        <span className="font-code text-[13px] text-fg">{tab.table}</span>
        {original.engine && <span className="text-[11px] text-fg-faint">{original.engine}</span>}
        {original.rowCount != null && <span className="text-[11px] text-fg-faint">{original.rowCount} {t.struct.rowsUnit}</span>}
        <div className="ml-3 flex items-center gap-0.5">
          {(['fields', 'indexes', 'fks'] as SubTab[]).map((k) => (
            <button
              key={k}
              onClick={() => setSub(k)}
              className={cx('rounded px-2.5 py-1 text-xs', sub === k ? 'bg-accent-soft text-accent' : 'text-fg-muted hover:bg-canvas')}
            >
              {k === 'fields' ? `${t.struct.tabFields} (${cols.length})` : k === 'indexes' ? `${t.struct.tabIndexes} (${original.indexes.length})` : `${t.struct.tabFks} (${original.foreignKeys.length})`}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {changedCount > 0 && <Badge color="var(--warning)">{changedCount} {t.struct.changes}</Badge>}
          <Button size="sm" variant="ghost" icon={<RotateCcw size={13} />} onClick={() => setCols(original.columns.map((c) => ({ ...c })))} disabled={!changedCount}>
            {t.struct.reset}
          </Button>
          <Button size="sm" variant="primary" icon={<Upload size={13} />} onClick={() => setPreviewOpen(true)} disabled={!changedCount}>
            {t.struct.applyChanges}
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-surface">
        {sub === 'fields' && (
          <table className="w-full border-collapse text-[12.5px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-raised text-left text-fg-muted">
                <th className="w-10 border-b border-r border-line px-2 py-2 text-center text-[11px]">#</th>
                <th className="w-52 border-b border-r border-line px-3 py-2 font-semibold">{t.struct.colName}</th>
                <th className="w-48 border-b border-r border-line px-3 py-2 font-semibold">{t.struct.type}</th>
                <th className="w-16 border-b border-r border-line px-2 py-2 text-center font-semibold">{t.struct.pk}</th>
                <th className="w-16 border-b border-r border-line px-2 py-2 text-center font-semibold">{t.struct.notnull}</th>
                <th className="w-16 border-b border-r border-line px-2 py-2 text-center font-semibold">{t.struct.autoInc}</th>
                <th className="w-40 border-b border-r border-line px-3 py-2 font-semibold">{t.struct.default}</th>
                <th className="border-b border-r border-line px-3 py-2 font-semibold">{t.struct.comment}</th>
                <th className="w-10 border-b border-line px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {cols.map((c, i) => {
                const o = original.columns.find((x) => x.name === c.name)
                const isNew = !o
                const dirty = o && JSON.stringify(o) !== JSON.stringify(c)
                return (
                  <tr key={i} className={cx(isNew && 'bg-ok/10', dirty && 'bg-accent-soft/40')}>
                    <td className="border-b border-r border-line-soft px-2 py-1 text-center font-mono text-[11px] text-fg-faint">{i + 1}</td>
                    <td className="border-b border-r border-line-soft px-2 py-1">
                      <CellInput value={c.name} onChange={(v) => patch(i, { name: v })} mono />
                    </td>
                    <td className="border-b border-r border-line-soft px-2 py-1">
                      <div className="flex items-center gap-1">
                        <CellInput value={c.type} onChange={(v) => patch(i, { type: v })} mono list="struct-types" />
                      </div>
                    </td>
                    <td className="border-b border-r border-line-soft px-2 py-1 text-center">
                      <button onClick={() => togglePK(i)} className={cx('mx-auto flex h-6 w-6 items-center justify-center rounded', c.isPrimary ? 'text-warn' : 'text-fg-faint hover:text-fg')}>
                        <KeyRound size={14} />
                      </button>
                    </td>
                    <td className="flex items-center justify-center border-b border-r border-line-soft px-2 py-1">
                      <Toggle checked={!c.nullable} onChange={(v) => patch(i, { nullable: !v })} />
                    </td>
                    <td className="flex items-center justify-center border-b border-r border-line-soft px-2 py-1">
                      <Toggle checked={!!c.isAutoIncrement} onChange={(v) => patch(i, { isAutoIncrement: v })} />
                    </td>
                    <td className="border-b border-r border-line-soft px-2 py-1">
                      <CellInput value={c.defaultValue ?? ''} onChange={(v) => patch(i, { defaultValue: v || null })} mono placeholder="NULL" />
                    </td>
                    <td className="border-b border-r border-line-soft px-2 py-1">
                      <CellInput value={c.comment ?? ''} onChange={(v) => patch(i, { comment: v })} placeholder={t.struct.comment} />
                    </td>
                    <td className="border-b border-line px-2 py-1 text-center">
                      <button className="text-fg-faint hover:text-bad" onClick={() => removeCol(i)} title={t.struct.deleteCol}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {sub === 'indexes' && (
          <div className="p-3">
            <datalist id="struct-types">{presets.map((p) => <option key={p} value={p} />)}</datalist>
            {original.indexes.length === 0 ? (
              <div className="p-6 text-center text-xs text-fg-faint">{t.struct.noIndexes}</div>
            ) : (
              original.indexes.map((idx) => (
                <div key={idx.name} className="mb-2 flex items-center gap-2 rounded-md border border-line bg-canvas px-3 py-2 text-xs">
                  <Hash size={13} className="text-info" />
                  <span className="font-code font-semibold text-fg">{idx.name}</span>
                  {idx.unique && <Badge color="var(--info)">UNIQUE</Badge>}
                  <span className="text-fg-muted">{idx.type}</span>
                  <span className="ml-auto font-code text-fg">({idx.columns.join(', ')})</span>
                </div>
              ))
            )}
          </div>
        )}

        {sub === 'fks' && (
          <div className="p-3">
            {original.foreignKeys.length === 0 ? (
              <div className="p-6 text-center text-xs text-fg-faint">{t.struct.noFks}</div>
            ) : (
              original.foreignKeys.map((fk) => (
                <div key={fk.name} className="mb-2 flex items-center gap-2 rounded-md border border-line bg-canvas px-3 py-2 text-xs">
                  <Link2 size={13} className="text-accent" />
                  <span className="font-code text-fg">{fk.column}</span>
                  <span className="text-fg-faint">→</span>
                  <span className="font-code text-fg">{fk.refTable}.{fk.refColumn}</span>
                  {fk.onDelete && <span className="ml-auto text-fg-muted">ON DELETE {fk.onDelete}</span>}
                </div>
              ))
            )}
          </div>
        )}

        {sub === 'fields' && (
          <div className="p-3">
            <button className="flex items-center gap-1.5 rounded-md border border-dashed border-line px-3 py-2 text-xs text-fg-muted hover:border-accent hover:text-accent" onClick={addCol}>
              <Plus size={13} /> {t.struct.addField}
            </button>
          </div>
        )}
      </div>

      {previewOpen && (
        <Modal
          title={t.struct.confirmTitle}
          onClose={() => setPreviewOpen(false)}
          footer={
            <>
              <Button onClick={() => setPreviewOpen(false)}>{t.common.cancel}</Button>
              <Button variant="primary" icon={applying ? <RotateCcw size={13} className="animate-spin" /> : undefined} onClick={() => void apply()} disabled={applying}>
                {t.struct.execDDL}
              </Button>
            </>
          }
        >
          <p className="mb-3 text-[13px] text-fg-muted">{t.struct.confirmDesc.replace('{table}', tab.table ?? '').replace('{n}', String(changedCount))}</p>
          <div className="rounded-md border border-line bg-canvas p-2 text-xs">
            {cols.filter((c) => c.name).map((c, i) => (
              <div key={i} className="flex items-center gap-2 border-b border-line-soft py-1 last:border-0">
                <span className="font-code text-fg">{c.name || t.struct.unnamed}</span>
                <span className="font-code text-accent">{c.type}</span>
                {c.isPrimary && <Badge color="var(--warning)">PK</Badge>}
                {!c.nullable && <span className="text-fg-faint">NOT NULL</span>}
                {c.isAutoIncrement && <span className="text-fg-faint">AUTO_INCREMENT</span>}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}

function CellInput({
  value,
  onChange,
  mono,
  placeholder,
  list
}: {
  value: string
  onChange: (v: string) => void
  mono?: boolean
  placeholder?: string
  list?: string
}): React.JSX.Element {
  return (
    <input
      value={value}
      list={list}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cx(
        'h-6 w-full rounded border border-transparent bg-transparent px-1.5 text-[12.5px] text-fg outline-none hover:border-line focus:border-accent',
        mono && 'font-code',
        'placeholder:text-fg-faint'
      )}
    />
  )
}
