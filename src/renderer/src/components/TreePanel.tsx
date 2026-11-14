import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ChevronRight,
  Database as DbIcon,
  Layers,
  Table2,
  FileJson,
  KeyRound,
  Hash,
  Terminal,
  Wrench,
  Plus,
  Search,
  RefreshCw,
  PlugZap,
  Power,
  Circle,
  Trash2,
  Pencil,
  Eraser,
  FolderPlus
} from 'lucide-react'
import { isOnline, useApp } from '../store/useApp'
import { DB_META, dbColor } from '../lib/dbMeta'
import { useT, useShowDbColor } from '../lib/i18n'
import type { ConnectionConfig, DbType } from '../../../shared/types'
import { cx, IconButton } from './ui/primitives'
import { ContextMenu, type MenuEntry } from './ui/ContextMenu'
import { ConfirmDialog, PromptDialog } from './ui/dialogs'
import { CreateTableModal } from '../screens/CreateTableModal'

type NodeType = 'connection' | 'database' | 'schema' | 'table' | 'collection' | 'keyspace' | 'key' | 'index'

interface RawNode {
  key: string
  label: string
  type: NodeType
  connectionId: string
  dbType: DbType
  database?: string
  schema?: string
  redisDb?: number
}

const REDIS_DBS = Array.from({ length: 16 }, (_, i) => i)

function nodeIcon(n: RawNode, open: boolean, showColor: boolean, online = true): ReactNode {
  switch (n.type) {
    case 'connection': {
      const color = showColor ? dbColor(n.dbType) : 'var(--text-disabled)'
      return online ? (
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      ) : (
        <span className="h-2.5 w-2.5 rounded-full" style={{ border: `1.5px solid ${color}`, opacity: 0.45 }} />
      )
    }
    case 'database':
      return <DbIcon size={14} className="text-fg-muted" />
    case 'schema':
      return <Layers size={14} className="text-info" />
    case 'table':
      return <Table2 size={14} className="text-accent" />
    case 'collection':
      return <FileJson size={14} className="text-mongo" />
    case 'keyspace':
      return open ? <DbIcon size={14} className="text-redis" /> : <Circle size={12} className="text-redis" />
    case 'key':
      return <KeyRound size={13} className="text-warn" />
    case 'index':
      return <Hash size={13} className="text-fg-muted" />
  }
}

