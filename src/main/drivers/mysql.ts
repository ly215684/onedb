import mysql from 'mysql2/promise'
import type { Connection } from 'mysql2/promise'
import type { QueryResult, TableSchema, ColumnDef, IndexDef, ForeignKeyDef } from '../../shared/types'
import type { RelationalDriver } from './driver'

export class MysqlDriver implements RelationalDriver {
  private conn: Connection
  private constructor(conn: Connection) {
    this.conn = conn
  }
  static async create(host: string, port: number, user: string, password: string, ssl?: boolean): Promise<MysqlDriver> {
    const conn = await mysql.createConnection({
      host,
      port,
      user,
      password,
      ssl: ssl ? { rejectUnauthorized: false } : undefined,
      multipleStatements: false
    })
    return new MysqlDriver(conn)
  }

  quoteIdent(n: string): string {
    return '`' + n.replace(/`/g, '``') + '`'
  }

  async serverVersion(): Promise<string> {
    const [rows] = await this.conn.query('SELECT VERSION() AS v')
    return (rows as Array<{ v: string }>)[0].v
  }

  async listDatabases(): Promise<string[]> {
    const [rows] = await this.conn.query('SHOW DATABASES')
    return (rows as Array<Record<string, string>>).map((r) => Object.values(r)[0])
  }

  async listSchemas(): Promise<string[]> {
    return [] // MySQL 无独立 schema 层
  }

  async listTables(db: string): Promise<string[]> {
    const [rows] = await this.conn.query(
      `SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`,
      [db]
    )
    return (rows as Array<{ t: string }>).map((r) => r.t)
  }

  async query(db: string | undefined, sql: string, limit?: number): Promise<QueryResult> {
    const start = Date.now()
    if (db) await this.conn.query(`USE ${this.quoteIdent(db)}`)
    const finalSql = limit && /^\s*select/i.test(sql) && !/limit\s+\d+/i.test(sql) ? `${sql.replace(/;\s*$/, '')} LIMIT ${limit}` : sql
    const [result, fields] = await this.conn.query(finalSql)
    const durationMs = Date.now() - start
    if (Array.isArray(result)) {
      const columns = (fields as Array<{ name: string }>).map((f) => f.name)
      const rows = (result as Array<Record<string, unknown>>).map((r) => columns.map((c) => normalize(r[c])))
      return { columns, rows, rowCount: rows.length, durationMs }
    }
    const hdr = result as { affectedRows?: number }
    return { columns: [], rows: [], rowCount: 0, affectedRows: hdr.affectedRows, durationMs }
  }

  async getTableSchema(db: string, _schema: string | undefined, table: string): Promise<TableSchema> {
    const [cols] = await this.conn.query(
      `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY, EXTRA, COLUMN_COMMENT
       FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`,
      [db, table]
    )
    const columns: ColumnDef[] = (cols as Array<Record<string, unknown>>).map((c) => ({
      name: String(c.COLUMN_NAME),
      type: String(c.COLUMN_TYPE),
      nullable: c.IS_NULLABLE === 'YES',
      defaultValue: c.COLUMN_DEFAULT == null ? null : String(c.COLUMN_DEFAULT),
      comment: c.COLUMN_COMMENT ? String(c.COLUMN_COMMENT) : undefined,
      isPrimary: c.COLUMN_KEY === 'PRI',
      isUnique: c.COLUMN_KEY === 'UNI',
      isAutoIncrement: String(c.EXTRA).includes('auto_increment')
    }))
    const [idx] = await this.conn.query(
      `SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE, INDEX_TYPE FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
      [db, table]
    )
    const idxMap = new Map<string, IndexDef>()
    for (const r of idx as Array<Record<string, unknown>>) {
      const name = String(r.INDEX_NAME)
      if (!idxMap.has(name)) idxMap.set(name, { name, columns: [], unique: r.NON_UNIQUE === 0, type: String(r.INDEX_TYPE) })
      idxMap.get(name)!.columns.push(String(r.COLUMN_NAME))
    }
    const [fk] = await this.conn.query(
      `SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME, DELETE_RULE, UPDATE_RULE
       FROM information_schema.KEY_COLUMN_USAGE k
       JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON k.CONSTRAINT_NAME = r.CONSTRAINT_NAME AND k.CONSTRAINT_SCHEMA = r.CONSTRAINT_SCHEMA
       WHERE k.TABLE_SCHEMA = ? AND k.TABLE_NAME = ? AND k.REFERENCED_TABLE_NAME IS NOT NULL`,
      [db, table]
    )
    const foreignKeys: ForeignKeyDef[] = (fk as Array<Record<string, unknown>>).map((r) => ({
      name: String(r.CONSTRAINT_NAME),
      column: String(r.COLUMN_NAME),
      refTable: String(r.REFERENCED_TABLE_NAME),
      refColumn: String(r.REFERENCED_COLUMN_NAME),
      onDelete: String(r.DELETE_RULE),
      onUpdate: String(r.UPDATE_RULE)
    }))
    const [tbl] = await this.conn.query(
      `SELECT ENGINE, TABLE_COLLATION, TABLE_COMMENT, TABLE_ROWS FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [db, table]
    )
    const t = (tbl as Array<Record<string, unknown>>)[0] ?? {}
    return {
      table,
      columns,
      indexes: [...idxMap.values()],
      foreignKeys,
      engine: t.ENGINE ? String(t.ENGINE) : undefined,
      charset: t.TABLE_COLLATION ? String(t.TABLE_COLLATION).split('_')[0] : undefined,
      comment: t.TABLE_COMMENT ? String(t.TABLE_COMMENT) : undefined,
      rowCount: t.TABLE_ROWS != null ? Number(t.TABLE_ROWS) : undefined
    }
  }

  buildAlterDDL(db: string, _schema: string | undefined, original: TableSchema, modified: TableSchema): string[] {
    const stmts: string[] = []
    const t = `${this.quoteIdent(db)}.${this.quoteIdent(modified.table)}`
    const origMap = new Map(original.columns.map((c) => [c.name, c]))
    const modMap = new Map(modified.columns.map((c) => [c.name, c]))
    // 新增列
    for (const c of modified.columns) {
      if (!origMap.has(c.name)) stmts.push(`ALTER TABLE ${t} ADD COLUMN ${this.columnDDL(c)}`)
    }
    // 删除列
    for (const c of original.columns) {
      if (!modMap.has(c.name)) stmts.push(`ALTER TABLE ${t} DROP COLUMN ${this.quoteIdent(c.name)}`)
    }
    // 修改列
    for (const c of modified.columns) {
      const o = origMap.get(c.name)
      if (o && JSON.stringify(o) !== JSON.stringify(c)) {
        stmts.push(`ALTER TABLE ${t} MODIFY COLUMN ${this.columnDDL(c)}`)
      }
    }
    return stmts
  }

  private columnDDL(c: ColumnDef): string {
    let s = `${this.quoteIdent(c.name)} ${c.type}`
    s += c.nullable ? ' NULL' : ' NOT NULL'
    if (c.isAutoIncrement) s += ' AUTO_INCREMENT'
    else if (c.defaultValue != null && c.defaultValue !== '') s += ` DEFAULT ${lit(c.defaultValue)}`
    if (c.comment) s += ` COMMENT ${lit(c.comment)}`
    return s
  }

  buildDataDML(
    db: string,
    _schema: string | undefined,
    table: string,
    kind: 'update' | 'insert' | 'delete',
    pk: Record<string, unknown>,
    column?: string,
    value?: unknown,
    row?: Record<string, unknown>
  ): string {
    const t = `${this.quoteIdent(db)}.${this.quoteIdent(table)}`
    const where = Object.entries(pk).map(([k, v]) => `${this.quoteIdent(k)} = ${lit(v)}`).join(' AND ')
    if (kind === 'delete') return `DELETE FROM ${t} WHERE ${where} LIMIT 1`
    if (kind === 'update') return `UPDATE ${t} SET ${this.quoteIdent(column!)} = ${lit(value)} WHERE ${where} LIMIT 1`
    const cols = Object.keys(row!).map((c) => this.quoteIdent(c)).join(', ')
    const vals = Object.values(row!).map((v) => lit(v)).join(', ')
    return `INSERT INTO ${t} (${cols}) VALUES (${vals})`
  }

  async close(): Promise<void> {
    await this.conn.end()
  }
}

function lit(v: unknown): string {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? '1' : '0'
  return "'" + String(v).replace(/'/g, "''") + "'"
}

function normalize(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString()
  if (Buffer.isBuffer(v)) return v.toString('hex')
  return v
}
