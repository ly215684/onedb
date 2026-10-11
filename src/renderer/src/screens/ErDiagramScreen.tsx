import { useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps
} from '@xyflow/react'
import { Workflow, RefreshCw, KeyRound, Link2 } from 'lucide-react'
import { useApp, type Tab } from '../store/useApp'
import { useT } from '../lib/i18n'
import { Button, cx } from '../components/ui/primitives'
import type { ColumnDef, ERDiagram } from '../../../shared/types'

interface TableNodeData extends Record<string, unknown> {
  table: string
  columns: ColumnDef[]
  pk: Set<string>
  fk: Set<string>
}

function TableNode({ data, selected }: NodeProps): React.JSX.Element {
  const d = data as TableNodeData
  return (
    <div
      className={cx(
        'min-w-[180px] overflow-hidden rounded-lg border bg-raised shadow-sm',
        selected ? 'border-accent ring-2 ring-accent/30' : 'border-line'
      )}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="flex items-center gap-1.5 border-b border-line bg-accent-soft px-2.5 py-1.5">
        <Workflow size={12} className="text-accent" />
        <span className="text-xs font-semibold text-fg">{d.table}</span>
      </div>
      <div className="py-1">
        {d.columns.map((c) => (
          <div key={c.name} className="flex items-center gap-1.5 px-2.5 py-0.5 text-[11px]">
            {d.pk.has(c.name) ? (
              <KeyRound size={11} className="shrink-0 text-warn" />
            ) : d.fk.has(c.name) ? (
              <Link2 size={11} className="shrink-0 text-info" />
            ) : (
              <span className="h-1 w-1 shrink-0 rounded-full bg-fg-faint" />
            )}
            <span className="font-code text-fg">{c.name}</span>
            <span className="ml-auto font-code text-fg-faint">{c.type}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const nodeTypes = { table: TableNode }

export function ErDiagramScreen({ tab }: { tab: Tab }): React.JSX.Element {
  const app = useApp()
  const t = useT()
  const conn = app.connections.find((c) => c.id === tab.connectionId)

  const [diagram, setDiagram] = useState<ERDiagram | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function load(): Promise<void> {
    if (!conn) return
    setLoading(true)
    setErr(null)
    try {
      const d = await window.onedb.sql.er(conn.id, tab.database!, tab.schema)
      setDiagram(d)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.database, tab.schema])

  const { nodes, edges } = useMemo(() => {
    if (!diagram) return { nodes: [] as Node[], edges: [] as Edge[] }
    const COL_W = 300
    const ROW_H = 240
    const nodes: Node[] = diagram.nodes.map((n, i) => {
      const pk = new Set(n.columns.filter((c) => c.isPrimary).map((c) => c.name))
      const fk = new Set(diagram.edges.filter((e) => e.from === n.id).map((e) => e.fromColumn))
      return {
        id: n.id,
        type: 'table',
        position: { x: (i % 4) * COL_W, y: Math.floor(i / 4) * ROW_H },
        data: { table: n.table, columns: n.columns, pk, fk }
      }
    })
    const edges: Edge[] = diagram.edges.map((e) => ({
      id: e.id,
      source: e.from,
      target: e.to,
      type: 'smoothstep',
      label: '1:N',
      animated: false,
      style: { stroke: 'var(--border-default)' }
    }))
    return { nodes, edges }
  }, [diagram])

  if (!conn) return <div className="p-6 text-sm text-fg-muted">{t.sql.connInvalid}</div>

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line bg-surface px-3">
        <Workflow size={15} className="text-accent" />
        <span className="text-[13px] font-medium text-fg">{t.er.title} · {tab.database}</span>
        {diagram && <span className="text-[11px] text-fg-faint">{diagram.nodes.length} {t.er.tables} · {diagram.edges.length} {t.er.relations}</span>}
        <Button size="sm" variant="ghost" className="ml-auto" icon={<RefreshCw size={13} className={cx(loading && 'animate-spin')} />} onClick={() => void load()}>
          {t.common.refresh}
        </Button>
      </div>
      <div className="relative min-h-0 flex-1">
        {err ? (
          <div className="m-3 rounded-md border border-bad/40 bg-bad/10 p-3 font-code text-xs text-bad">{err}</div>
        ) : diagram && diagram.nodes.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-fg-faint">{t.er.empty}</div>
        ) : (
          <ReactFlow
            colorMode={app.resolvedTheme}
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            nodesDraggable
            nodesConnectable={false}
            elementsSelectable
            fitView
            proOptions={{ hideAttribution: true }}
            minZoom={0.3}
          >
            <Background gap={18} size={1} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable nodeColor={() => 'var(--accent)'} className="bg-raised" />
          </ReactFlow>
        )}
      </div>
    </div>
  )
}
