import { create } from 'zustand'
import type { AppSettings, ConnectionConfig, DbType } from '../../../shared/types'
import { uid } from '../lib/dbMeta'

export type TabKind = 'home' | 'sql' | 'data' | 'mongo' | 'redis' | 'structure' | 'er' | 'settings'

export interface Tab {
  id: string
  kind: TabKind
  title: string
  connectionId?: string
  dbType?: DbType
  database?: string
  schema?: string
  table?: string
  collection?: string
  redisDb?: number
  key?: string
  closable: boolean
}

export interface Toast {
  id: string
  kind: 'success' | 'error' | 'info'
  msg: string
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  accent: '#3A66E2',
  density: 'comfy',
  language: 'zh',
  editorLigatures: true,
  showDbColorLabels: true,
  defaultLimit: 200
}

interface AppState {
  ready: boolean
  settings: AppSettings
  resolvedTheme: 'light' | 'dark'
  connections: ConnectionConfig[]
  connected: Record<string, string | undefined> // id -> serverVersion
  tabs: Tab[]
  activeTabId: string
  quickConnect: { open: boolean; editing: ConnectionConfig | null; presetType: DbType | null }
  toasts: Toast[]

  init: () => Promise<void>
  applyTheme: (s: AppSettings) => void
  saveSettings: (patch: Partial<AppSettings>) => Promise<void>

  upsertConnection: (c: ConnectionConfig) => Promise<void>
  removeConnection: (id: string) => Promise<void>
  connect: (id: string) => Promise<void>
  disconnect: (id: string) => Promise<void>

  openQuickConnect: (presetType?: DbType, editing?: ConnectionConfig | null) => void
  closeQuickConnect: () => void

  openTab: (t: Omit<Tab, 'id' | 'closable'> & { id?: string; closable?: boolean }) => string
  closeTab: (id: string) => void
  setActiveTab: (id: string) => void
  updateTab: (id: string, patch: Partial<Tab>) => void

  toast: (kind: Toast['kind'], msg: string) => void
  dismissToast: (id: string) => void
}

function systemDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  settings: DEFAULT_SETTINGS,
  resolvedTheme: 'light',
  connections: [],
  connected: {},
  tabs: [{ id: 'home', kind: 'home', title: '连接总览', closable: false }],
  activeTabId: 'home',
  quickConnect: { open: false, editing: null, presetType: null },
  toasts: [],

  async init() {
    const settings = await window.onedb.settings.load().catch(() => DEFAULT_SETTINGS)
    const connections = await window.onedb.conn.list().catch(() => [])
    // 恢复仍在线的连接
    const connected: Record<string, string | undefined> = {}
    await Promise.all(
      connections.map(async (c) => {
        const ok = await window.onedb.conn.isConnected(c.id).catch(() => false)
        if (ok) connected[c.id] = undefined
      })
    )
    get().applyTheme(settings)
    set({ settings, connections, connected, ready: true })
  },

  applyTheme(s) {
    const resolved = s.theme === 'system' ? (systemDark() ? 'dark' : 'light') : s.theme
    const root = document.documentElement
    root.setAttribute('data-theme', resolved)
    root.setAttribute('data-density', s.density)
    root.style.setProperty('--accent', s.accent)
    set({ resolvedTheme: resolved })
  },

  async saveSettings(patch) {
    const next = { ...get().settings, ...patch }
    get().applyTheme(next)
    set({ settings: next })
    await window.onedb.settings.save(next).catch(() => {})
  },

  async upsertConnection(c) {
    const list = [...get().connections]
    const i = list.findIndex((x) => x.id === c.id)
    if (i >= 0) list[i] = c
    else list.push(c)
    set({ connections: list })
    await window.onedb.conn.save(list).catch(() => {})
  },

  async removeConnection(id) {
    const list = get().connections.filter((c) => c.id !== id)
    await window.onedb.conn.disconnect(id).catch(() => {})
    const connected = { ...get().connected }
    delete connected[id]
    const tabs = get().tabs.filter((t) => t.connectionId !== id)
    set({ connections: list, connected, tabs: tabs.length ? tabs : get().tabs })
    await window.onedb.conn.save(list).catch(() => {})
  },

  async connect(id) {
    const c = get().connections.find((x) => x.id === id)
    if (!c) return
    try {
      const { version } = await window.onedb.conn.connect(c)
      set({ connected: { ...get().connected, [id]: version } })
      get().toast('success', `${c.name} · ${version}`)
    } catch (e) {
      get().toast('error', (e as Error).message)
    }
  },

  async disconnect(id) {
    await window.onedb.conn.disconnect(id).catch(() => {})
    const connected = { ...get().connected }
    delete connected[id]
    set({ connected })
  },

  openQuickConnect(presetType, editing = null) {
    set({ quickConnect: { open: true, editing, presetType: presetType ?? null } })
  },
  closeQuickConnect() {
    set({ quickConnect: { open: false, editing: null, presetType: null } })
  },

  openTab(t) {
    // home / settings 单例
    const singleton = t.kind === 'home' || t.kind === 'settings'
    if (singleton) {
      const existing = get().tabs.find((x) => x.kind === t.kind)
      if (existing) {
        set({ activeTabId: existing.id })
        return existing.id
      }
    }
    // data/mongo/redis/structure/er 若已存在同目标则聚焦
    if (!singleton && t.connectionId && (t.table || t.collection || t.key)) {
      const dup = get().tabs.find(
        (x) =>
          x.kind === t.kind &&
          x.connectionId === t.connectionId &&
          x.database === t.database &&
          x.table === t.table &&
          x.collection === t.collection &&
          x.key === t.key
      )
      if (dup) {
        set({ activeTabId: dup.id })
        return dup.id
      }
    }
    const id = t.id ?? uid()
    const tab: Tab = { closable: t.kind !== 'home', ...t, id }
    set({ tabs: [...get().tabs, tab], activeTabId: id })
    return id
  },

  closeTab(id) {
    const tabs = get().tabs
    const idx = tabs.findIndex((t) => t.id === id)
    if (idx < 0 || !tabs[idx].closable) return
    const next = tabs.filter((t) => t.id !== id)
    let active = get().activeTabId
    if (active === id) {
      active = next[Math.min(idx, next.length - 1)]?.id ?? 'home'
    }
    set({ tabs: next.length ? next : get().tabs, activeTabId: active })
  },

  setActiveTab(id) {
    set({ activeTabId: id })
  },

  updateTab(id, patch) {
    set({ tabs: get().tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)) })
  },

  toast(kind, msg) {
    const id = uid()
    set({ toasts: [...get().toasts, { id, kind, msg }] })
    setTimeout(() => get().dismissToast(id), 3600)
  },

  dismissToast(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) })
  }
}))

export function useActiveTab(): Tab | undefined {
  return useApp((s) => s.tabs.find((t) => t.id === s.activeTabId))
}

export function useConnection(id?: string): ConnectionConfig | undefined {
  return useApp((s) => (id ? s.connections.find((c) => c.id === id) : undefined))
}
