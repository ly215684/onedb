import Redis, { type RedisOptions } from 'ioredis'
import type { RedisKeyInfo, RedisValue } from '../../shared/types'

export class RedisDriver {
  private baseOpts: RedisOptions
  private clients: Map<number, Redis> = new Map()
  constructor(host: string, port: number, password?: string, db = 0) {
    this.baseOpts = { host, port, password: password || undefined, db, lazyConnect: true }
    this.getClient(db)
  }
  private getClient(db: number): Redis {
    if (!this.clients.has(db)) {
      const c = new Redis({ ...this.baseOpts, db })
      c.on('error', () => {})
      this.clients.set(db, c)
    }
    return this.clients.get(db)!
  }

  async serverVersion(): Promise<string> {
    const info = await this.getClient(0).info('server')
    const m = /redis_version:([\d.]+)/.exec(info)
    return m ? `Redis ${m[1]}` : 'Redis'
  }

  async scanKeys(db: number, pattern: string, count = 200): Promise<RedisKeyInfo[]> {
    const c = this.getClient(db)
    let cursor = '0'
    const keys: string[] = []
    do {
      const [next, batch] = await c.scan(cursor, 'MATCH', pattern || '*', 'COUNT', count)
      cursor = next
      keys.push(...batch)
      if (keys.length > 1000) break
    } while (cursor !== '0')
    const infos = await Promise.all(
      keys.slice(0, 500).map(async (key) => {
        const [type, ttl, size] = await Promise.all([c.type(key), c.ttl(key), c.pttl(key)])
        let memSize = 0
        try {
          const dbg = await c.debug('object', key)
          const m = /Serialized length:(\d+)/.exec(String(dbg))
          memSize = m ? Number(m[1]) : 0
        } catch {
          /* ignore */
        }
        return { key, type, ttl: Number(ttl), size: memSize || (size > 0 ? 1 : 0) }
      })
    )
    return infos
  }

  async keyInfo(db: number, key: string): Promise<RedisValue> {
    const c = this.getClient(db)
    const type = await c.type(key)
    const ttl = await c.ttl(key)
    let value: RedisValue['value']
    switch (type) {
      case 'string':
        value = (await c.get(key)) ?? ''
        break
      case 'hash':
        value = await c.hgetall(key)
        break
      case 'list':
        value = await c.lrange(key, 0, 199)
        break
      case 'set':
        value = await c.smembers(key)
        break
      case 'zset': {
        const withScores = await c.zrange(key, 0, 199, 'WITHSCORES')
        value = withScores
        break
      }
      default:
        value = ''
    }
    return { key, type, ttl, value }
  }

  async setString(db: number, key: string, val: string, ttl?: number): Promise<void> {
    const c = this.getClient(db)
    if (ttl && ttl > 0) await c.set(key, val, 'EX', ttl)
    else await c.set(key, val)
  }

  async deleteKey(db: number, key: string): Promise<number> {
    return this.getClient(db).del(key)
  }

  async dbStats(db: number): Promise<{ keys: number; memory: string }> {
    const c = this.getClient(db)
    const [keys, mem] = await Promise.all([c.dbsize(), c.info('memory')])
    const m = /used_memory_human:([\d.]+[KMGT]?B)/.exec(String(mem))
    return { keys, memory: m ? m[1] : '-' }
  }

  async close(): Promise<void> {
    for (const c of this.clients.values()) c.disconnect()
    this.clients.clear()
  }
}
