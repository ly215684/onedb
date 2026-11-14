import { useState } from 'react'
import { useT } from '../../lib/i18n'
import { Button, Field, Input, Modal, Spinner } from './primitives'

/** 二次确认弹窗，确认后异步执行，失败时在弹窗内展示错误 */
export function ConfirmDialog({
  title,
  message,
  confirmText,
  danger,
  onConfirm,
  onClose
}: {
  title: string
  message: string
  confirmText?: string
  danger?: boolean
  onConfirm: () => Promise<void>
  onClose: () => void
}): React.JSX.Element {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = (): void => {
    if (!busy) onClose()
  }

  const run = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={title}
      onClose={close}
      width={440}
      footer={
        <>
          <Button onClick={close} disabled={busy}>
            {t.common.cancel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={() => void run()} disabled={busy} icon={busy ? <Spinner /> : undefined}>
            {confirmText ?? t.common.save}
          </Button>
        </>
      }
    >
      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-fg-muted">{message}</p>
      {error && <div className="mt-3 rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">{error}</div>}
    </Modal>
  )
}

/** 单行输入弹窗，用于新建数据库/集合与重命名 */
export function PromptDialog({
  title,
  label,
  initial = '',
  placeholder,
  confirmText,
  validate,
  onSubmit,
  onClose
}: {
  title: string
  label: string
  initial?: string
  placeholder?: string
  confirmText?: string
  validate?: (value: string) => string | null
  onSubmit: (value: string) => Promise<void>
  onClose: () => void
}): React.JSX.Element {
  const t = useT()
  const [value, setValue] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = (): void => {
    if (!busy) onClose()
  }

  const run = async (): Promise<void> => {
    const v = value.trim()
    if (!v) {
      setError(t.menu.nameRequired)
      return
    }
    const invalid = validate?.(v)
    if (invalid) {
      setError(invalid)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSubmit(v)
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={title}
      onClose={close}
      width={440}
      footer={
        <>
          <Button onClick={close} disabled={busy}>
            {t.common.cancel}
          </Button>
          <Button variant="primary" onClick={() => void run()} disabled={busy} icon={busy ? <Spinner /> : undefined}>
            {confirmText ?? t.common.save}
          </Button>
        </>
      }
    >
      <Field label={label}>
        <Input
          value={value}
          placeholder={placeholder}
          disabled={busy}
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void run()
          }}
        />
      </Field>
      {error && <div className="mt-3 rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">{error}</div>}
    </Modal>
  )
}
