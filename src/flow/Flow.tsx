import { useCallback, useMemo, useState, type MouseEvent } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
  type OnConnect,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { EntityNode, type EntityNodeType } from './EntityNode'
import { EntityPanel } from './EntityPanel'
import { EdgeKindControl } from './EdgeKindControl'
import { edgeKindProps, type MappingEdge } from './edge-kind'
import { initialNodes, initialEdges } from './sample-data'
import type { MappingKind } from './types'

export default function Flow() {
  const nodeTypes = useMemo(() => ({ entity: EntityNode }), [])

  const [nodes, , onNodesChange] = useNodesState<EntityNodeType>(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<MappingEdge>(initialEdges)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newEdgeKind, setNewEdgeKind] = useState<MappingKind>('keep')

  // 새 연결은 현재 선택된 종류(유지/가공)로 생성
  const onConnect: OnConnect = useCallback(
    (params) =>
      setEdges((eds) => addEdge({ ...params, ...edgeKindProps(newEdgeKind) }, eds)),
    [setEdges, newEdgeKind],
  )

  // 캔버스 노드 클릭 → 패널 상세
  const onNodeClick = useCallback(
    (_: MouseEvent, node: EntityNodeType) => setSelectedId(node.id),
    [],
  )

  // 엣지 클릭 → 유지 ⇄ 가공 전환
  const onEdgeClick = useCallback(
    (_: MouseEvent, edge: MappingEdge) =>
      setEdges((eds) =>
        eds.map((e) =>
          e.id === edge.id
            ? {
                ...e,
                ...edgeKindProps(
                  e.data?.kind === 'transform' ? 'keep' : 'transform',
                ),
              }
            : e,
        ),
      ),
    [setEdges],
  )

  return (
    <div className="flex h-full w-full">
      <div className="relative h-full flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          defaultEdgeOptions={{
            type: 'default',
            markerEnd: { type: MarkerType.ArrowClosed },
          }}
          fitView
          fitViewOptions={{ padding: 0.2 }}
        >
          <Background gap={16} />
          <Controls />
          <MiniMap pannable zoomable />
          <Panel position="top-left">
            <div className="rounded-md border border-border bg-card/90 px-3 py-1.5 text-sm font-semibold shadow-sm backdrop-blur">
              liner{' '}
              <span className="font-normal text-muted-foreground">
                · data lineage (prototype)
              </span>
            </div>
          </Panel>
          <Panel position="top-right">
            <div className="flex flex-col items-end gap-1">
              <EdgeKindControl value={newEdgeKind} onChange={setNewEdgeKind} />
              <span className="rounded bg-card/80 px-1.5 py-0.5 text-[10px] text-muted-foreground backdrop-blur">
                엣지 클릭 시 유지 ⇄ 가공 전환
              </span>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      <EntityPanel
        nodes={nodes}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onClear={() => setSelectedId(null)}
      />
    </div>
  )
}
