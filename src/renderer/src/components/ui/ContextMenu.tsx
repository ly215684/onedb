import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cx } from './primitives'

export interface MenuItem {
  label: string
  icon?: ReactNode
  danger?: boolean
  disabled?: boolean
  onSelect: () => void
}

export type MenuEntry = MenuItem | { separator: true }

const ITEM_HEIGHT = 28
const SEPARATOR_HEIGHT = 9
const PADDING = 8

/** 通用右键菜单：portal 到 body，fixed 定位，自动避开视口边缘 */
export function ContextMenu({
  x,
  y,
  entries,
  onClose
}: {
  x: number
  y: number
  entries: MenuEntry[]
  onClose: () => void
}): React.JSX.Element | null {
  const ref = useRef<HTMLDivElement>(null)
  const estimatedHeight = entries.reduce((n, e) => n + ('separator' in e ? SEPARATOR_HEIGHT : ITEM_HEIGHT), PADDING)
  const [pos, setPos] = useState({
    left: Math.max(8, Math.min(x, window.innerWidth - 200 - 8)),
    top: Math.max(8, Math.min(y, window.innerHeight - estimatedHeight - 8))
  })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setPos({
      left: Math.max(8, Math.min(x, window.innerWidth - el.offsetWidth - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - el.offsetHeight - 8))
    })
  }, [x, y])

  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    const onScroll = (): void => onClose()
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onScroll)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [onClose])

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[70] min-w-[190px] rounded-md border border-line bg-raised p-1 shadow-xl"
      style={{ left: pos.left, top: pos.top }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {entries.map((entry, i) =>
        'separator' in entry ? (
          <div key={`s${i}`} className="mx-1 my-1 h-px bg-line" />
        ) : (
          <button
            key={i}
            disabled={entry.disabled}
            onClick={() => entry.onSelect()}
            className={cx(
              'flex w-full items-center gap-2 rounded px-2 py-[5px] text-left text-[13px] transition-colors disabled:cursor-default disabled:opacity-40',
              entry.danger ? 'text-bad hover:bg-bad/10' : 'text-fg hover:bg-accent-soft hover:text-accent'
            )}
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center">{entry.icon}</span>
            <span className="truncate">{entry.label}</span>
          </button>
        )
      )}
    </div>,
    document.body
  )
}
