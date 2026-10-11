// 跨进程共享的类型契约：主进程 / preload / 渲染层统一引用
export type DbType = 'mysql' | 'postgres' | 'mongo' | 'mongo-srv' | 'sqlite' | 'redis'

export interface SSHTunnel {
  enabled: boolean
  host: string
  port: number
  username: string
  authType: 'password' | 'privateKey'
  password?: string
  privateKey?: string
  passphrase?: string
}

export interface ConnectionConfig {
  id: string
  name: string
  type: DbType
  color?: string
  // 关系型 / Redis
  host?: string
  port?: number
  user?: string
  password?: string
  database?: string // sqlite 为文件路径
  // mongo-srv
  srvUrl?: string
  // 通用
  ssl?: boolean
  ssh?: SSHTunnel
  createdAt: number
}

export interface TestResult {
  ok: boolean
  message: string
  latencyMs?: number
  serverVersion?: string
}

// 连接树
export interface TreeNode {
  id: string
  label: string
  kind: 'connection' | 'database' | 'schema' | 'table' | 'collection' | 'keyspace' | 'key' | 'field' | 'index'
  dbType: DbType
  children?: TreeNode[]
  meta?: Record<string, unknown>
  iconColor?: string
}

// SQL 查询
export interface QueryRequest {
  connectionId: string
  database?: string
  schema?: string
  sql: string
  limit?: number
}

export interface QueryResult {
  columns: string[]
  rows: unknown[][]
  rowCount: number
  affectedRows?: number
  durationMs: number
  error?: string
}

// 表结构
export interface ColumnDef {
  name: string
  type: string
  nullable: boolean
  defaultValue: string | null
  comment?: string
  isPrimary?: boolean
  isUnique?: boolean
  isAutoIncrement?: boolean
}

export interface IndexDef {
  name: string
  columns: string[]
  unique: boolean
  type: string
}

export interface ForeignKeyDef {
  name: string
  column: string
  refTable: string
  refColumn: string
  onDelete?: string
  onUpdate?: string
}

export interface TableSchema {
  table: string
  schema?: string
  columns: ColumnDef[]
  indexes: IndexDef[]
  foreignKeys: ForeignKeyDef[]
  comment?: string
  engine?: string
  charset?: string
  rowCount?: number
}

export interface SchemaChange {
  connectionId: string
  database: string
  schema?: string
  table: string
  original: TableSchema
  modified: TableSchema
}

// 数据网格编辑
export interface CellPos {
  row: number
  column: string
}

export interface PendingChange {
  id: string
  kind: 'update' | 'insert' | 'delete'
  table: string
  pk: Record<string, unknown>
  column?: string
  value?: unknown
  row?: Record<string, unknown>
}

// Mongo
export interface MongoDocRequest {
  connectionId: string
  database: string
  collection: string
  filter?: string
  page?: number
  pageSize?: number
}
export interface MongoDoc {
  _id: string
  raw: string
  preview: Record<string, string>
}
export interface MongoDocResult {
  docs: MongoDoc[]
  total: number
  page: number
  pageSize: number
}

// Redis
export interface RedisKeyInfo {
  key: string
  type: string
  ttl: number
  size: number
}
export interface RedisValue {
  key: string
  type: string
  ttl: number
  value: Record<string, string> | string | string[]
}

// ER 图
export interface ERNode {
  id: string
  table: string
  schema?: string
  columns: ColumnDef[]
}
export interface ERDiagram {
  nodes: ERNode[]
  edges: { id: string; from: string; fromColumn: string; to: string; toColumn: string }[]
}

// 设置
export type ThemeMode = 'light' | 'dark' | 'system'
export type Density = 'compact' | 'comfy' | 'large'
export interface AppSettings {
  theme: ThemeMode
  accent: string
  density: Density
  language: 'zh' | 'en'
  editorLigatures: boolean
  showDbColorLabels: boolean
  defaultLimit: number
}
