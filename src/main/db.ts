import type {
  ConnectionConfig,
  TestResult,
  QueryRequest,
  QueryResult,
  TableSchema,
  SchemaChange,
  PendingChange,
  MongoDocResult,
  RedisKeyInfo,
  RedisValue,
  ERDiagram
} from '../shared/types'
import { RelationalDriver } from './drivers/driver'
import { MysqlDriver } from './drivers/mysql'
import { PostgresDriver } from './drivers/postgres'
import { SqliteDriver } from './drivers/sqlite'
import { MongoDriver } from './drivers/mongo'
import { RedisDriver } from './drivers/redis'
import { openTunnel, type TunnelHandle } from './ssh'

interface ActiveConnection {
  config: ConnectionConfig
  relational?: RelationalDriver
  mongo?: MongoDriver
  redis?: RedisDriver
  tunnel?: TunnelHandle
}

class DBManager {
  private conns = new Map<string, ActiveConnection>()

  private async resolveEndpoint(config: ConnectionConfig): Promise<{ host: string; port: number; tunnel?: TunnelHandle }> {
    const host = config.host || '127.0.0.1'
    const port = config.port || defaultPort(config.type)
    if (config.ssh?.enabled) {
      const t = await openTunnel(config.ssh, host, port)
      return { host: '127.0.0.1', port: t.localPort, tunnel: t }
    }
    return { host, port }
  }

  async test(config: ConnectionConfig): Promise<TestResult> {
    const start = Date.now()
    let tunnel: TunnelHandle | undefined
    try {
      const ep = await this.resolveEndpoint(config)
      tunnel = ep.tunnel
      const driver = await this.buildRelational(config, ep.host, ep.port)
      const version = await driver.serverVersion()
      await driver.close()
      return { ok: true, message: '连接成功', latencyMs: Date.now() - start, serverVersion: version }
    } catch (e) {
      return { ok: false, message: (e as Error).message }
    } finally {
      tunnel?.close()
    }
  }

  private async buildRelational(config: ConnectionConfig, host: string, port: number): Promise<RelationalDriver> {
    switch (config.type) {
      case 'mysql':
        return MysqlDriver.create(host, port, config.user || 'root', config.password || '', config.ssl)
      case 'postgres':
        return PostgresDriver.create(host, port, config.user || 'postgres', config.password || '', config.ssl)
      case 'sqlite':
        return SqliteDriver.create(config.database || host)
      default:
        throw new Error('非关系型数据库')
    }
  }

  async connect(config: ConnectionConfig): Promise<{ version: string }> {
    this.disconnect(config.id)
    if (config.type === 'mongo' || config.type === 'mongo-srv') {
      const url =
        config.type === 'mongo-srv'
          ? config.srvUrl || `mongodb+srv://${config.user}:${config.password}@${config.host}`
          : `mongodb://${config.user ? encodeURIComponent(config.user) + ':' + encodeURIComponent(config.password || '') + '@' : ''}${config.host || '127.0.0.1'}:${config.port || 27017}`
      const mongo = await MongoDriver.create(url)
      this.conns.set(config.id, { config, mongo })
      return { version: await mongo.serverVersion() }
    }
    if (config.type === 'redis') {
      const ep = await this.resolveEndpoint(config)
      const redis = new RedisDriver(ep.host, ep.port, config.password)
      this.conns.set(config.id, { config, redis, tunnel: ep.tunnel })
      return { version: await redis.serverVersion() }
    }
    const ep = await this.resolveEndpoint(config)
    const relational = await this.buildRelational(config, ep.host, ep.port)
    this.conns.set(config.id, { config, relational, tunnel: ep.tunnel })
    return { version: await relational.serverVersion() }
  }

  private get(id: string): ActiveConnection {
    const c = this.conns.get(id)
    if (!c) throw new Error('连接未建立，请先连接')
    return c
  }

  disconnect(id: string): void {
    const c = this.conns.get(id)
    if (!c) return
    c.relational?.close().catch(() => {})
    c.mongo?.close().catch(() => {})
    c.redis?.close().catch(() => {})
    c.tunnel?.close()
    this.conns.delete(id)
  }

  isConnected(id: string): boolean {
    return this.conns.has(id)
  }

  // ---- 树 ----
  async listDatabases(id: string): Promise<string[]> {
    const c = this.get(id)
    if (c.relational) return c.relational.listDatabases()
    if (c.mongo) return c.mongo.listDatabases()
    return []
  }
  async listSchemas(id: string, db: string): Promise<string[]> {
    const c = this.get(id)
    return c.relational?.listSchemas(db) ?? []
  }
  async listTables(id: string, db: string, schema?: string): Promise<string[]> {
    const c = this.get(id)
    return c.relational?.listTables(db, schema) ?? []
  }
  async listCollections(id: string, db: string): Promise<string[]> {
    const c = this.get(id)
    return c.mongo?.listCollections(db) ?? []
  }
  async listIndexes(id: string, db: string, collection: string): Promise<string[]> {
    const c = this.get(id)
    return c.mongo?.listIndexes(db, collection) ?? []
  }

