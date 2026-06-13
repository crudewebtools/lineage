import { useCallback, useMemo } from 'react'
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
import { initialNodes, initialEdges } from './sample-data'

export default function Flow() {
  const nodeTypes = useMemo(() => ({ entity: EntityNode }), [])

  const [nodes, , onNodesChange] = useNodesState<EntityNodeType>(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges)

  const onConnect: OnConnect = useCallback(
    (params) =>
      setEdges((eds) =>
        addEdge(
          { ...params, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } },
          eds,
        ),
      ),
    [setEdges],
  )

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
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
  )
}
