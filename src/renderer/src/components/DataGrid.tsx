import { fmtCell } from '../lib/dbMeta'
import { useT } from '../lib/i18n'
import { useColumnSelect } from './useColumnSelect'
import { cx } from './ui/primitives'

export function DataGrid({
  columns,
  rows,
  maxHeight
}: {
  columns: string[]
  rows: unknown[][]
  maxHeight?: number
}): React.JSX.Element {
  const t = useT()
  const colSel = useColumnSelect(
    (c) => rows.map((r) => fmtCell(r[c])),
    (c) => columns[c]
  )
  if (columns.length === 0) {
    return <div className="flex h-full items-center justify-center text-xs text-fg-faint">{t.sql.noResultSet}</div>
  }
  return (
    <div className="h-full overflow-auto" style={maxHeight ? { maxHeight } : undefined}>
      <table
        className="w-full border-separate border-spacing-0 text-[12.5px]"
        onContextMenu={colSel.onContextMenu}
      >
        <thead className="sticky top-0 z-10">
          <tr className="bg-raised">
            <th className="w-10 border-b border-r border-line bg-raised px-2 py-1.5 text-right font-mono text-[11px] font-normal text-fg-faint">
              #
            </th>
            {columns.map((c, j) => (
              <th
                key={`${j}-${c}`}
                onClick={() => colSel.selectCol(j)}
                className={cx(
                  'cursor-pointer select-none whitespace-nowrap border-b border-r border-line bg-raised px-2.5 py-1.5 text-left font-semibold text-fg',
                  colSel.selectedCol === j && 'bg-accent-soft text-accent'
                )}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={cx('hover:bg-accent-soft/50', i % 2 === 1 && 'bg-canvas/40')}>
              <td className="border-b border-r border-line-soft px-2 py-1 text-right font-mono text-[11px] text-fg-faint">
                {i + 1}
              </td>
              {r.map((cell, j) => {
                const nullish = cell === null || cell === undefined
                return (
                  <td
                    key={j}
                    title={fmtCell(cell)}
                    className={cx(
                      'max-w-[280px] truncate border-b border-r border-line-soft px-2.5 py-1',
                      nullish ? 'italic text-fg-faint' : 'font-code text-fg',
                      colSel.selectedCol === j && 'bg-accent-soft/70'
                    )}
                  >
                    {fmtCell(cell)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {colSel.menu}
    </div>
  )
}
