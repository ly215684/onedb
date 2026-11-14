import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { DbType } from '../../../shared/types'
import { useT } from '../lib/i18n'
import { Button, Field, Input, Modal, Spinner } from '../components/ui/primitives'

type RelationalKind = 'mysql' | 'postgres' | 'sqlite'

const TYPE_OPTIONS: Record<RelationalKind, string[]> = {
  mysql: ['INT', 'BIGINT', 'VARCHAR(255)', 'TEXT', 'DECIMAL(10,2)', 'DATETIME', 'TIMESTAMP', 'BOOLEAN', 'JSON'],
  postgres: ['integer', 'bigint', 'text', 'varchar(255)', 'numeric(10,2)', 'timestamp', 'boolean', 'jsonb', 'uuid'],
  sqlite: ['INTEGER', 'TEXT', 'REAL', 'BLOB', 'NUMERIC']
}

const DEFAULT_TYPE: Record<RelationalKind, string> = {
  mysql: 'BIGINT',
  postgres: 'bigint',
  sqlite: 'INTEGER'
}

interface ColumnDraft {
  name: string
  type: string
  nullable: boolean
  primary: boolean
  autoIncrement: boolean
  defaultValue: string
}

function kindOf(dbType: DbType): RelationalKind {
  return dbType === 'postgres' ? 'postgres' : dbType === 'sqlite' ? 'sqlite' : 'mysql'
}

const GRID = 'minmax(0,1.1fr) minmax(0,1.1fr) 52px 52px 52px minmax(0,1fr) 32px'

/** Navicat 风格建表弹窗：表名 + 列定义 */
export function CreateTableModal({
  connectionId,
  dbType,
  database,
  schema,
  onClose,
  onCreated
}: {
  connectionId: string
  dbType: DbType
  database: string
  schema?: string
  onClose: () => void
  onCreated: (table: string) => void
}): React.JSX.Element {
  const t = useT()
  const kind = kindOf(dbType)
  const [name, setName] = useState('')
  const [columns, setColumns] = useState<ColumnDraft[]>([
    { name: 'id', type: DEFAULT_TYPE[kind], nullable: false, primary: true, autoIncrement: true, defaultValue: '' }
  ])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const patch = (i: number, p: Partial<ColumnDraft>): void => {
    setColumns((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...p } : c)))
  }

  const addColumn = (): void => {
    setColumns((prev) => [...prev, { name: '', type: DEFAULT_TYPE[kind], nullable: true, primary: false, autoIncrement: false, defaultValue: '' }])
  }

  const removeColumn = (i: number): void => {
    setColumns((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev))
  }

  const close = (): void => {
    if (!busy) onClose()
  }

  const submit = async (): Promise<void> => {
    const tableName = name.trim()
    if (!tableName) {
      setError(t.menu.nameRequired)
      return
    }
    const seen = new Set<string>()
    for (const c of columns) {
      const col = c.name.trim()
      if (!col) {
        setError(t.menu.nameRequired)
        return
      }
      if (seen.has(col.toLowerCase())) {
        setError(t.menu.duplicateColumn)
        return
      }
      seen.add(col.toLowerCase())
      if (!c.type.trim()) {
        setError(t.menu.typeRequired)
        return
      }
    }
    setBusy(true)
    setError(null)
    try {
      await window.onedb.db.createTable(connectionId, database, schema, {
        name: tableName,
        columns: columns.map((c) => ({
          name: c.name.trim(),
          type: c.type.trim(),
          nullable: c.nullable,
          primary: c.primary,
          autoIncrement: c.autoIncrement,
          defaultValue: c.defaultValue.trim() || null
        }))
      })
      onCreated(tableName)
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={t.menu.newTable}
      onClose={close}
      width={760}
      footer={
        <>
          <Button onClick={close} disabled={busy}>
            {t.common.cancel}
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={busy} icon={busy ? <Spinner /> : undefined}>
            {t.menu.create}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={t.menu.tableName}>
          <Input value={name} disabled={busy} autoFocus onChange={(e) => setName(e.target.value)} />
        </Field>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-fg-muted">{t.menu.colName}</span>
          <datalist id="ct-type-list">
            {TYPE_OPTIONS[kind].map((ty) => (
              <option key={ty} value={ty} />
            ))}
          </datalist>

          <div
            className="grid items-center gap-2 px-1 text-[11px] font-medium text-fg-faint"
            style={{ gridTemplateColumns: GRID }}
          >
            <span>{t.menu.colName}</span>
            <span>{t.menu.colType}</span>
            <span className="text-center">{t.menu.nullable}</span>
            <span className="text-center">{t.menu.primary}</span>
            <span className="text-center">{t.menu.autoInc}</span>
            <span>{t.menu.defaultValue}</span>
            <span />
          </div>

          {columns.map((c, i) => (
            <div key={i} className="grid items-center gap-2" style={{ gridTemplateColumns: GRID }}>
              <Input className="h-7 text-xs" value={c.name} disabled={busy} onChange={(e) => patch(i, { name: e.target.value })} />
              <Input
                className="h-7 text-xs"
                list="ct-type-list"
                value={c.type}
                disabled={busy}
                onChange={(e) => patch(i, { type: e.target.value })}
              />
              <span className="flex justify-center">
                <input
                  type="checkbox"
                  checked={c.nullable}
                  disabled={busy}
                  onChange={(e) => patch(i, { nullable: e.target.checked })}
                  className="h-3.5 w-3.5 accent-[var(--accent)]"
                />
              </span>
              <span className="flex justify-center">
                <input
                  type="checkbox"
                  checked={c.primary}
                  disabled={busy}
                  onChange={(e) =>
                    patch(i, {
                      primary: e.target.checked,
                      autoIncrement: e.target.checked ? c.autoIncrement : false
                    })
                  }
                  className="h-3.5 w-3.5 accent-[var(--accent)]"
                />
              </span>
              <span className="flex justify-center">
                <input
                  type="checkbox"
                  checked={c.autoIncrement}
                  disabled={busy}
                  onChange={(e) =>
                    patch(i, {
                      autoIncrement: e.target.checked,
                      primary: e.target.checked ? true : c.primary,
                      type: e.target.checked && kind === 'sqlite' ? 'INTEGER' : c.type
                    })
                  }
                  className="h-3.5 w-3.5 accent-[var(--accent)]"
                />
              </span>
              <Input
                className="h-7 text-xs"
                value={c.autoIncrement ? '' : c.defaultValue}
                placeholder={c.autoIncrement ? t.menu.autoInc : ''}
                disabled={busy || c.autoIncrement}
                onChange={(e) => patch(i, { defaultValue: e.target.value })}
              />
              <button
                type="button"
                title={t.menu.deleteColumn}
                disabled={busy || columns.length <= 1}
                onClick={() => removeColumn(i)}
                className="flex h-7 w-7 items-center justify-center rounded text-fg-muted hover:bg-bad/10 hover:text-bad disabled:cursor-default disabled:opacity-30"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={addColumn}
            disabled={busy}
            className="mt-1 flex items-center gap-1.5 rounded-md border border-dashed border-line px-3 py-2 text-xs text-fg-muted hover:border-accent hover:text-accent disabled:opacity-50"
          >
            <Plus size={13} /> {t.menu.addColumn}
          </button>
        </div>

        {error && <div className="rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">{error}</div>}
      </div>
    </Modal>
  )
}
