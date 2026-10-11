import { contextBridge, ipcRenderer } from 'electron'
import type {
  ConnectionConfig,
  QueryRequest,
  SchemaChange,
  PendingChange,
  AppSettings,
  TestResult,
  QueryResult,
  TableSchema,
  ERDiagram,
  MongoDocResult,
  RedisKeyInfo,
  RedisValue
} from '../shared/types'

interface Envelope<T> {
  ok: boolean
  data?: T
  error?: string
}

// 主进程统一返回 { ok, data | error } 信封，这里拆包：失败抛错，成功返回 data。
async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const res = (await ipcRenderer.invoke(channel, ...args)) as Envelope<T>
  if (res && res.ok === false) throw new Error(res.error || '未知错误')
  return res?.data as T
}

const api = {
  win: {
    minimize: (): void => ipcRenderer.send('win:minimize'),
    maximize: (): void => ipcRenderer.send('win:maximize'),
    close: (): void => ipcRenderer.send('win:close')
  },
  conn: {
    list: () => invoke<ConnectionConfig[]>('conn:list'),
    save: (list: ConnectionConfig[]) => invoke<boolean>('conn:save', list),
    test: (config: ConnectionConfig) => invoke<TestResult>('conn:test', config),
    connect: (config: ConnectionConfig) => invoke<{ version: string }>('conn:connect', config),
    disconnect: (id: string) => invoke<boolean>('conn:disconnect', id),
    isConnected: (id: string) => invoke<boolean>('conn:isConnected', id)
  },
  tree: {
    databases: (id: string) => invoke<string[]>('tree:databases', id),
    schemas: (id: string, db: string) => invoke<string[]>('tree:schemas', id, db),
    tables: (id: string, db: string, schema?: string) => invoke<string[]>('tree:tables', id, db, schema),
    collections: (id: string, db: string) => invoke<string[]>('tree:collections', id, db),
    indexes: (id: string, db: string, col: string) => invoke<string[]>('tree:indexes', id, db, col)
  },
  sql: {
    query: (id: string, req: QueryRequest) => invoke<QueryResult>('sql:query', id, req),
    schema: (id: string, db: string, schema: string | undefined, table: string) => invoke<TableSchema>('sql:schema', id, db, schema, table),
    applySchema: (id: string, change: SchemaChange) => invoke<string[]>('sql:applySchema', id, change),
    applyData: (id: string, db: string, schema: string | undefined, table: string, changes: PendingChange[]) =>
      invoke<number>('sql:applyData', id, db, schema, table, changes),
    er: (id: string, db: string, schema?: string) => invoke<ERDiagram>('sql:er', id, db, schema)
  },
  mongo: {
    find: (id: string, db: string, col: string, filter: string | undefined, page: number, size: number) =>
      invoke<MongoDocResult>('mongo:find', id, db, col, filter, page, size),
    count: (id: string, db: string, col: string) => invoke<number>('mongo:count', id, db, col),
    insert: (id: string, db: string, col: string, doc: string) => invoke<string>('mongo:insert', id, db, col, doc),
    updateField: (id: string, db: string, col: string, docId: string, field: string, valueJson: string) =>
      invoke<number>('mongo:updateField', id, db, col, docId, field, valueJson),
    delete: (id: string, db: string, col: string, docId: string) => invoke<number>('mongo:delete', id, db, col, docId)
  },
  redis: {
    scan: (id: string, db: number, pattern: string) => invoke<RedisKeyInfo[]>('redis:scan', id, db, pattern),
    value: (id: string, db: number, key: string) => invoke<RedisValue>('redis:value', id, db, key),
    set: (id: string, db: number, key: string, val: string, ttl?: number) => invoke<void>('redis:set', id, db, key, val, ttl),
    delete: (id: string, db: number, key: string) => invoke<number>('redis:delete', id, db, key),
    stats: (id: string, db: number) => invoke<{ keys: number; memory: string }>('redis:stats', id, db)
  },
  settings: {
    load: () => invoke<AppSettings>('settings:load'),
    save: (s: AppSettings) => invoke<boolean>('settings:save', s)
  }
}

export type OneDBApi = typeof api
contextBridge.exposeInMainWorld('onedb', api)
