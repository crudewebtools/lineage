import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react'
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
import { EntityNodeContext, EMPTY_HIGHLIGHT } from './entity-node-context'
import { computeHighlight, hoverSeeds, type HoveredField } from './highlight'
import { SidePanel } from './SidePanel'
import { EdgeKindControl } from './EdgeKindControl'
import { EdgeContextMenu } from './EdgeContextMenu'
import { edgeKindProps, type MappingEdge } from './edge-kind'
import { rerouteCollapsedEdges } from './collapse'
import { graphToDoc } from './code'
import { encodeGraphDoc, readGraphFromHash } from './share'
import { initialNodes, initialEdges } from './sample-data'
import type { MappingKind } from './types'

// 컨텍스트 메뉴 크기 — 화면 밖으로 나가지 않게 클램프할 때 쓴다
const MENU_W = 208
const MENU_H = 220

export default function Flow() {
  const nodeTypes = useMemo(() => ({ entity: EntityNode }), [])

  const paneRef = useRef<HTMLDivElement>(null)
  // 초기 그래프: URL 해시(#g=...)가 있으면 그것으로, 없으면 샘플 데이터
  const initial = useMemo(
    () => readGraphFromHash() ?? { nodes: initialNodes, edges: initialEdges },
    [],
  )
  const [nodes, setNodes, onNodesChange] = useNodesState<EntityNodeType>(
    initial.nodes,
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState<MappingEdge>(
    initial.edges,
  )
  const [newEdgeKind, setNewEdgeKind] = useState<MappingKind>('keep')
  // 클릭한 엣지의 컨텍스트 메뉴 위치(컨테이너 기준 좌표)
  const [menu, setMenu] = useState<{ edgeId: string; x: number; y: number } | null>(
    null,
  )
  // 호버 중인 필드 (계보 하이라이트의 시작점)
  const [hovered, setHovered] = useState<HoveredField | null>(null)

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
  // 필드 호버 시작/끝. 끝(leave)은 현재 호버 중인 필드와 일치할 때만 해제해
  // 행 사이 이동 시 깜빡임을 막는다.
  const onFieldHover = useCallback(
    (nodeId: string, path: string, entering: boolean) =>
      setHovered((cur) =>
        entering
          ? { nodeId, path }
          : cur && cur.nodeId === nodeId && cur.path === path
            ? null
            : cur,
      ),
    [],
  )

  // 호버한 필드에서 엣지를 따라 끝까지 도달하는 필드·엣지 집합 (lineage).
  // object 를 호버하면 그 하위 필드들을 모두 시드로 삼아 함께 강조한다.
  const highlight = useMemo(() => {
    if (!hovered) return null
    const node = nodes.find((n) => n.id === hovered.nodeId)
    const seeds = node
      ? hoverSeeds(hovered, node.data.fields, node.data.collapsed ?? [])
      : [hovered]
    if (!seeds) return null
    return computeHighlight(seeds, edges)
  }, [hovered, nodes, edges])

  const nodeCtx = useMemo(
    () => ({
      onToggleCollapse: toggleCollapse,
      onFieldHover,
      highlightedFields: highlight?.fields ?? EMPTY_HIGHLIGHT,
    }),
    [toggleCollapse, onFieldHover, highlight],
  )

  // 화면에 그릴 엣지 — 접힌 컨테이너로 롤업하고, 하이라이트된 엣지는 진하고 굵게.
  const displayEdges = useMemo(() => {
    const rerouted = rerouteCollapsedEdges(edges, nodes)
    if (!highlight) return rerouted
    return rerouted.map((e) =>
      highlight.edges.has(e.id)
        ? {
            ...e,
            style: {
              ...e.style,
              stroke: 'var(--foreground)',
              strokeWidth: 2.5,
            },
            zIndex: 1000,
          }
        : e,
    )
  }, [edges, nodes, highlight])

  // 그래프(테이블·엣지) 구조를 URL 해시에 동기화한다.
  // graphToDoc 은 위치·접힘을 빼므로, 드래그·접기로는 docJson 이 안 바뀌어
  // 해시가 갱신되지 않는다(구조가 바뀔 때만 갱신).
  const docJson = useMemo(
    () => JSON.stringify(graphToDoc(nodes, edges)),
    [nodes, edges],
  )
  useEffect(() => {
    const hash = encodeGraphDoc(docJson)
    if (hash !== window.location.hash) {
      window.history.replaceState(null, '', hash)
    }
  }, [docJson])

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
                엣지 클릭 시 메뉴 (라벨·타입·삭제)
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

      <SidePanel
        nodes={nodes}
        setNodes={setNodes}
        edges={edges}
        setEdges={setEdges}
      />
    </div>
    </EntityNodeContext.Provider>
  )
}