  // ---- SQL ----
  async query(id: string, req: QueryRequest): Promise<QueryResult> {
    const c = this.get(id)
    if (!c.relational) throw new Error('该连接不支持 SQL 查询')
    return c.relational.query(req.database, req.sql, req.limit)
  }

  async getTableSchema(id: string, db: string, schema: string | undefined, table: string): Promise<TableSchema> {
    const c = this.get(id)
    if (!c.relational) throw new Error('不支持')
    return c.relational.getTableSchema(db, schema, table)
  }

  async applySchemaChange(id: string, change: SchemaChange): Promise<string[]> {
    const c = this.get(id)
    if (!c.relational) throw new Error('不支持')
    const stmts = c.relational.buildAlterDDL(change.database, change.schema, change.original, change.modified)
    for (const s of stmts) {
      if (s.trim().startsWith('--')) continue
      await c.relational.query(change.database, s)
    }
    return stmts
  }

  async applyDataChanges(id: string, db: string, schema: string | undefined, table: string, changes: PendingChange[]): Promise<number> {
    const c = this.get(id)
    if (!c.relational) throw new Error('不支持')
    let n = 0
    for (const ch of changes) {
      const sql = c.relational.buildDataDML(db, schema, table, ch.kind, ch.pk, ch.column, ch.value, ch.row)
      const r = await c.relational.query(db, sql)
      n += r.affectedRows ?? 0
    }
    return n
  }

  async getERDiagram(id: string, db: string, schema?: string): Promise<ERDiagram> {
    const c = this.get(id)
    if (!c.relational) throw new Error('不支持')
    const tables = await c.relational.listTables(db, schema)
    const nodes: ERDiagram['nodes'] = []
    for (const t of tables.slice(0, 20)) {
      const s = await c.relational.getTableSchema(db, schema, t)
      nodes.push({ id: t, table: t, schema, columns: s.columns })
    }
    const edges: ERDiagram['edges'] = []
    for (const t of tables.slice(0, 20)) {
      const s = await c.relational.getTableSchema(db, schema, t)
      for (const fk of s.foreignKeys) {
        if (tables.includes(fk.refTable)) {
          edges.push({ id: `${t}.${fk.column}-${fk.refTable}`, from: t, fromColumn: fk.column, to: fk.refTable, toColumn: fk.refColumn })
        }
      }
    }
    return { nodes, edges }
  }

  // ---- Mongo ----
  async mongoFind(id: string, db: string, collection: string, filter: string | undefined, page: number, pageSize: number): Promise<MongoDocResult> {
    const c = this.get(id)
    if (!c.mongo) throw new Error('不支持')
    return c.mongo.findDocuments(db, collection, filter, page, pageSize)
  }
  async mongoCount(id: string, db: string, collection: string): Promise<number> {
    const c = this.get(id)
    return c.mongo?.countDocuments(db, collection) ?? 0
  }
  async mongoInsert(id: string, db: string, collection: string, docJson: string): Promise<string> {
    const c = this.get(id)
    if (!c.mongo) throw new Error('不支持')
    return c.mongo.insertDocument(db, collection, docJson)
  }
  async mongoUpdateField(id: string, db: string, collection: string, docId: string, field: string, valueJson: string): Promise<number> {
    const c = this.get(id)
    if (!c.mongo) throw new Error('不支持')
    return c.mongo.updateDocumentField(db, collection, docId, field, valueJson)
  }
  async mongoDelete(id: string, db: string, collection: string, docId: string): Promise<number> {
    const c = this.get(id)
    if (!c.mongo) throw new Error('不支持')
    return c.mongo.deleteDocument(db, collection, docId)
  }

  // ---- Redis ----
  async redisScan(id: string, db: number, pattern: string): Promise<RedisKeyInfo[]> {
    const c = this.get(id)
    if (!c.redis) throw new Error('不支持')
    return c.redis.scanKeys(db, pattern)
  }
  async redisValue(id: string, db: number, key: string): Promise<RedisValue> {
    const c = this.get(id)
    if (!c.redis) throw new Error('不支持')
    return c.redis.keyInfo(db, key)
  }
  async redisSet(id: string, db: number, key: string, val: string, ttl?: number): Promise<void> {
    const c = this.get(id)
    if (!c.redis) throw new Error('不支持')
    return c.redis.setString(db, key, val, ttl)
  }
  async redisDelete(id: string, db: number, key: string): Promise<number> {
    const c = this.get(id)
    if (!c.redis) throw new Error('不支持')
    return c.redis.deleteKey(db, key)
  }
  async redisStats(id: string, db: number): Promise<{ keys: number; memory: string }> {
    const c = this.get(id)
    if (!c.redis) throw new Error('不支持')
    return c.redis.dbStats(db)
  }

  closeAll(): void {
    for (const id of [...this.conns.keys()]) this.disconnect(id)
  }
}

function defaultPort(type: string): number {
  switch (type) {
    case 'mysql':
      return 3306
    case 'postgres':
      return 5432
    case 'mongo':
    case 'mongo-srv':
      return 27017
    case 'redis':
      return 6379
    default:
      return 0
  }
}

export const dbManager = new DBManager()
