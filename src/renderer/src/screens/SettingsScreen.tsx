import { useState } from 'react'
import { Sun, Moon, Monitor, Check, Type, Gauge, Languages, Save, Hash, Download, RefreshCw, RotateCcw } from 'lucide-react'
import { useApp } from '../store/useApp'
import { useT } from '../lib/i18n'
import { Button, Toggle, Select, cx } from '../components/ui/primitives'
import type { Density, ThemeMode } from '../../../shared/types'

const ACCENTS = ['#3A66E2', '#008342', '#CD293C', '#E1A125', '#8A2EDD', '#22A2D9', '#2EB25E', '#F06292']

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

const THEME_ICONS: Record<ThemeMode, React.ReactNode> = {
  light: <Sun size={16} />,
  dark: <Moon size={16} />,
  system: <Monitor size={16} />
}
const THEME_MODES: ThemeMode[] = ['light', 'dark', 'system']
const DENSITIES: Density[] = ['compact', 'comfy', 'large']

function Section({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc?: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-accent">{icon}</span>
        <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
      </div>
      {desc && <p className="mb-3 -mt-1 text-xs text-fg-muted">{desc}</p>}
      {children}
    </section>
  )
}

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between border-b border-line-soft py-2.5 last:border-0">
      <div>
        <div className="text-[13px] text-fg">{label}</div>
        {desc && <div className="text-[11px] text-fg-faint">{desc}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export function SettingsScreen(): React.JSX.Element {
  const app = useApp()
  const tx = useT()
  const s = app.settings
  const themeLabel: Record<ThemeMode, string> = { light: tx.settings.light, dark: tx.settings.dark, system: tx.settings.system }
  const [saved, setSaved] = useState(false)

  const flash = (): void => {
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }
  const update = (patch: Parameters<typeof app.saveSettings>[0]): void => {
    void app.saveSettings(patch)
    flash()
  }

  const u = app.update
  const version = u.currentVersion || app.appVersion
  const updateStatusText = ((): string => {
    switch (u.status) {
      case 'checking':
        return tx.settings.checking
      case 'available':
        return `${tx.settings.updateAvailable} v${u.latestVersion ?? ''}`
      case 'not-available':
        return tx.settings.upToDate
      case 'downloading':
        return `${tx.settings.downloading} ${Math.floor(u.percent ?? 0)}%`
      case 'downloaded':
        return tx.settings.downloadComplete
      case 'error':
        return u.error === 'dev-mode' ? tx.settings.devNotSupported : `${tx.settings.updateError}${u.error ? `: ${u.error}` : ''}`
      default:
        return tx.settings.updateIdle
    }
  })()

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-3xl px-8 py-7">
        <h1 className="text-[20px] font-semibold text-fg">{tx.settings.title}</h1>
        <p className="mt-0.5 mb-6 text-[13px] text-fg-muted">{tx.settings.subtitle}</p>

        <Section icon={<Sun size={16} />} title={tx.settings.appearance}>
          <div className="grid grid-cols-3 gap-3">
            {THEME_MODES.map((mode) => (
              <button
                key={mode}
                onClick={() => update({ theme: mode })}
                className={cx(
                  'relative flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors',
                  s.theme === mode ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-fg-faint'
                )}
              >
                <span className={cx(s.theme === mode ? 'text-accent' : 'text-fg-muted')}>{THEME_ICONS[mode]}</span>
                <span className="text-[13px] font-medium text-fg">{themeLabel[mode]}</span>
                {s.theme === mode && (
                  <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-on-accent">
                    <Check size={11} />
                  </span>
                )}
              </button>
            ))}
          </div>
        </Section>

        <Section icon={<Hash size={16} />} title={tx.settings.accent}>
          <div className="flex flex-wrap gap-2.5">
            {ACCENTS.map((c) => (
              <button
                key={c}
                onClick={() => update({ accent: c })}
                className={cx('h-8 w-8 rounded-full border-2 transition-transform', s.accent.toLowerCase() === c.toLowerCase() ? 'scale-110 border-fg' : 'border-transparent hover:scale-105')}
                style={{ background: c }}
              />
            ))}
          </div>
        </Section>

        <Section icon={<Gauge size={16} />} title={tx.settings.density} desc={tx.settings.densityDesc}>
          <div className="inline-flex rounded-md border border-line bg-surface p-0.5">
            {DENSITIES.map((v) => (
              <button
                key={v}
                onClick={() => update({ density: v })}
                className={cx('rounded px-4 py-1.5 text-[13px] transition-colors', s.density === v ? 'bg-accent text-on-accent' : 'text-fg-muted hover:text-fg')}
              >
                {tx.status.density[v]}
              </button>
            ))}
          </div>
        </Section>

        <Section icon={<Type size={16} />} title={tx.settings.editor}>
          <div className="rounded-lg border border-line bg-surface px-4">
            <Row label={tx.settings.ligatures} desc={tx.settings.ligaturesDesc}>
              <Toggle checked={s.editorLigatures} onChange={(v) => update({ editorLigatures: v })} />
            </Row>
            <Row label={tx.settings.showColor} desc={tx.settings.showColorDesc}>
              <Toggle checked={s.showDbColorLabels} onChange={(v) => update({ showDbColorLabels: v })} />
            </Row>
            <Row label={tx.settings.defaultRows}>
              <div className="w-32">
                <Select
                  value={String(s.defaultLimit)}
                  onChange={(v) => update({ defaultLimit: Number(v) })}
                  options={[50, 100, 200, 500, 1000].map((n) => ({ value: String(n), label: String(n) }))}
                />
              </div>
            </Row>
            <Row label={tx.settings.pageSize} desc={tx.settings.pageSizeDesc}>
              <div className="w-32">
                <Select
                  value={String(s.defaultPageSize)}
                  onChange={(v) => update({ defaultPageSize: Number(v) })}
                  options={[20, 50, 100, 200, 500, 1000].map((n) => ({ value: String(n), label: String(n) }))}
                />
              </div>
            </Row>
          </div>
        </Section>

        <Section icon={<Languages size={16} />} title={tx.settings.language}>
          <div className="w-48">
            <Select
              value={s.language}
              onChange={(v) => update({ language: v as 'zh' | 'en' })}
              options={[
                { value: 'zh', label: tx.settings.langZh },
                { value: 'en', label: tx.settings.langEn }
              ]}
            />
          </div>
        </Section>

        <Section icon={<Download size={16} />} title={tx.settings.update} desc={tx.settings.updateDesc}>
          <div className="rounded-lg border border-line bg-surface px-4">
            <Row label={tx.settings.currentVersion}>
              <span className="font-code text-[12px] text-fg-muted">v{version}</span>
            </Row>
            <Row label={tx.settings.updateStatus} desc={updateStatusText}>
              <div className="flex items-center gap-2">
                {u.status === 'available' && (
                  <Button size="sm" variant="primary" icon={<Download size={13} />} onClick={() => void app.downloadUpdate()}>
                    {tx.settings.downloadUpdate}
                  </Button>
                )}
                {u.status === 'downloaded' && (
                  <Button size="sm" variant="primary" icon={<RotateCcw size={13} />} onClick={() => void app.installUpdate()}>
                    {tx.settings.installNow}
                  </Button>
                )}
                <Button
                  size="sm"
                  icon={<RefreshCw size={13} className={cx(u.status === 'checking' && 'animate-spin')} />}
                  disabled={u.status === 'checking' || u.status === 'downloading'}
                  onClick={() => void app.checkUpdate()}
                >
                  {u.status === 'checking' ? tx.settings.checking : tx.settings.checkUpdate}
                </Button>
              </div>
            </Row>
            {u.status === 'downloading' && (
              <div className="py-2.5">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-line-soft">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, u.percent ?? 0))}%` }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-fg-faint">
                  <span>{Math.floor(u.percent ?? 0)}%</span>
                  {u.transferred != null && u.total ? (
                    <span>
                      {formatBytes(u.transferred)} / {formatBytes(u.total)}
                    </span>
                  ) : null}
                </div>
              </div>
            )}
            {u.status === 'available' && u.releaseNotes && (
              <div className="border-t border-line-soft py-2.5">
                <div className="mb-1 text-[11px] font-medium text-fg-muted">{tx.settings.releaseNotes}</div>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap font-code text-[11px] leading-relaxed text-fg-muted">
                  {u.releaseNotes}
                </pre>
              </div>
            )}
          </div>
        </Section>

        <div className="flex items-center gap-3 border-t border-line pt-5">
          <Button variant="primary" icon={<Save size={14} />} onClick={() => void app.saveSettings({})}>
            {tx.settings.saveSettings}
          </Button>
          {saved && <span className="text-xs text-ok">{tx.settings.autoSaved}</span>}
          <span className="ml-auto text-[11px] text-fg-faint">
            OneDB v{app.appVersion} · {tx.settings.footer}
          </span>
        </div>
      </div>
    </div>
  )
}
