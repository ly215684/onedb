import { useState } from 'react'
import { Sun, Moon, Monitor, Check, Type, Gauge, Languages, Save, Hash } from 'lucide-react'
import { useApp } from '../store/useApp'
import { useT } from '../lib/i18n'
import { Button, Toggle, Select, cx } from '../components/ui/primitives'
import type { Density, ThemeMode } from '../../../shared/types'

const ACCENTS = ['#3A66E2', '#008342', '#CD293C', '#E1A125', '#8A2EDD', '#22A2D9', '#2EB25E', '#F06292']

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

        <div className="flex items-center gap-3 border-t border-line pt-5">
          <Button variant="primary" icon={<Save size={14} />} onClick={() => void app.saveSettings({})}>
            {tx.settings.saveSettings}
          </Button>
          {saved && <span className="text-xs text-ok">{tx.settings.autoSaved}</span>}
          <span className="ml-auto text-[11px] text-fg-faint">{tx.settings.footer}</span>
        </div>
      </div>
    </div>
  )
}
