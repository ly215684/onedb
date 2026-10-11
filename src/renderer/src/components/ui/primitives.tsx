import { type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'

export function cx(...xs: (string | false | null | undefined)[]): string {
  return xs.filter(Boolean).join(' ')
}

type BtnVariant = 'primary' | 'default' | 'ghost' | 'danger' | 'soft'
export function Button({
  variant = 'default',
  size = 'md',
  icon,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md'; icon?: ReactNode }): React.JSX.Element {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-pointer whitespace-nowrap'
  const sizes = size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-[13px]'
  const variants: Record<BtnVariant, string> = {
    primary: 'bg-accent text-on-accent hover:bg-accent-strong',
    default: 'bg-raised border border-line text-fg hover:border-accent hover:text-accent',
    ghost: 'text-fg-muted hover:bg-accent-soft hover:text-accent',
    soft: 'bg-accent-soft text-accent hover:bg-accent hover:text-on-accent',
    danger: 'bg-bad text-white hover:opacity-90'
  }
  return (
    <button className={cx(base, sizes, variants[variant], className)} {...rest}>
      {icon}
      {children}
    </button>
  )
}

export function IconButton({
  children,
  className,
  active,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }): React.JSX.Element {
  return (
    <button
      className={cx(
        'inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-accent-soft hover:text-accent',
        active && 'bg-accent-soft text-accent',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>): React.JSX.Element {
  return (
    <input
      className={cx(
        'h-8 w-full rounded-md border border-line bg-surface px-2.5 text-[13px] text-fg outline-none placeholder:text-fg-faint focus:border-accent',
        className
      )}
      {...rest}
    />
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-fg-muted">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-fg-faint">{hint}</span>}
    </label>
  )
}

export function Select({
  value,
  onChange,
  options,
  className
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  className?: string
}): React.JSX.Element {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cx(
        'h-8 w-full cursor-pointer appearance-none rounded-md border border-line bg-surface px-2.5 text-[13px] text-fg outline-none focus:border-accent',
        className
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-accent' : 'bg-line'
      )}
    >
      <span
        className={cx(
          'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-[2px]'
        )}
      />
    </button>
  )
}

export function Badge({ children, color, className }: { children: ReactNode; color?: string; className?: string }): React.JSX.Element {
  return (
    <span
      className={cx('inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase', className)}
      style={color ? { color, background: `color-mix(in srgb, ${color} 16%, transparent)` } : undefined}
    >
      {children}
    </span>
  )
}

export function Spinner({ className }: { className?: string }): React.JSX.Element {
  return <Loader2 className={cx('h-4 w-4 animate-spin', className)} />
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  width = 560
}: {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: number
}): React.JSX.Element {
  useEffect(() => {
    const h = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6" onClick={onClose}>
      <div
        className="flex max-h-full w-full flex-col overflow-hidden rounded-xl border border-line bg-raised shadow-2xl"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4">
          <div className="text-[15px] font-semibold text-fg">{title}</div>
          <IconButton onClick={onClose} className="h-7 w-7">
            <X size={16} />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
        {footer && <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-4 py-3">{footer}</div>}
      </div>
    </div>
  )
}

export function EmptyState({ icon, title, desc, action }: { icon?: ReactNode; title: string; desc?: string; action?: ReactNode }): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
      {icon && <div className="mb-1 text-fg-faint">{icon}</div>}
      <div className="text-sm font-medium text-fg">{title}</div>
      {desc && <div className="max-w-xs text-xs text-fg-muted">{desc}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
