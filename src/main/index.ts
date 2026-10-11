import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { join } from 'path'
import { dbManager } from './db'
import { store } from './store'
import type { ConnectionConfig, QueryRequest, SchemaChange, PendingChange, AppSettings } from '../shared/types'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#F4F6F9',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // 窗口控制
  ipcMain.on('win:minimize', () => win.minimize())
  ipcMain.on('win:maximize', () => (win.isMaximized() ? win.unmaximize() : win.maximize()))
  ipcMain.on('win:close', () => win.close())
}

function handle<T extends unknown[]>(channel: string, fn: (...args: T) => Promise<unknown> | unknown): void {
  ipcMain.handle(channel, async (_e, ...args) => {
    try {
      return { ok: true, data: await fn(...(args as T)) }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })
}

function registerIpc(): void {
  // 连接持久化
  handle('conn:list', () => store.loadConnections())
  handle('conn:save', (list: ConnectionConfig[]) => {
    store.saveConnections(list)
    return true
  })
  handle('conn:test', (config: ConnectionConfig) => dbManager.test(config))
  handle('conn:connect', (config: ConnectionConfig) => dbManager.connect(config))
  handle('conn:disconnect', (id: string) => {
    dbManager.disconnect(id)
    return true
  })
  handle('conn:isConnected', (id: string) => dbManager.isConnected(id))

  // 树
  handle('tree:databases', (id: string) => dbManager.listDatabases(id))
  handle('tree:schemas', (id: string, db: string) => dbManager.listSchemas(id, db))
  handle('tree:tables', (id: string, db: string, schema?: string) => dbManager.listTables(id, db, schema))
  handle('tree:collections', (id: string, db: string) => dbManager.listCollections(id, db))
  handle('tree:indexes', (id: string, db: string, col: string) => dbManager.listIndexes(id, db, col))

  // SQL
  handle('sql:query', (id: string, req: QueryRequest) => dbManager.query(id, req))
  handle('sql:schema', (id: string, db: string, schema: string | undefined, table: string) => dbManager.getTableSchema(id, db, schema, table))
  handle('sql:applySchema', (id: string, change: SchemaChange) => dbManager.applySchemaChange(id, change))
  handle('sql:applyData', (id: string, db: string, schema: string | undefined, table: string, changes: PendingChange[]) =>
    dbManager.applyDataChanges(id, db, schema, table, changes)
  )
  handle('sql:er', (id: string, db: string, schema?: string) => dbManager.getERDiagram(id, db, schema))

  // Mongo
  handle('mongo:find', (id: string, db: string, col: string, filter: string | undefined, page: number, size: number) =>
    dbManager.mongoFind(id, db, col, filter, page, size)
  )
  handle('mongo:count', (id: string, db: string, col: string) => dbManager.mongoCount(id, db, col))
  handle('mongo:insert', (id: string, db: string, col: string, doc: string) => dbManager.mongoInsert(id, db, col, doc))
  handle('mongo:updateField', (id: string, db: string, col: string, docId: string, field: string, valueJson: string) =>
    dbManager.mongoUpdateField(id, db, col, docId, field, valueJson)
  )
  handle('mongo:delete', (id: string, db: string, col: string, docId: string) => dbManager.mongoDelete(id, db, col, docId))

  // Redis
  handle('redis:scan', (id: string, db: number, pattern: string) => dbManager.redisScan(id, db, pattern))
  handle('redis:value', (id: string, db: number, key: string) => dbManager.redisValue(id, db, key))
  handle('redis:set', (id: string, db: number, key: string, val: string, ttl?: number) => dbManager.redisSet(id, db, key, val, ttl))
  handle('redis:delete', (id: string, db: number, key: string) => dbManager.redisDelete(id, db, key))
  handle('redis:stats', (id: string, db: number) => dbManager.redisStats(id, db))

  // 设置
  handle('settings:load', () => store.loadSettings())
  handle('settings:save', (s: AppSettings) => {
    store.saveSettings(s)
    return true
  })
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  dbManager.closeAll()
  if (process.platform !== 'darwin') app.quit()
})
