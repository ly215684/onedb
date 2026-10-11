import { CheckCircle2, XCircle, Info } from 'lucide-react'
import { useApp } from '../store/useApp'

const ICONS = {
  success: <CheckCircle2 size={16} className="text-ok" />,
  error: <XCircle size={16} className="text-bad" />,
  info: <Info size={16} className="text-info" />
}

export function Toaster(): React.JSX.Element {
  const { toasts, dismissToast } = useApp()
  return (
    <div className="pointer-events-none fixed bottom-9 right-3 z-[60] flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-start gap-2 rounded-lg border border-line bg-raised px-3 py-2.5 text-[13px] shadow-lg"
          onClick={() => dismissToast(t.id)}
        >
          <span className="mt-0.5 shrink-0">{ICONS[t.kind]}</span>
          <span className="text-fg">{t.msg}</span>
        </div>
      ))}
    </div>
  )
}
