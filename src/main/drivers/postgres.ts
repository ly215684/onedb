import { Pool } from 'pg'
import type { QueryResult, TableSchema, ColumnDef, IndexDef, ForeignKeyDef } from '../../shared/types'
import type { RelationalDriver } from './driver'

export class PostgresDriver implements RelationalDriver {
  private pool: Pool
  private constructor(pool: Pool) {
    this.pool = pool
  }
  static async create(host: string, port: number, user: string, password: string, ssl?: boolean): Promise<PostgresDriver> {
    const pool = new Pool({
      host,
      port,
      user,
      password,
      ssl: ssl ? { rejectUnauthorized: false } : undefined,
      max: 5
    })
    await pool.query('SELECT 1')
    return new PostgresDriver(pool)
  }

  quoteIdent(n: string): string {
    return '"' + n.replace(/"/g, '""') + '"'
  }

  async serverVersion(): Promise<string> {
    const r = await this.pool.query('SELECT version()')
    return String(r.rows[0].version)
  }

  async listDatabases(): Promise<string[]> {
    const r = await this.pool.query(`SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname`)
    return r.rows.map((x: { datname: string }) => x.datname)
  }

  async listSchemas(db: string): Promise<string[]> {
    const r = await this.pool.query(
      `SELECT schema_name FROM information_schema.schemata WHERE catalog = $1 AND schema_name NOT IN ('pg_catalog','information_schema') ORDER BY schema_name`,
      [db]
    )
    return r.rows.map((x: { schema_name: string }) => x.schema_name)
  }

  async listTables(db: string, schema = 'public'): Promise<string[]> {
    const r = await this.pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_catalog = $1 AND table_schema = $2 AND table_type = 'BASE TABLE' ORDER BY table_name`,
      [db, schema]
    )
    return r.rows.map((x: { table_name: string }) => x.table_name)
  }

  async query(db: string | undefined, sql: string, limit?: number): Promise<QueryResult> {
    const start = Date.now()
    const client = await this.pool.connect()
    try {
      if (db) await client.query(`SET search_path TO ${this.quoteIdent(db)}, public`)
      const finalSql = limit && /^\s*select/i.test(sql) && !/limit\s+\d+/i.test(sql) ? `${sql.replace(/;\s*$/, '')} LIMIT ${limit}` : sql
      const r = await client.query(finalSql)
      const durationMs = Date.now() - start
      if (r.fields) {
        const columns = r.fields.map((f) => f.name)
        const rows = r.rows.map((row: Record<string, unknown>) => columns.map((c) => normalize(row[c])))
        return { columns, rows, rowCount: r.rowCount ?? rows.length, durationMs }
      }
      return { columns: [], rows: [], rowCount: 0, affectedRows: r.rowCount ?? 0, durationMs }
    } finally {
      client.release()
    }
  }

  async getTableSchema(db: string, schema: string | undefined, table: string): Promise<TableSchema> {
    const sc = schema ?? 'public'
    const [cols, idx, fk, tbl] = await Promise.all([
      this.pool.query(
        `SELECT column_name, data_type, udt_name, is_nullable, column_default, ordinal_position
         FROM information_schema.columns WHERE table_catalog=$1 AND table_schema=$2 AND table_name=$3 ORDER BY ordinal_position`,
        [db, sc, table]
      ),
      this.pool.query(
        `SELECT i.relname AS idxname, ix.indisunique, a.attname
         FROM pg_class t JOIN pg_index ix ON t.oid=ix.indrelid JOIN pg_class i ON i.oid=ix.indexrelid
         JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum = ANY(ix.indkey)
         JOIN pg_namespace n ON n.oid=t.relnamespace
         WHERE t.relname=$1 AND n.nspname=$2`,
        [table, sc]
      ),
      this.pool.query(
        `SELECT kcu.column_name, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column, rc.constraint_name, rc.delete_rule, rc.update_rule
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name
         JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name
         JOIN information_schema.referential_constraints rc ON rc.constraint_name=tc.constraint_name
         WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema=$1 AND tc.table_name=$2`,
        [sc, table]
      ),
      this.pool.query(`SELECT obj_description($1::regclass) AS comment`, [`${this.quoteIdent(sc)}.${this.quoteIdent(table)}`]).catch(() => ({ rows: [{}] }))
    ])
    const pkCols = new Set(idx.rows.filter((r: { indisunique: boolean; idxname: string; attname: string }) => r.idxname.endsWith('_pkey')).map((r: { attname: string }) => r.attname))
    const columns: ColumnDef[] = cols.rows.map((c: Record<string, unknown>) => ({
      name: String(c.column_name),
      type: String(c.udt_name === 'int4' ? 'integer' : c.data_type),
      nullable: c.is_nullable === 'YES',
      defaultValue: c.column_default == null ? null : String(c.column_default),
      isPrimary: pkCols.has(String(c.column_name))
    }))
    const idxMap = new Map<string, IndexDef>()
    for (const r of idx.rows as Array<Record<string, unknown>>) {
      const name = String(r.idxname)
      if (!idxMap.has(name)) idxMap.set(name, { name, columns: [], unique: !!r.indisunique, type: 'BTREE' })
      idxMap.get(name)!.columns.push(String(r.attname))
    }
    const foreignKeys: ForeignKeyDef[] = fk.rows.map((r: Record<string, unknown>) => ({
      name: String(r.constraint_name),
      column: String(r.column_name),
      refTable: String(r.foreign_table),
      refColumn: String(r.foreign_column),
      onDelete: String(r.delete_rule),
      onUpdate: String(r.update_rule)
    }))
    return { table, schema: sc, columns, indexes: [...idxMap.values()], foreignKeys, comment: (tbl.rows[0] as { comment?: string })?.comment ?? undefined }
  }

  buildAlterDDL(_db: string, schema: string | undefined, original: TableSchema, modified: TableSchema): string[] {
    const stmts: string[] = []
    const sc = schema ?? 'public'
    const t = `${this.quoteIdent(sc)}.${this.quoteIdent(modified.table)}`
    const origMap = new Map(original.columns.map((c) => [c.name, c]))
    const modMap = new Map(modified.columns.map((c) => [c.name, c]))
    for (const c of modified.columns) if (!origMap.has(c.name)) stmts.push(`ALTER TABLE ${t} ADD COLUMN ${this.columnDDL(c)}`)
    for (const c of original.columns) if (!modMap.has(c.name)) stmts.push(`ALTER TABLE ${t} DROP COLUMN ${this.quoteIdent(c.name)}`)
    for (const c of modified.columns) {
      const o = origMap.get(c.name)
      if (o && o.type !== c.type) stmts.push(`ALTER TABLE ${t} ALTER COLUMN ${this.quoteIdent(c.name)} TYPE ${c.type}`)
      if (o && o.nullable !== c.nullable)
        stmts.push(`ALTER TABLE ${t} ALTER COLUMN ${this.quoteIdent(c.name)} ${c.nullable ? 'DROP NOT NULL' : 'SET NOT NULL'}`)
      if (o && o.defaultValue !== c.defaultValue)
        stmts.push(c.defaultValue == null ? `ALTER TABLE ${t} ALTER COLUMN ${this.quoteIdent(c.name)} DROP DEFAULT` : `ALTER TABLE ${t} ALTER COLUMN ${this.quoteIdent(c.name)} SET DEFAULT ${c.defaultValue}`)
    }
    return stmts
  }

  private columnDDL(c: ColumnDef): string {
    let s = `${this.quoteIdent(c.name)} ${c.type}`
    if (!c.nullable) s += ' NOT NULL'
    if (c.defaultValue != null && c.defaultValue !== '') s += ` DEFAULT ${c.defaultValue}`
    return s
  }

  buildDataDML(_db: string, schema: string | undefined, table: string, kind: 'update' | 'insert' | 'delete', pk: Record<string, unknown>, column?: string, value?: unknown, row?: Record<string, unknown>): string {
    const sc = schema ?? 'public'
    const t = `${this.quoteIdent(sc)}.${this.quoteIdent(table)}`
    const where = Object.entries(pk).map(([k, v]) => `${this.quoteIdent(k)} = ${lit(v)}`).join(' AND ')
    if (kind === 'delete') return `DELETE FROM ${t} WHERE ${where}`
    if (kind === 'update') return `UPDATE ${t} SET ${this.quoteIdent(column!)} = ${lit(value)} WHERE ${where}`
    const cols = Object.keys(row!).map((c) => this.quoteIdent(c)).join(', ')
    const vals = Object.values(row!).map((v) => lit(v)).join(', ')
    return `INSERT INTO ${t} (${cols}) VALUES (${vals})`
  }

  async close(): Promise<void> {
    await this.pool.end()
  }
}

function lit(v: unknown): string {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  return "'" + String(v).replace(/'/g, "''") + "'"
}

function normalize(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString()
  if (v !== null && typeof v === 'object') return JSON.stringify(v)
  return v
}
