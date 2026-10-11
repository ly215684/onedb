import { useEffect } from 'react'
import { useApp, useActiveTab } from './store/useApp'
import { useT } from './lib/i18n'
import { TitleBar } from './components/TitleBar'
import { IconRail } from './components/IconRail'
import { TreePanel } from './components/TreePanel'
import { TabBar } from './components/TabBar'
import { StatusBar } from './components/StatusBar'
import { Toaster } from './components/Toaster'
import { QuickConnectModal } from './screens/QuickConnectModal'
import { HomeScreen } from './screens/HomeScreen'
import { SqlEditorScreen } from './screens/SqlEditorScreen'
import { DataGridScreen } from './screens/DataGridScreen'
import { MongoScreen } from './screens/MongoScreen'
import { RedisScreen } from './screens/RedisScreen'
import { StructureEditorScreen } from './screens/StructureEditorScreen'
import { ErDiagramScreen } from './screens/ErDiagramScreen'
import { SettingsScreen } from './screens/SettingsScreen'

function ScreenRouter(): React.JSX.Element {
  const tab = useActiveTab()
  switch (tab?.kind) {
    case 'sql':
      return <SqlEditorScreen key={tab.id} tab={tab} />
    case 'data':
      return <DataGridScreen key={tab.id} tab={tab} />
    case 'mongo':
      return <MongoScreen key={tab.id} tab={tab} />
    case 'redis':
      return <RedisScreen key={tab.id} tab={tab} />
    case 'structure':
      return <StructureEditorScreen key={tab.id} tab={tab} />
    case 'er':
      return <ErDiagramScreen key={tab.id} tab={tab} />
    case 'settings':
      return <SettingsScreen />
    default:
      return <HomeScreen />
  }
}

export default function App(): React.JSX.Element {
  const init = useApp((s) => s.init)
  const ready = useApp((s) => s.ready)
  const quick = useApp((s) => s.quickConnect)
  const themeMode = useApp((s) => s.settings.theme)
  const t = useT()

  useEffect(() => {
    void init()
  }, [init])

  // 跟随系统：监听主题变化
  useEffect(() => {
    if (themeMode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (): void => {
      const s = useApp.getState()
      s.applyTheme(s.settings)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [themeMode])

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center bg-canvas text-sm text-fg-muted">{t.common.starting}</div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-canvas">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <IconRail />
        <TreePanel />
        <main className="flex min-w-0 flex-1 flex-col">
          <TabBar />
          <div className="min-h-0 flex-1 overflow-hidden bg-canvas">
            <ScreenRouter />
          </div>
        </main>
      </div>
      <StatusBar />
      <Toaster />
      {quick.open && <QuickConnectModal />}
    </div>
  )
}
