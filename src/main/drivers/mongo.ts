import { MongoClient, Db, type Document } from 'mongodb'
import type { MongoDocResult, MongoDoc } from '../../shared/types'

export class MongoDriver {
  private client: MongoClient
  private constructor(client: MongoClient) {
    this.client = client
  }
  static async create(url: string): Promise<MongoDriver> {
    const client = new MongoClient(url, { serverSelectionTimeoutMS: 8000 })
    await client.connect()
    return new MongoDriver(client)
  }

  async serverVersion(): Promise<string> {
    const r = (await this.client.db().command({ serverStatus: 1 } as Document).catch(() => null)) as { version?: string } | null
    return r?.version ?? 'MongoDB'
  }

  async listDatabases(): Promise<string[]> {
    const dbs = await this.client.db().admin().listDatabases()
    return dbs.databases.map((d) => d.name)
  }

  async listCollections(db: string): Promise<string[]> {
    return this.client.db(db).listCollections().map((c) => c.name).toArray()
  }

  async listIndexes(db: string, collection: string): Promise<string[]> {
    const idx = await this.client.db(db).collection(collection).listIndexes().toArray()
    return idx.map((i) => String(i.name))
  }

  async countDocuments(db: string, collection: string): Promise<number> {
    return this.client.db(db).collection(collection).estimatedDocumentCount()
  }

  private parseFilter(filter?: string): Document {
    if (!filter || !filter.trim()) return {}
    try {
      // 允许 EJSON 风格的 { status: 'paid' } 单引号写法
      const jsonish = filter.replace(/([{,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":').replace(/:\s*'([^']*)'/g, ': "$1"')
      return JSON.parse(jsonish) as Document
    } catch {
      return {}
    }
  }

  async findDocuments(db: string, collection: string, filter: string | undefined, page: number, pageSize: number): Promise<MongoDocResult> {
    const q = this.parseFilter(filter)
    const col = this.client.db(db).collection(collection)
    const total = await col.countDocuments(q)
    const docs = await col.find(q).skip((page - 1) * pageSize).limit(pageSize).toArray()
    const result: MongoDoc[] = docs.map((d) => {
      const preview: Record<string, string> = {}
      for (const k of Object.keys(d).slice(0, 50)) {
        if (k === '_id') continue
        preview[k] = stringifyVal(d[k])
      }
      return { _id: String(d._id), raw: JSON.stringify(d, jsonReplacer, 2), preview }
    })
    return { docs: result, total, page, pageSize }
  }

  async insertDocument(db: string, collection: string, docJson: string): Promise<string> {
    const doc = JSON.parse(docJson) as Document
    const r = await this.client.db(db).collection(collection).insertOne(doc)
    return String(r.insertedId)
  }

  // 更新单个文档的某个顶层字段：valueJson 优先按 JSON 解析（支持数字/布尔/对象/数组），
  // 解析失败则当作字符串写入。
  async updateDocumentField(db: string, collection: string, id: string, field: string, valueJson: string): Promise<number> {
    let q: Document
    try {
      q = { _id: new (require('mongodb').ObjectId)(id) }
    } catch {
      q = { _id: id }
    }
    let value: unknown
    try {
      value = JSON.parse(valueJson)
    } catch {
      value = valueJson
    }
    const r = await this.client.db(db).collection(collection).updateOne(q, { $set: { [field]: value } })
    return r.modifiedCount ?? 0
  }

  async deleteDocument(db: string, collection: string, id: string): Promise<number> {
    let q: Document
    try {
      q = { _id: new (require('mongodb').ObjectId)(id) }
    } catch {
      q = { _id: id }
    }
    const r = await this.client.db(db).collection(collection).deleteOne(q)
    return r.deletedCount ?? 0
  }

  async close(): Promise<void> {
    await this.client.close()
  }
}

function jsonReplacer(_k: string, v: unknown): unknown {
  if (v && typeof v === 'object' && '$oid' in (v as Record<string, unknown>)) return String((v as { $oid: unknown }).$oid)
  return v
}

function stringifyVal(v: unknown): string {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

export type { Db }
