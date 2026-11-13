import { app, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateInfo, ProgressInfo } from 'electron-updater'
import type { UpdateState } from '../shared/types'

let state: UpdateState = { status: 'idle', currentVersion: app.getVersion() }
let initialized = false

function broadcast(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('update:changed', { ...state })
  }
}

function setState(patch: Partial<UpdateState>): UpdateState {
  state = { ...state, currentVersion: app.getVersion(), ...patch }
  broadcast()
  return state
}

function normalizeNotes(info: UpdateInfo): string | undefined {
  if (!info.releaseNotes) return undefined
  if (typeof info.releaseNotes === 'string') return info.releaseNotes
  return info.releaseNotes.map((n) => `${n.version}${n.note ? `\n${n.note}` : ''}`).join('\n\n')
}

/** 初始化自动更新：只监听事件并广播状态，实际检查由启动时或用户手动触发 */
export function initUpdater(): void {
  if (initialized) return
  initialized = true

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => setState({ status: 'checking', error: undefined }))
  autoUpdater.on('update-available', (info) =>
    setState({
      status: 'available',
      latestVersion: info.version,
      releaseDate: typeof info.releaseDate === 'string' ? info.releaseDate : undefined,
      releaseNotes: normalizeNotes(info),
      percent: undefined,
      transferred: undefined,
      total: undefined,
      bytesPerSecond: undefined,
      error: undefined
    })
  )
  autoUpdater.on('update-not-available', () => setState({ status: 'not-available', error: undefined }))
  autoUpdater.on('download-progress', (progress: ProgressInfo) =>
    setState({
      status: 'downloading',
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond
    })
  )
  autoUpdater.on('update-downloaded', (info) =>
    setState({ status: 'downloaded', latestVersion: info.version, percent: 100, error: undefined })
  )
  autoUpdater.on('error', (err) => setState({ status: 'error', error: err?.message || String(err) }))
}

export function getUpdateState(): UpdateState {
  return { ...state }
}

/** 手动检查更新：开发环境（未打包）直接返回 dev-mode 错误 */
export async function checkForUpdates(): Promise<UpdateState> {
  if (!app.isPackaged) {
    return setState({ status: 'error', error: 'dev-mode' })
  }
  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    setState({ status: 'error', error: (err as Error).message })
  }
  return getUpdateState()
}

/** 下载新版本安装包，进度通过 update:changed 事件推送 */
export async function downloadUpdate(): Promise<UpdateState> {
  if (!app.isPackaged) {
    return setState({ status: 'error', error: 'dev-mode' })
  }
  try {
    setState({ status: 'downloading', percent: 0 })
    await autoUpdater.downloadUpdate()
  } catch (err) {
    setState({ status: 'error', error: (err as Error).message })
  }
  return getUpdateState()
}

/** 退出并安装已下载的更新 */
export function installUpdate(): boolean {
  if (state.status !== 'downloaded') return false
  // isSilent=false：展示安装向导；isForceRunAfter=true：安装完成后自动重启应用
  autoUpdater.quitAndInstall(false, true)
  return true
}

/** 启动时静默检查一次（仅打包环境，避免拖慢启动） */
export function autoCheckForUpdates(): void {
  if (!app.isPackaged) return
  setTimeout(() => {
    void checkForUpdates()
  }, 5000)
}
