import { useCallback, useMemo, useRef, useState, type MouseEvent } from 'react'
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
import { EntityNodeContext } from './entity-node-context'
import { SidePanel } from './SidePanel'
import { EdgeKindControl } from './EdgeKindControl'
import { EdgeContextMenu } from './EdgeContextMenu'
import { edgeKindProps, type MappingEdge } from './edge-kind'
import { rerouteCollapsedEdges } from './collapse'
import { initialNodes, initialEdges } from './sample-data'
import type { MappingKind } from './types'

// 컨텍스트 메뉴 크기 — 화면 밖으로 나가지 않게 클램프할 때 쓴다
const MENU_W = 208
const MENU_H = 220

export default function Flow() {
  const nodeTypes = useMemo(() => ({ entity: EntityNode }), [])

  const paneRef = useRef<HTMLDivElement>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<EntityNodeType>(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<MappingEdge>(initialEdges)
  const [newEdgeKind, setNewEdgeKind] = useState<MappingKind>('keep')
  // 클릭한 엣지의 컨텍스트 메뉴 위치(컨테이너 기준 좌표)
  const [menu, setMenu] = useState<{ edgeId: string; x: number; y: number } | null>(
    null,
  )

  // 새 연결은 현재 선택된 종류(유지/가공)로 생성
  const onConnect: OnConnect = useCallback(
    (params) =>
      setEdges((eds) => addEdge({ ...params, ...edgeKindProps(newEdgeKind) }, eds)),
    [setEdges, newEdgeKind],
  )

  // 엣지 클릭/우클릭 → 컨텍스트 메뉴를 커서 위치에 연다 (컨테이너 안으로 클램프)
  const openMenu = useCallback((event: MouseEvent, edge: MappingEdge) => {
    event.preventDefault()
    const rect = paneRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width - MENU_W))
    const y = Math.max(0, Math.min(event.clientY - rect.top, rect.height - MENU_H))
    setMenu({ edgeId: edge.id, x, y })
  }, [])

  const closeMenu = useCallback(() => setMenu(null), [])

  const setEdgeKind = useCallback(
    (id: string, kind: MappingKind) =>
      setEdges((eds) =>
        eds.map((e) => (e.id === id ? { ...e, ...edgeKindProps(kind) } : e)),
      ),
    [setEdges],
  )

  const setEdgeLabel = useCallback(
    (id: string, label: string) =>
      setEdges((eds) => eds.map((e) => (e.id === id ? { ...e, label } : e))),
    [setEdges],
  )

  const deleteEdge = useCallback(
    (id: string) => {
      setEdges((eds) => eds.filter((e) => e.id !== id))
      setMenu(null)
    },
    [setEdges],
  )

  // 메뉴가 가리키는 엣지 (삭제됐으면 undefined → 메뉴 자동으로 사라짐)
  const menuEdge = menu ? edges.find((e) => e.id === menu.edgeId) : undefined

  // object 필드 접기/펴기 — 해당 노드 data.collapsed 토글
  const toggleCollapse = useCallback(
    (nodeId: string, path: string) =>
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n
          const cur = n.data.collapsed ?? []
          const next = cur.includes(path)
            ? cur.filter((p) => p !== path)
            : [...cur, path]
          return { ...n, data: { ...n.data, collapsed: next } }
        }),
      ),
    [setNodes],
  )
  const nodeCtx = useMemo(() => ({ onToggleCollapse: toggleCollapse }), [toggleCollapse])

  // 화면에 그릴 엣지 — 접힌 컨테이너로 롤업된 표시용. 원본 edges 는 그대로 보존.
  const displayEdges = useMemo(
    () => rerouteCollapsedEdges(edges, nodes),
    [edges, nodes],
  )

  return (
    <EntityNodeContext.Provider value={nodeCtx}>
    <div className="flex h-full w-full">
      <div ref={paneRef} className="relative h-full flex-1">
        <ReactFlow
          nodes={nodes}
          edges={displayEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeClick={openMenu}
          onEdgeContextMenu={openMenu}
          onPaneClick={closeMenu}
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
              lineage{' '}
              <span className="font-normal text-muted-foreground">
                · field mapping (prototype)
              </span>
            </div>
          </Panel>
          <Panel position="top-right">
            <div className="flex flex-col items-end gap-1">
              <EdgeKindControl value={newEdgeKind} onChange={setNewEdgeKind} />
              <span className="rounded bg-card/80 px-1.5 py-0.5 text-[10px] text-muted-foreground backdrop-blur">
                엣지 클릭 시 메뉴 (캡션·타입·삭제)
              </span>
            </div>
          </Panel>
        </ReactFlow>

        {menu && menuEdge && (
          <EdgeContextMenu
            edge={menuEdge}
            x={menu.x}
            y={menu.y}
            onChangeKind={(kind) => setEdgeKind(menuEdge.id, kind)}
            onChangeLabel={(label) => setEdgeLabel(menuEdge.id, label)}
            onDelete={() => deleteEdge(menuEdge.id)}
            onClose={closeMenu}
          />
        )}
      </div>

      <SidePanel nodes={nodes} setNodes={setNodes} />
    </div>
    </EntityNodeContext.Provider>
  )
}
