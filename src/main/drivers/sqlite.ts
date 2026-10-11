import { readFileSync, writeFileSync, existsSync } from 'fs'
import initSqlJs, { type Database } from 'sql.js'
import type { QueryResult, TableSchema, ColumnDef, IndexDef, ForeignKeyDef } from '../../shared/types'
import type { RelationalDriver } from './driver'

let sqlJsPromise: Promise<Awaited<ReturnType<typeof initSqlJs>>> | null = null

/** SQLite（基于 sql.js WASM，无需原生编译）。文件路径来自 config.database。 */
export class SqliteDriver implements RelationalDriver {
  private db: Database
  private filePath: string
  constructor(db: Database, filePath: string) {
    this.db = db
    this.filePath = filePath
  }
  static async create(filePath: string): Promise<SqliteDriver> {
    if (!sqlJsPromise) sqlJsPromise = initSqlJs()
    const SQL = await sqlJsPromise
    let db: Database
    if (filePath && existsSync(filePath)) {
      db = new SQL.Database(readFileSync(filePath))
    } else {
      db = new SQL.Database()
    }
    return new SqliteDriver(db, filePath)
  }

  private persist(): void {
    if (!this.filePath) return
    const data = this.db.export()
    writeFileSync(this.filePath, Buffer.from(data))
  }

  quoteIdent(n: string): string {
    return '"' + n.replace(/"/g, '""') + '"'
  }

  async serverVersion(): Promise<string> {
    const r = this.exec('SELECT sqlite_version() AS v')
    return String(r.rows[0][0])
  }

  async listDatabases(): Promise<string[]> {
    return [this.filePath ? this.filePath.split(/[\\/]/).pop()! : ':memory:']
  }

  async listSchemas(): Promise<string[]> {
    return []
  }

  async listTables(): Promise<string[]> {
    const r = this.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
    return r.rows.map((x) => String(x[0]))
  }

  private exec(sql: string, params?: unknown[]): QueryResult {
    const start = Date.now()
    const stmt = this.db.prepare(sql)
    if (params) stmt.bind(params as never[])
    const columns: string[] = []
    const rows: unknown[][] = []
    while (stmt.step()) {
      const obj = stmt.getAsObject() as Record<string, unknown>
      if (columns.length === 0) columns.push(...Object.keys(obj))
      rows.push(columns.map((c) => normalize(obj[c])))
    }
    stmt.free()
    // 非查询语句（DDL/DML）
    if (columns.length === 0) {
      const changes = this.db.getRowsModified()
      return { columns: [], rows: [], rowCount: 0, affectedRows: changes, durationMs: Date.now() - start }
    }
    return { columns, rows, rowCount: rows.length, durationMs: Date.now() - start }
  }

  async query(_db: string | undefined, sql: string, limit?: number): Promise<QueryResult> {
    const finalSql = limit && /^\s*select/i.test(sql) && !/limit\s+\d+/i.test(sql) ? `${sql.replace(/;\s*$/, '')} LIMIT ${limit}` : sql
    const res = this.exec(finalSql)
    this.persist()
    return res
  }

  async getTableSchema(_db: string, _schema: string | undefined, table: string): Promise<TableSchema> {
    const cols = this.db.exec(`PRAGMA table_info(${this.quoteIdent(table)})`)
    const columns: ColumnDef[] = cols[0] ? (cols[0].values as Array<unknown[]>).map((v) => ({
      name: String(v[1]),
      type: String(v[2]),
      nullable: v[3] === 0 ? false : true,
      defaultValue: v[4] == null ? null : String(v[4]),
      isPrimary: Number(v[5]) > 0
    })) : []
    const idxRes = this.db.exec(`PRAGMA index_list(${this.quoteIdent(table)})`)
    const indexes: IndexDef[] = idxRes[0] ? (idxRes[0].values as Array<unknown[]>).map((v) => ({
      name: String(v[1]),
      columns: [],
      unique: v[2] === 1,
      type: 'BTREE'
    })) : []
    const fkRes = this.db.exec(`PRAGMA foreign_key_list(${this.quoteIdent(table)})`)
    const foreignKeys: ForeignKeyDef[] = fkRes[0] ? (fkRes[0].values as Array<unknown[]>).map((v) => ({
      name: `fk_${v[0]}`,
      column: String(v[3]),
      refTable: String(v[2]),
      refColumn: String(v[4]),
      onDelete: String(v[6]),
      onUpdate: String(v[5])
    })) : []
    return { table, columns, indexes, foreignKeys }
  }

  buildAlterDDL(_db: string, _schema: string | undefined, original: TableSchema, modified: TableSchema): string[] {
    const stmts: string[] = []
    const t = this.quoteIdent(modified.table)
    const origMap = new Map(original.columns.map((c) => [c.name, c]))
    const modMap = new Map(modified.columns.map((c) => [c.name, c]))
    for (const c of modified.columns) if (!origMap.has(c.name)) stmts.push(`ALTER TABLE ${t} ADD COLUMN ${c.name} ${c.type}${c.nullable ? '' : ' NOT NULL'}${c.defaultValue ? ' DEFAULT ' + c.defaultValue : ''}`)
    for (const c of original.columns) if (!modMap.has(c.name)) stmts.push(`-- SQLite 不支持 DROP COLUMN，需重建表以删除 ${c.name}`)
    return stmts
  }

  buildDataDML(_db: string, _schema: string | undefined, table: string, kind: 'update' | 'insert' | 'delete', pk: Record<string, unknown>, column?: string, value?: unknown, row?: Record<string, unknown>): string {
    const t = this.quoteIdent(table)
    const where = Object.entries(pk).map(([k, v]) => `${this.quoteIdent(k)} = ${lit(v)}`).join(' AND ')
    if (kind === 'delete') return `DELETE FROM ${t} WHERE ${where} LIMIT 1`
    if (kind === 'update') return `UPDATE ${t} SET ${this.quoteIdent(column!)} = ${lit(value)} WHERE ${where}`
    const cols = Object.keys(row!).map((c) => this.quoteIdent(c)).join(', ')
    const vals = Object.values(row!).map((v) => lit(v)).join(', ')
    return `INSERT INTO ${t} (${cols}) VALUES (${vals})`
  }

  async close(): Promise<void> {
    this.persist()
    this.db.close()
  }
}

function lit(v: unknown): string {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number') return String(v)
  return "'" + String(v).replace(/'/g, "''") + "'"
}

function normalize(v: unknown): unknown {
  if (v instanceof Uint8Array) return Buffer.from(v).toString('hex')
  return v
}
