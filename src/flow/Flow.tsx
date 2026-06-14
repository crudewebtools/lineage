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
  type Edge,
  type OnConnect,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { EntityNode, type EntityNodeType } from './EntityNode'
import { EntityPanel } from './EntityPanel'
import { initialNodes, initialEdges } from './sample-data'

export default function Flow() {
  const nodeTypes = useMemo(() => ({ entity: EntityNode }), [])

  const [nodes, , onNodesChange] = useNodesState<EntityNodeType>(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const onConnect: OnConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  )

  // 캔버스에서 노드를 클릭해도 패널 상세가 열리도록 연동
  const onNodeClick = useCallback(
    (_: MouseEvent, node: EntityNodeType) => setSelectedId(node.id),
    [],
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
                · data graph (prototype)
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
