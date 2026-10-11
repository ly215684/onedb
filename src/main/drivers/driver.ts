import type { ColumnDef, QueryResult, TableSchema } from '../../shared/types'

/** 关系型数据库统一驱动接口（MySQL / PostgreSQL / SQLite） */
export interface RelationalDriver {
  serverVersion(): Promise<string>
  listDatabases(): Promise<string[]>
  listSchemas(db: string): Promise<string[]>
  listTables(db: string, schema?: string): Promise<string[]>
  query(db: string | undefined, sql: string, limit?: number): Promise<QueryResult>
  getTableSchema(db: string, schema: string | undefined, table: string): Promise<TableSchema>
  /** 生成把 original 改成 modified 所需的 DDL 语句列表 */
  buildAlterDDL(
    db: string,
    schema: string | undefined,
    original: TableSchema,
    modified: TableSchema
  ): string[]
  /** 根据主键定位行，生成 UPDATE/INSERT/DELETE 语句 */
  buildDataDML(
    db: string,
    schema: string | undefined,
    table: string,
    kind: 'update' | 'insert' | 'delete',
    pk: Record<string, unknown>,
    column?: string,
    value?: unknown,
    row?: Record<string, unknown>
  ): string
  quoteIdent(name: string): string
  close(): Promise<void>
}

export function columnsToDef(cols: Array<Partial<ColumnDef> & { name: string; type: string }>): ColumnDef[] {
  return cols.map((c) => ({
    name: c.name,
    type: c.type,
    nullable: c.nullable ?? true,
    defaultValue: c.defaultValue ?? null,
    comment: c.comment,
    isPrimary: c.isPrimary ?? false,
    isUnique: c.isUnique ?? false,
    isAutoIncrement: c.isAutoIncrement ?? false
  }))
}
