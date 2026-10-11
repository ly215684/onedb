import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import type { ConnectionConfig, AppSettings } from '../shared/types'

const dir = () => join(app.getPath('userData'), 'onedb-store')
const ensure = (): void => {
  const d = dir()
  if (!existsSync(d)) mkdirSync(d, { recursive: true })
}
const file = (name: string): string => join(dir(), name)

function read<T>(name: string, fallback: T): T {
  ensure()
  const f = file(name)
  if (!existsSync(f)) return fallback
  try {
    return JSON.parse(readFileSync(f, 'utf-8')) as T
  } catch {
    return fallback
  }
}
function write<T>(name: string, data: T): void {
  ensure()
  writeFileSync(file(name), JSON.stringify(data, null, 2), 'utf-8')
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  accent: '#3A66E2',
  density: 'comfy',
  language: 'zh',
  editorLigatures: true,
  showDbColorLabels: true,
  defaultLimit: 200
}

export const store = {
  loadConnections: (): ConnectionConfig[] => read<ConnectionConfig[]>('connections.json', []),
  saveConnections: (list: ConnectionConfig[]): void => write('connections.json', list),
  loadSettings: (): AppSettings => ({ ...DEFAULT_SETTINGS, ...read<Partial<AppSettings>>('settings.json', {}) }),
  saveSettings: (s: AppSettings): void => write('settings.json', s)
}
