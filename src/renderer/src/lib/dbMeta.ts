import type { DbType } from '../../../shared/types'

export interface DbMeta {
  label: string
  full: string
  defaultPort: number
  /** CSS 变量名，用于 style={{ color: `var(--db-${...})` }} */
  colorVar: string
  /** Tailwind 文字色工具类 */
  textClass: string
  sampleUser: string
  supportsSchema: boolean
  kind: 'relational' | 'document' | 'kv'
}

export const DB_META: Record<DbType, DbMeta> = {
  mysql: {
    label: 'MySQL',
    full: 'MySQL 8.x',
    defaultPort: 3306,
    colorVar: '--db-mysql',
    textClass: 'text-mysql',
    sampleUser: 'root',
    supportsSchema: false,
    kind: 'relational'
  },
  postgres: {
    label: 'PostgreSQL',
    full: 'PostgreSQL 16',
    defaultPort: 5432,
    colorVar: '--db-postgres',
    textClass: 'text-postgres',
    sampleUser: 'postgres',
    supportsSchema: true,
    kind: 'relational'
  },
  mongo: {
    label: 'MongoDB',
    full: 'MongoDB 协议',
    defaultPort: 27017,
    colorVar: '--db-mongo',
    textClass: 'text-mongo',
    sampleUser: '',
    supportsSchema: false,
    kind: 'document'
  },
  'mongo-srv': {
    label: 'MongoDB SRV',
    full: 'MongoDB 云端 (SRV)',
    defaultPort: 27017,
    colorVar: '--db-mongo-srv',
    textClass: 'text-mongosrv',
    sampleUser: '',
    supportsSchema: false,
    kind: 'document'
  },
  sqlite: {
    label: 'SQLite',
    full: 'SQLite 文件',
    defaultPort: 0,
    colorVar: '--db-sqlite',
    textClass: 'text-sqlite',
    sampleUser: '',
    supportsSchema: false,
    kind: 'relational'
  },
  redis: {
    label: 'Redis',
    full: 'Redis 7.x',
    defaultPort: 6379,
    colorVar: '--db-redis',
    textClass: 'text-redis',
    sampleUser: '',
    supportsSchema: false,
    kind: 'kv'
  }
}

export const DB_ORDER: DbType[] = ['mysql', 'postgres', 'mongo', 'mongo-srv', 'sqlite', 'redis']

export function dbColor(type: DbType): string {
  return `var(${DB_META[type].colorVar})`
}

/** 单元格值显示格式化 */
export function fmtCell(v: unknown): string {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}
