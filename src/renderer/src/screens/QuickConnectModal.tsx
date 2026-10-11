import { useState } from 'react'
import { CheckCircle2, XCircle, Loader2, Plus } from 'lucide-react'
import { useApp } from '../store/useApp'
import { useT } from '../lib/i18n'
import { DB_META, DB_ORDER, dbColor, uid } from '../lib/dbMeta'
import { Button, Field, Input, Modal, Select, Toggle } from '../components/ui/primitives'
import type { ConnectionConfig, DbType, TestResult } from '../../../shared/types'

const ACCENT_PRESETS = ['#3a66e2', '#008cb1', '#f2994a', '#008342', '#cb3f4a', '#4caf50', '#21c1e0', '#8a3ffc']

function newConn(type: DbType): ConnectionConfig {
  return {
    id: uid(),
    name: DB_META[type].label,
    type,
    host: '127.0.0.1',
    port: DB_META[type].defaultPort,
    user: DB_META[type].sampleUser,
    createdAt: Date.now()
  }
}

export function QuickConnectModal(): React.JSX.Element {
  const app = useApp()
  const t = useT()
  const qc = app.quickConnect
  const [draft, setDraft] = useState<ConnectionConfig>(() =>
    qc.editing ? { ...qc.editing } : newConn(qc.presetType ?? 'mysql')
  )
  const [test, setTest] = useState<{ state: 'idle' | 'run' | 'ok' | 'err'; msg?: string }>({ state: 'idle' })

  const meta = DB_META[draft.type]
  const isSrv = draft.type === 'mongo-srv'
  const isEmbedded = draft.type === 'sqlite'
  const showHost = !isEmbedded
  const showUser = !isEmbedded
  const showDb = meta.kind === 'relational' || (meta.kind === 'document' && !isSrv)

  const patch = (p: Partial<ConnectionConfig>): void => setDraft((d) => ({ ...d, ...p }))

  const pickType = (type: DbType): void =>
    setDraft((d) => {
      const base: ConnectionConfig = { ...d, type, port: DB_META[type].defaultPort }
      if (DB_META[type].kind !== 'relational') base.ssl = false
      if (!base.name || base.name === DB_META[d.type].label) base.name = DB_META[type].label
      return base
    })

  async function runTest(): Promise<void> {
    setTest({ state: 'run' })
    try {
      const res: TestResult = await window.onedb.conn.test(draft)
      setTest(res.ok ? { state: 'ok', msg: res.serverVersion || res.message } : { state: 'err', msg: res.message })
    } catch (e) {
      setTest({ state: 'err', msg: (e as Error).message })
    }
  }

  async function doSave(): Promise<void> {
    if (!draft.name.trim()) {
      app.toast('error', t.qc.needName)
      return
    }
    await app.upsertConnection(draft)
    app.closeQuickConnect()
    app.toast('success', qc.editing ? t.qc.updated : t.qc.saved)
  }

  return (
    <Modal
      width={720}
      title={qc.editing ? t.qc.edit : t.qc.create}
      onClose={() => app.closeQuickConnect()}
      footer={
        <>
          <div className="mr-auto min-w-0 truncate text-xs text-fg-muted">
            {test.state === 'run' && (
              <span className="flex items-center gap-1.5">
                <Loader2 size={13} className="animate-spin" /> {t.qc.testing}
              </span>
            )}
            {test.state === 'ok' && (
              <span className="flex items-center gap-1.5 text-ok">
                <CheckCircle2 size={14} /> {test.msg}
              </span>
            )}
            {test.state === 'err' && (
              <span className="flex items-center gap-1.5 text-bad">
                <XCircle size={14} /> {test.msg}
              </span>
            )}
          </div>
          <Button variant="ghost" onClick={() => void runTest()} disabled={test.state === 'run'}>
            {t.qc.test}
          </Button>
          <Button variant="primary" onClick={() => void doSave()}>
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className="mb-4">
        <Field label={t.qc.dbType}>
          <div className="mt-1.5 grid grid-cols-6 gap-2">
            {DB_ORDER.map((type) => {
              const active = type === draft.type
              return (
                <button
                  key={type}
                  onClick={() => pickType(type)}
                  className="flex flex-col items-center gap-1.5 rounded-md border p-2.5 transition-all"
                  style={{
                    borderColor: active ? dbColor(type) : 'var(--border)',
                    background: active ? `color-mix(in srgb, ${dbColor(type)} 12%, transparent)` : 'transparent'
                  }}
                >
                  <span className="h-5 w-5 rounded-full" style={{ background: dbColor(type) }} />
                  <span className="text-cap" style={{ color: active ? dbColor(type) : 'var(--text-secondary)' }}>
                    {DB_META[type].label}
                  </span>
                </button>
              )
            })}
          </div>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label={t.qc.name}>
          <Input value={draft.name} onChange={(e) => patch({ name: e.target.value })} placeholder={t.qc.namePh} />
        </Field>

        {isEmbedded ? (
          <Field label={t.qc.filePath} hint={t.qc.filePathHint}>
            <Input value={draft.database ?? ''} onChange={(e) => patch({ database: e.target.value })} placeholder="/path/to/app.db" />
          </Field>
        ) : isSrv ? (
          <div className="col-span-1">
            <Field label={t.qc.srvConn}>
              <Input value={draft.srvUrl ?? ''} onChange={(e) => patch({ srvUrl: e.target.value })} placeholder="mongodb+srv://user:pass@cluster.mongodb.net" />
            </Field>
          </div>
        ) : (
          <>
            <Field label={t.qc.host}>
              <Input value={draft.host ?? ''} onChange={(e) => patch({ host: e.target.value })} placeholder="127.0.0.1" />
            </Field>
            <Field label={t.qc.port}>
              <Input type="number" value={draft.port ?? DB_META[draft.type].defaultPort} onChange={(e) => patch({ port: Number(e.target.value) })} />
            </Field>
          </>
        )}

        {showUser && (
          <Field label={draft.type === 'redis' ? t.qc.user : t.qc.user}>
            <Input
              value={draft.user ?? ''}
              onChange={(e) => patch({ user: e.target.value })}
              placeholder={draft.type === 'redis' ? 'default' : meta.sampleUser || 'root'}
            />
          </Field>
        )}
        {showUser && (
          <Field label={draft.type === 'redis' ? t.qc.redisPwd : t.qc.password}>
            <Input type="password" value={draft.password ?? ''} onChange={(e) => patch({ password: e.target.value })} placeholder={draft.type === 'redis' ? t.qc.redisPwdPh : ''} />
          </Field>
        )}

        {showDb && (
          <Field label={t.qc.defaultDb}>
            <Input value={draft.database ?? ''} onChange={(e) => patch({ database: e.target.value })} placeholder={t.qc.defaultDbPh} />
          </Field>
        )}
      </div>

      {meta.kind === 'relational' && !isEmbedded && (
        <div className="mt-4 flex items-center gap-3 rounded-md border border-line bg-canvas px-3 py-2.5">
          <Toggle checked={!!draft.ssl} onChange={(v) => patch({ ssl: v })} />
          <span className="text-[13px] text-fg">{t.qc.ssl}</span>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3 rounded-md border border-line bg-canvas px-3 py-2.5">
        <Toggle
          checked={!!draft.ssh?.enabled}
          onChange={(v) =>
            patch({ ssh: v ? { enabled: true, host: draft.ssh?.host ?? '', port: draft.ssh?.port ?? 22, username: draft.ssh?.username ?? '', authType: draft.ssh?.authType ?? 'password' } : undefined })
          }
        />
        <span className="text-[13px] text-fg">{t.qc.ssh}</span>
      </div>
      {draft.ssh?.enabled && (
        <div className="mt-3 grid grid-cols-3 gap-3 rounded-md border border-line bg-canvas/60 p-3">
          <Field label={t.qc.bastion}>
            <Input value={draft.ssh.host} onChange={(e) => patch({ ssh: { ...draft.ssh!, host: e.target.value } })} placeholder="bastion.example.com" />
          </Field>
          <Field label={t.qc.port}>
            <Input type="number" value={draft.ssh.port ?? 22} onChange={(e) => patch({ ssh: { ...draft.ssh!, port: Number(e.target.value) } })} />
          </Field>
          <Field label={t.qc.user}>
            <Input value={draft.ssh.username} onChange={(e) => patch({ ssh: { ...draft.ssh!, username: e.target.value } })} placeholder="deploy" />
          </Field>
          <Field label={t.qc.authMethod}>
            <Select
              value={draft.ssh.authType}
              onChange={(v) => patch({ ssh: { ...draft.ssh!, authType: v as 'password' | 'privateKey' } })}
              options={[
                { value: 'password', label: t.qc.authPassword },
                { value: 'privateKey', label: t.qc.authKey }
              ]}
            />
          </Field>
          <div className="col-span-2">
            {draft.ssh.authType === 'privateKey' ? (
              <Field label={t.qc.privKeyPem}>
                <Input value={draft.ssh.privateKey ?? ''} onChange={(e) => patch({ ssh: { ...draft.ssh!, privateKey: e.target.value } })} placeholder="-----BEGIN OPENSSH PRIVATE KEY-----" />
              </Field>
            ) : (
              <Field label={t.qc.loginPwd}>
                <Input type="password" value={draft.ssh.password ?? ''} onChange={(e) => patch({ ssh: { ...draft.ssh!, password: e.target.value } })} />
              </Field>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between rounded-md border border-line bg-canvas px-3 py-2.5">
        <span className="text-[13px] text-fg">{t.qc.tagColor}</span>
        <div className="flex items-center gap-1.5">
          {ACCENT_PRESETS.map((c) => (
            <button
              key={c}
              onClick={() => patch({ color: c })}
              className="h-4 w-4 rounded-full border transition-transform hover:scale-110"
              style={{ background: c, borderColor: draft.color === c ? 'var(--fg)' : 'transparent', transform: draft.color === c ? 'scale(1.15)' : undefined }}
            />
          ))}
          <div className="relative ml-1 h-4 w-4 overflow-hidden rounded-full border border-line">
            <input
              type="color"
              value={draft.color || '#3a66e2'}
              onChange={(e) => patch({ color: e.target.value })}
              className="absolute -inset-2 h-6 w-6 cursor-pointer opacity-0"
            />
            <Plus size={10} className="absolute inset-0 m-auto text-fg-muted" />
          </div>
        </div>
      </div>
    </Modal>
  )
}
