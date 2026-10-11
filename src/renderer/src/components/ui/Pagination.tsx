import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { Select, cx } from './primitives'

interface PaginationProps {
  /** 0-based 当前页 */
  page: number
  pageSize: number
  total: number
  pageSizeOptions?: number[]
  /** 有未提交变更等场景下禁用翻页/改页大小，避免重新加载丢失编辑 */
  disabled?: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

/** 生成页码序列，超出一屏用 '...' 省略中间 */
function pageTokens(current: number, pages: number): (number | '...')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const res: (number | '...')[] = [1]
  const left = Math.max(2, current - 1)
  const right = Math.min(pages - 1, current + 1)
  if (left > 2) res.push('...')
  for (let i = left; i <= right; i++) res.push(i)
  if (right < pages - 1) res.push('...')
  res.push(pages)
  return res
}

export function Pagination({
  page,
  pageSize,
  total,
  pageSizeOptions = [20, 50, 100, 200, 500],
  disabled = false,
  onPageChange,
  onPageSizeChange
}: PaginationProps): React.JSX.Element {
  const t = useT()
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const [jump, setJump] = useState(String(page + 1))
  useEffect(() => {
    setJump(String(page + 1))
  }, [page])

  function go(oneBased: number): void {
    const np = Math.min(Math.max(1, oneBased), pages) - 1
    if (np !== page) onPageChange(np)
  }

  const navBtn =
    'flex h-6 w-6 items-center justify-center rounded text-fg-muted hover:bg-line disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
      <span className="whitespace-nowrap">{t.pg.total.replace('{total}', String(total))}</span>
      <div className="w-28 shrink-0">
        <Select
          value={String(pageSize)}
          onChange={(v) => onPageSizeChange(Number(v))}
          options={pageSizeOptions.map((n) => ({ value: String(n), label: t.pg.perPage.replace('{n}', String(n)) }))}
        />
      </div>
      <div className="flex items-center gap-0.5">
        <button className={navBtn} disabled={disabled || page === 0} onClick={() => go(page)} title={t.common.prev}>
          <ChevronLeft size={14} />
        </button>
        {pageTokens(page + 1, pages).map((tk, i) =>
          tk === '...' ? (
            <span key={`e${i}`} className="px-1 text-fg-faint">
              ···
            </span>
          ) : (
            <button
              key={tk}
              disabled={disabled}
              onClick={() => go(tk)}
              className={cx(
                'h-6 min-w-6 rounded px-1.5 transition-colors',
                tk === page + 1 ? 'bg-accent font-medium text-on-accent' : 'hover:bg-line'
              )}
            >
              {tk}
            </button>
          )
        )}
        <button className={navBtn} disabled={disabled || page + 1 >= pages} onClick={() => go(page + 2)} title={t.common.next}>
          <ChevronRight size={14} />
        </button>
      </div>
      <div className="flex items-center gap-1 whitespace-nowrap">
        <span>{t.pg.goto}</span>
        <input
          value={jump}
          disabled={disabled}
          onChange={(e) => setJump(e.target.value.replace(/[^0-9]/g, ''))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') go(Number(jump) || 1)
          }}
          onBlur={() => go(Number(jump) || 1)}
          className="h-6 w-12 rounded border border-line bg-canvas px-1 text-center text-fg outline-none focus:border-accent disabled:opacity-40"
        />
        <span>{t.pg.pageUnit}</span>
      </div>
    </div>
  )
}
