import { useEffect, useState } from 'react'
import { Copy } from 'lucide-react'
import { useApp } from '../store/useApp'
import { useT } from '../lib/i18n'

/**
 * 表头点击选中整列 + 右键菜单复制，供各数据表格复用。
 * getValues(col) 返回该列的行文本，getLabel(col) 返回列名（可省略）。
 */
export function useColumnSelect(
  getValues: (col: number) => string[],
  getLabel?: (col: number) => string | undefined
): {
  selectedCol: number | null
  selectCol: (col: number) => void
  clear: () => void
  onContextMenu: (e: React.MouseEvent) => void
  menu: React.ReactNode
} {
  const app = useApp()
  const t = useT()
  const [selectedCol, setSelectedCol] = useState<number | null>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!pos) return
    const close = (): void => setPos(null)
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', close)
    window.addEventListener('blur', close)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', close)
      window.removeEventListener('blur', close)
    }
  }, [pos])

  // Esc 取消列选中
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setSelectedCol(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onContextMenu = (e: React.MouseEvent): void => {
    if (selectedCol === null || getValues(selectedCol).length === 0) return
    e.preventDefault()
    setPos({
      x: Math.min(e.clientX, window.innerWidth - 150),
      y: Math.min(e.clientY, window.innerHeight - 56)
    })
  }

  async function copy(): Promise<void> {
    if (selectedCol === null) return
    const values = getValues(selectedCol)
    try {
      await navigator.clipboard.writeText(values.join('\n'))
      app.toast('success', `${t.common.copied} ${values.length} ${t.common.rows}`)
    } catch (e) {
      app.toast('error', (e as Error).message)
    }
  }

  const menu = pos ? (
    <div
      className="fixed z-50 min-w-[150px] rounded-md border border-line bg-raised py-1 shadow-lg"
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-fg hover:bg-accent-soft hover:text-accent"
        onClick={() => {
          setPos(null)
          void copy()
        }}
      >
        <Copy size={13} />
        <span>{t.common.copy}</span>
        {selectedCol !== null && getLabel && (
          <span className="ml-auto max-w-[120px] truncate font-code text-[11px] text-fg-faint">
            {getLabel(selectedCol)}
          </span>
        )}
      </button>
    </div>
  ) : null

  return { selectedCol, selectCol: setSelectedCol, clear: () => setSelectedCol(null), onContextMenu, menu }
}