export function TreePanel(): React.JSX.Element {
  const app = useApp()
  const tx = useT()
  const showColor = useShowDbColor()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [children, setChildren] = useState<Record<string, RawNode[]>>({})
  const [loading, setLoading] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [menu, setMenu] = useState<{ x: number; y: number; entries: MenuEntry[] } | null>(null)
  const [confirmState, setConfirmState] = useState<{
    title: string
    message: string
    confirmText?: string
    danger?: boolean
    action: () => Promise<void>
  } | null>(null)
  const [promptState, setPromptState] = useState<{
    title: string
    label: string
    initial?: string
    confirmText?: string
    onSubmit: (value: string) => Promise<void>
  } | null>(null)
  const [createTableNode, setCreateTableNode] = useState<RawNode | null>(null)

  const setLoad = (key: string, on: boolean): void => {
    setLoading((prev) => {
      const n = new Set(prev)
      on ? n.add(key) : n.delete(key)
      return n
    })
  }

  async function loadChildren(n: RawNode): Promise<RawNode[]> {
    const id = n.connectionId
    const t = n.dbType
    try {
      if (n.type === 'connection') {
        if (t === 'redis') {
          return REDIS_DBS.map((d) => ({
            key: `${id}:rdb:${d}`,
            label: `db${d}`,
            type: 'keyspace' as const,
            connectionId: id,
            dbType: t,
            redisDb: d
          }))
        }
        const dbs = await window.onedb.tree.databases(id)
        return dbs.map((d) => ({
          key: `${id}:db:${d}`,
          label: d,
          type: 'database' as const,
          connectionId: id,
          dbType: t,
          database: d
        }))
      }
      if (n.type === 'database') {
        if (t === 'mongo' || t === 'mongo-srv') {
          const cols = await window.onedb.tree.collections(id, n.database!)
          return cols.map((c) => ({
            key: `${id}:col:${n.database}:${c}`,
            label: c,
            type: 'collection' as const,
            connectionId: id,
            dbType: t,
            database: n.database
          }))
        }
        if (DB_META[t].supportsSchema) {
          const schs = await window.onedb.tree.schemas(id, n.database!)
          return schs.map((s) => ({
            key: `${id}:sc:${n.database}:${s}`,
            label: s,
            type: 'schema' as const,
            connectionId: id,
            dbType: t,
            database: n.database,
            schema: s
          }))
        }
        const tbls = await window.onedb.tree.tables(id, n.database!)
        return tbls.map((tb) => ({
          key: `${id}:tb:${n.database}::${tb}`,
          label: tb,
          type: 'table' as const,
          connectionId: id,
          dbType: t,
          database: n.database
        }))
      }
      if (n.type === 'schema') {
        const tbls = await window.onedb.tree.tables(id, n.database!, n.schema)
        return tbls.map((tb) => ({
          key: `${id}:tb:${n.database}:${n.schema}:${tb}`,
          label: tb,
          type: 'table' as const,
          connectionId: id,
          dbType: t,
          database: n.database,
          schema: n.schema
        }))
      }
      if (n.type === 'keyspace') {
        const keys = await window.onedb.redis.scan(id, n.redisDb ?? 0, '*')
        return keys.slice(0, 200).map((k) => ({
          key: `${id}:rk:${n.redisDb}:${k.key}`,
          label: k.key,
          type: 'key' as const,
          connectionId: id,
          dbType: t,
          redisDb: n.redisDb
        }))
      }
    } catch (e) {
      app.toast('error', (e as Error).message)
    }
    return []
  }

  async function ensureChildren(n: RawNode): Promise<RawNode[]> {
    if (children[n.key]) return children[n.key]
    setLoad(n.key, true)
    const kids = await loadChildren(n)
    setChildren((prev) => ({ ...prev, [n.key]: kids }))
    setLoad(n.key, false)
    return kids
  }

  async function toggle(n: RawNode): Promise<void> {
    const isOpen = expanded.has(n.key)
    if (isOpen) {
      setExpanded((prev) => {
        const x = new Set(prev)
        x.delete(n.key)
        return x
      })
      return
    }
    await ensureChildren(n)
    setExpanded((prev) => new Set(prev).add(n.key))
  }

  function invalidate(prefix: string): void {
    setChildren((prev) => {
      const n: Record<string, RawNode[]> = {}
      for (const k of Object.keys(prev)) if (!k.startsWith(prefix) && !k.includes(prefix)) n[k] = prev[k]
      return n
    })
    setExpanded((prev) => {
      const x = new Set<string>()
      for (const k of prev) if (!k.includes(prefix)) x.add(k)
      return x
    })
  }

  function makeConnNode(conn: ConnectionConfig): RawNode {
    return { key: `c:${conn.id}`, label: conn.name, type: 'connection', connectionId: conn.id, dbType: conn.type }
  }

  function dbNodeOf(n: RawNode): RawNode {
    return {
      key: `${n.connectionId}:db:${n.database}`,
      label: n.database!,
      type: 'database',
      connectionId: n.connectionId,
      dbType: n.dbType,
      database: n.database
    }
  }

  function parentOf(n: RawNode): RawNode {
    if (n.schema) {
      return {
        key: `${n.connectionId}:sc:${n.database}:${n.schema}`,
        label: n.schema,
        type: 'schema',
        connectionId: n.connectionId,
        dbType: n.dbType,
        database: n.database,
        schema: n.schema
      }
    }
    return dbNodeOf(n)
  }

  /** 重新拉取父节点的子节点，避免使用失效缓存；可在清理后重新展开 */
  async function reload(parent: RawNode, opts?: { purge?: string; expand?: boolean }): Promise<void> {
    const wasOpen = expanded.has(parent.key) || !!opts?.expand
    if (opts?.purge) invalidate(opts.purge)
    setChildren((prev) => {
      const next = { ...prev }
      delete next[parent.key]
      return next
    })
    if (!wasOpen) return
    setLoad(parent.key, true)
    try {
      const kids = await loadChildren(parent)
      setChildren((prev) => ({ ...prev, [parent.key]: kids }))
      setExpanded((prev) => new Set(prev).add(parent.key))
    } finally {
      setLoad(parent.key, false)
    }
  }

  function closeTabsFor(
    connId: string,
    db: string,
    match?: { schema?: string; table?: string; collection?: string }
  ): void {
    for (const tab of app.tabs) {
      if (tab.connectionId !== connId || tab.database !== db) continue
      if (match && 'schema' in match && tab.schema !== match.schema) continue
      if (match?.table !== undefined && tab.table !== match.table) continue
      if (match?.collection !== undefined && tab.collection !== match.collection) continue
      app.closeTab(tab.id)
    }
  }

  function renameTabs(connId: string, db: string, oldName: string, newName: string, kind: 'table' | 'collection'): void {
    for (const tab of app.tabs) {
      if (tab.connectionId !== connId || tab.database !== db) continue
      if (kind === 'table') {
        if (tab.table !== oldName) continue
        const title = tab.kind === 'structure' ? `${tx.data.structure} · ${newName}` : newName
        app.updateTab(tab.id, { table: newName, title })
      } else {
        if (tab.collection !== oldName) continue
        app.updateTab(tab.id, { collection: newName, title: newName })
      }
    }
  }

  async function expandConnection(conn: ConnectionConfig): Promise<void> {
    const n = makeConnNode(conn)
    invalidate(conn.id)
    await ensureChildren(n)
    setExpanded((prev) => new Set(prev).add(n.key))
  }

  // 与连接总览联动：外部连接/断开后同步树的展开与缓存
  const prevConnected = useRef(app.connected)
  useEffect(() => {
    const prev = prevConnected.current
    prevConnected.current = app.connected
    const ids = new Set([...Object.keys(prev), ...Object.keys(app.connected)])
    for (const id of ids) {
      const was = id in prev
      const now = id in app.connected
      if (was && !now) {
        invalidate(id)
      } else if (!was && now) {
        const conn = app.connections.find((c) => c.id === id)
        if (conn) void expandConnection(conn)
      }
    }
  }, [app.connected])

  async function onConnection(conn: ConnectionConfig): Promise<void> {
    const n: RawNode = {
      key: `c:${conn.id}`,
      label: conn.name,
      type: 'connection',
      connectionId: conn.id,
      dbType: conn.type
    }
    if (!isOnline(app.connected, conn.id)) {
      // 连接成功后由上面的联动逻辑自动展开
      await app.connect(conn.id)
      return
    }
    await toggle(n)
  }

  function openLeaf(n: RawNode): void {
    const conn = app.connections.find((c) => c.id === n.connectionId)
    if (n.type === 'table') {
      app.openTab({
        kind: 'data',
        title: n.label,
        connectionId: n.connectionId,
        dbType: n.dbType,
        database: n.database,
        schema: n.schema,
        table: n.label
      })
    } else if (n.type === 'collection') {
      app.openTab({
        kind: 'mongo',
        title: n.label,
        connectionId: n.connectionId,
        dbType: n.dbType,
        database: n.database,
        collection: n.label
      })
    } else if (n.type === 'keyspace') {
      app.openTab({
        kind: 'redis',
        title: `db${n.redisDb}`,
        connectionId: n.connectionId,
        dbType: n.dbType,
        redisDb: n.redisDb
      })
    } else if (n.type === 'key') {
      app.openTab({
        kind: 'redis',
        title: `${conn?.name} · ${n.label}`,
        connectionId: n.connectionId,
        dbType: n.dbType,
        redisDb: n.redisDb,
        key: n.label
      })
    }
  }

  function openMenu(e: React.MouseEvent, entries: MenuEntry[]): void {
    e.preventDefault()
    e.stopPropagation()
    if (!entries.length) return
    setMenu({ x: e.clientX, y: e.clientY, entries })
  }

  function connectionMenu(conn: ConnectionConfig): MenuEntry[] {
    const online = isOnline(app.connected, conn.id)
    const entries: MenuEntry[] = []
    if (online && (conn.type === 'mysql' || conn.type === 'postgres')) {
      entries.push({
        label: tx.menu.newDatabase,
        icon: <FolderPlus size={13} />,
        onSelect: () => {
          setMenu(null)
          setPromptState({
            title: tx.menu.newDatabase,
            label: tx.menu.dbName,
            confirmText: tx.menu.create,
            onSubmit: async (name) => {
              await window.onedb.db.createDatabase(conn.id, name)
              app.toast('success', `${tx.menu.created}: ${name}`)
              await reload(makeConnNode(conn), { expand: true })
            }
          })
        }
      })
    }
    if (entries.length) entries.push({ separator: true })
    entries.push({
      label: tx.menu.deleteConnection,
      icon: <Trash2 size={13} />,
      danger: true,
      onSelect: () => {
        setMenu(null)
        setConfirmState({
          title: tx.menu.deleteConnection,
          message: tx.menu.confirmDeleteConnection.replace('{name}', conn.name),
          confirmText: tx.menu.deleteConnection,
          danger: true,
          action: async () => {
            await app.removeConnection(conn.id)
          }
        })
      }
    })
    return entries
  }

  function nodeMenu(n: RawNode): MenuEntry[] {
    if (!isOnline(app.connected, n.connectionId)) return []
    const mongo = n.dbType === 'mongo' || n.dbType === 'mongo-srv'

    if (n.type === 'database') {
      const entries: MenuEntry[] = []
      if (mongo) {
        entries.push({
          label: tx.menu.newCollection,
          icon: <Plus size={13} />,
          onSelect: () => {
            setMenu(null)
            setPromptState({
              title: tx.menu.newCollection,
              label: tx.menu.collectionName,
              confirmText: tx.menu.create,
              onSubmit: async (name) => {
                await window.onedb.mongo.createCollection(n.connectionId, n.database!, name)
                app.toast('success', `${tx.menu.created}: ${name}`)
                await reload(n)
              }
            })
          }
        })
      } else if (n.dbType === 'mysql' || n.dbType === 'sqlite') {
        entries.push({
          label: tx.menu.newTable,
          icon: <Table2 size={13} />,
          onSelect: () => {
            setMenu(null)
            setCreateTableNode(n)
          }
        })
      }
      if (n.dbType !== 'sqlite') {
        if (entries.length) entries.push({ separator: true })
        entries.push({
          label: tx.menu.dropDatabase,
          icon: <Trash2 size={13} />,
          danger: true,
          onSelect: () => {
            setMenu(null)
            const conn = app.connections.find((c) => c.id === n.connectionId)
            setConfirmState({
              title: tx.menu.dropDatabase,
              message: tx.menu.confirmDropDatabase.replace('{name}', n.label),
              confirmText: tx.menu.dropDatabase,
              danger: true,
              action: async () => {
                await window.onedb.db.dropDatabase(n.connectionId, n.database!)
                closeTabsFor(n.connectionId, n.database!)
                app.toast('success', `${tx.menu.dropped}: ${n.label}`)
                if (conn) await reload(makeConnNode(conn), { purge: n.connectionId, expand: true })
              }
            })
          }
        })
      }
      return entries
    }

    if (n.type === 'schema') {
      if (n.dbType !== 'postgres') return []
      return [
        {
          label: tx.menu.newTable,
          icon: <Table2 size={13} />,
          onSelect: () => {
            setMenu(null)
            setCreateTableNode(n)
          }
        }
      ]
    }

    if (n.type === 'table') {
      const parent = parentOf(n)
      return [
        {
          label: tx.menu.renameTable,
          icon: <Pencil size={13} />,
          onSelect: () => {
            setMenu(null)
            setPromptState({
              title: tx.menu.renameTable,
              label: tx.menu.newName,
              initial: n.label,
              confirmText: tx.menu.rename,
              onSubmit: async (newName) => {
                if (newName === n.label) return
                await window.onedb.db.renameTable(n.connectionId, n.database!, n.schema, n.label, newName)
                renameTabs(n.connectionId, n.database!, n.label, newName, 'table')
                app.toast('success', `${tx.menu.renamed}: ${newName}`)
                await reload(parent)
              }
            })
          }
        },
        { separator: true },
        {
          label: tx.menu.truncateTable,
          icon: <Eraser size={13} />,
          onSelect: () => {
            setMenu(null)
            setConfirmState({
              title: tx.menu.truncateTable,
              message: tx.menu.confirmTruncateTable.replace('{name}', n.label),
              confirmText: tx.menu.truncateTable,
              action: async () => {
                await window.onedb.db.truncateTable(n.connectionId, n.database!, n.schema, n.label)
                app.toast('success', `${tx.menu.truncated}: ${n.label}`)
              }
            })
          }
        },
        {
          label: tx.menu.dropTable,
          icon: <Trash2 size={13} />,
          danger: true,
          onSelect: () => {
            setMenu(null)
            setConfirmState({
              title: tx.menu.dropTable,
              message: tx.menu.confirmDropTable.replace('{name}', n.label),
              confirmText: tx.menu.dropTable,
              danger: true,
              action: async () => {
                await window.onedb.db.dropTable(n.connectionId, n.database!, n.schema, n.label)
                closeTabsFor(n.connectionId, n.database!, { schema: n.schema, table: n.label })
                app.toast('success', `${tx.menu.dropped}: ${n.label}`)
                await reload(parent)
              }
            })
          }
        }
      ]
    }

    if (n.type === 'collection') {
      const parent = dbNodeOf(n)
      return [
        {
          label: tx.menu.renameCollection,
          icon: <Pencil size={13} />,
          onSelect: () => {
            setMenu(null)
            setPromptState({
              title: tx.menu.renameCollection,
              label: tx.menu.newName,
              initial: n.label,
              confirmText: tx.menu.rename,
              onSubmit: async (newName) => {
                if (newName === n.label) return
                await window.onedb.mongo.renameCollection(n.connectionId, n.database!, n.label, newName)
                renameTabs(n.connectionId, n.database!, n.label, newName, 'collection')
                app.toast('success', `${tx.menu.renamed}: ${newName}`)
                await reload(parent)
              }
            })
          }
        },
        { separator: true },
        {
          label: tx.menu.clearCollection,
          icon: <Eraser size={13} />,
          onSelect: () => {
            setMenu(null)
            setConfirmState({
              title: tx.menu.clearCollection,
              message: tx.menu.confirmClearCollection.replace('{name}', n.label),
              confirmText: tx.menu.clearCollection,
              action: async () => {
                await window.onedb.mongo.clearCollection(n.connectionId, n.database!, n.label)
                app.toast('success', `${tx.menu.cleared}: ${n.label}`)
              }
            })
          }
        },
        {
          label: tx.menu.dropCollection,
          icon: <Trash2 size={13} />,
          danger: true,
          onSelect: () => {
            setMenu(null)
            setConfirmState({
              title: tx.menu.dropCollection,
              message: tx.menu.confirmDropCollection.replace('{name}', n.label),
              confirmText: tx.menu.dropCollection,
              danger: true,
              action: async () => {
                await window.onedb.mongo.dropCollection(n.connectionId, n.database!, n.label)
                closeTabsFor(n.connectionId, n.database!, { collection: n.label })
                app.toast('success', `${tx.menu.dropped}: ${n.label}`)
                await reload(parent)
              }
            })
          }
        }
      ]
    }

    return []
  }

  function renderRow(n: RawNode, depth: number): ReactNode {
    const open = expanded.has(n.key)
    const loadingKids = loading.has(n.key)
    const kids = children[n.key]
    const expandable = n.type !== 'table' && n.type !== 'collection' && n.type !== 'key' && n.type !== 'index'
    const filtered = query.trim() && !n.label.toLowerCase().includes(query.trim().toLowerCase())

    const click = (): void => {
      if (n.type === 'table' || n.type === 'collection' || n.type === 'key') {
        openLeaf(n)
      } else if (n.type === 'keyspace') {
        openLeaf(n)
        void toggle(n)
      } else if (n.type === 'database') {
        if (n.dbType !== 'mongo' && n.dbType !== 'mongo-srv') {
          app.openTab({
            kind: 'sql',
            title: `${n.database} · 查询`,
            connectionId: n.connectionId,
            dbType: n.dbType,
            database: n.database
          })
        }
        void toggle(n)
      } else {
        void toggle(n)
      }
    }

    return (
      <div key={n.key}>
        <div
          className={cx(
            'group flex h-[var(--h-tree)] cursor-pointer items-center gap-1.5 rounded pr-1.5 text-[13px] hover:bg-canvas',
            filtered && 'opacity-30'
          )}
          style={{ paddingLeft: depth * 14 + 6 }}
          onClick={click}
          onContextMenu={(e) => openMenu(e, nodeMenu(n))}
        >
          <span className="flex h-4 w-4 shrink-0 items-center justify-center text-fg-faint">
            {expandable ? (
              loadingKids ? (
                <RefreshCw size={12} className="animate-spin" />
              ) : (
                <ChevronRight size={13} className={cx('transition-transform', open && 'rotate-90')} />
              )
            ) : (
              <span className="ml-1 h-1 w-1 rounded-full bg-line" />
            )}
          </span>
          <span className="flex shrink-0 items-center">{nodeIcon(n, open, showColor)}</span>
          <span className="truncate text-fg">{n.label}</span>

          {/* 悬停快捷操作 */}
          <span className="ml-auto hidden shrink-0 items-center gap-0.5 group-hover:flex">
            {n.type === 'table' && (
              <>
                <MiniAct
                  title={tx.sql.structureDesign}
                  onClick={() =>
                    app.openTab({
                      kind: 'structure',
                      title: `${tx.data.structure} · ${n.label}`,
                      connectionId: n.connectionId,
                      dbType: n.dbType,
                      database: n.database,
                      schema: n.schema,
                      table: n.label
                    })
                  }
                >
                  <Wrench size={12} />
                </MiniAct>
              </>
            )}
            {(n.type === 'database' || n.type === 'schema') && DB_META[n.dbType].kind === 'relational' && (
                <MiniAct
                  title={`${tx.nav.newConnection} · ${tx.sql.querySuffix}`}
                  onClick={() =>
                    app.openTab({
                      kind: 'sql',
                    title: `${n.database} · ${tx.sql.querySuffix}`,
                    connectionId: n.connectionId,
                    dbType: n.dbType,
                    database: n.database,
                    schema: n.schema
                  })
                }
              >
                <Terminal size={12} />
              </MiniAct>
            )}
          </span>
        </div>
        {open && kids && kids.map((k) => renderRow(k, depth + 1))}
      </div>
    )
  }

  return (
    <>
      <aside className="flex w-[280px] shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">{tx.nav.explorer}</span>
        <IconButton className="h-6 w-6" title={tx.nav.newConnection} onClick={() => app.openQuickConnect()}>
          <Plus size={14} />
        </IconButton>
      </div>
      <div className="px-2.5 pb-2">
        <div className="flex h-7 items-center gap-1.5 rounded-md border border-line bg-canvas px-2">
          <Search size={12} className="text-fg-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tx.nav.filter}
            className="w-full bg-transparent text-xs text-fg outline-none placeholder:text-fg-faint"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-1.5 pb-3">
        {app.connections.length === 0 && (
          <div className="px-4 py-10 text-center text-xs text-fg-faint">
            {tx.nav.emptyTree}
            <div className="mt-3">
              <button className="text-accent hover:underline" onClick={() => app.openQuickConnect()}>
                {tx.nav.firstConnection}
              </button>
            </div>
          </div>
        )}
        {app.connections
          .filter((c) => !query.trim() || c.name.toLowerCase().includes(query.trim().toLowerCase()))
          .map((conn) => {
            const n: RawNode = {
              key: `c:${conn.id}`,
              label: conn.name,
              type: 'connection',
              connectionId: conn.id,
              dbType: conn.type
            }
            const open = expanded.has(n.key)
            const online = isOnline(app.connected, conn.id)
            const kids = children[n.key]
            return (
              <div key={conn.id}>
                <div
                  className="group flex h-[var(--h-tree)] cursor-pointer items-center gap-1.5 rounded pr-1 text-[13px] hover:bg-canvas"
                  style={{ paddingLeft: 6 }}
                  onClick={() => void onConnection(conn)}
                  onContextMenu={(e) => openMenu(e, connectionMenu(conn))}
                >
                  <ChevronRight
                    size={13}
                    className={cx('shrink-0 text-fg-faint transition-transform', open && 'rotate-90')}
                  />
                  {nodeIcon(n, open, showColor, online)}
                  <span className={cx('truncate font-medium', online ? 'text-fg' : 'text-fg-muted')}>{conn.name}</span>
                  <span className="ml-auto hidden shrink-0 items-center gap-0.5 group-hover:flex">
                    {online ? (
                      <MiniAct
                        title={tx.home.disconnect}
                        onClick={() => {
                          void app.disconnect(conn.id)
                        }}
                      >
                        <Power size={12} />
                      </MiniAct>
                    ) : (
                      <MiniAct title={tx.home.connect} onClick={() => void onConnection(conn)}>
                        <PlugZap size={12} />
                      </MiniAct>
                    )}
                  </span>
                </div>
                {open && kids && kids.map((k) => renderRow(k, 1))}
              </div>
            )
          })}
      </div>
      </aside>

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} entries={menu.entries} onClose={() => setMenu(null)} />
      )}
      {confirmState && (
        <ConfirmDialog
          title={confirmState.title}
          message={confirmState.message}
          confirmText={confirmState.confirmText}
          danger={confirmState.danger}
          onConfirm={confirmState.action}
          onClose={() => setConfirmState(null)}
        />
      )}
      {promptState && (
        <PromptDialog
          title={promptState.title}
          label={promptState.label}
          initial={promptState.initial}
          confirmText={promptState.confirmText}
          onSubmit={promptState.onSubmit}
          onClose={() => setPromptState(null)}
        />
      )}
      {createTableNode && (
        <CreateTableModal
          connectionId={createTableNode.connectionId}
          dbType={createTableNode.dbType}
          database={createTableNode.database!}
          schema={createTableNode.schema}
          onClose={() => setCreateTableNode(null)}
          onCreated={async (table) => {
            const parent = createTableNode
            setCreateTableNode(null)
            app.toast('success', `${tx.menu.created}: ${table}`)
            await reload(parent)
          }}
        />
      )}
    </>
  )
}

function MiniAct({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }): React.JSX.Element {
  return (
    <button
      title={title}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="flex h-5 w-5 items-center justify-center rounded text-fg-muted hover:bg-accent-soft hover:text-accent"
    >
      {children}
    </button>
  )
}
