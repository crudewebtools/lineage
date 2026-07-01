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
  Panel,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
  type OnConnect,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EntityNode } from './EntityNode'
import { ProcessNode } from './ProcessNode'
import { EntityDialog } from './EntityDialog'
import { ProcessDialog } from './ProcessDialog'
import { uniqueId, nextEntityPos } from './entity-util'
import { NodeContext, EMPTY_HIGHLIGHT } from './node-context'
import { computeHighlight, hoverSeeds, type HoveredField } from './highlight'
import { SidePanel } from './SidePanel'
import { EdgeKindControl } from './EdgeKindControl'
import { NodeVisibilityPanel } from './NodeVisibilityPanel'
import { VariantControl } from './VariantControl'
import { collectDiscriminators, computeDimmed, discKey } from './variant'
import { EdgeContextMenu } from './EdgeContextMenu'
import { edgeKindProps, type MappingEdge } from './edge-kind'
import { rerouteCollapsedEdges } from './collapse'
import { readGraphFromUrl, clearShareParam } from './share'
import { initialNodes, initialEdges } from './sample-data'
import type { AppNode } from './node-types'
import type { EntityData, MappingKind, ProcessData } from './types'

// 컨텍스트 메뉴 크기 — 화면 밖으로 나가지 않게 클램프할 때 쓴다
const MENU_W = 208
const MENU_H = 220

export default function Flow() {
  const nodeTypes = useMemo(
    () => ({ entity: EntityNode, process: ProcessNode }),
    [],
  )

  const paneRef = useRef<HTMLDivElement>(null)
  // 초기 그래프: 공유 링크(?g=...)가 있으면 그것으로, 없으면 샘플 데이터.
  const initial = useMemo(
    () => readGraphFromUrl() ?? { nodes: initialNodes, edges: initialEdges },
    [],
  )
  // 반영했으면 주소에서 공유 쿼리를 지운다 — 이후 편집으로는 URL 이 바뀌지 않는다.
  useEffect(() => clearShareParam(), [])
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>(
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
  // 엣지 위에서 좌클릭을 누른 지점 (드래그/클릭 구분용)
  const edgeDownPos = useRef<{ x: number; y: number } | null>(null)
  // 변형 선택 — discriminator 키 → 고른 값. 비어 있으면 첫 enum 값을 기본으로 본다.
  const [variant, setVariant] = useState<Record<string, string>>({})
  // 엔터티 생성/수정 모달 상태 (null = 닫힘)
  const [entityDialog, setEntityDialog] = useState<
    { mode: 'new' } | { mode: 'edit'; id: string } | null
  >(null)
  // 프로세스 생성/수정 모달 상태 (null = 닫힘)
  const [processDialog, setProcessDialog] = useState<
    { mode: 'new' } | { mode: 'edit'; id: string } | null
  >(null)

  // 새 연결은 현재 선택된 종류(유지/가공)로 생성
  const onConnect: OnConnect = useCallback(
    (params) =>
      setEdges((eds) => addEdge({ ...params, ...edgeKindProps(newEdgeKind) }, eds)),
    [setEdges, newEdgeKind],
  )

  // 엣지 위에서 시작한 좌클릭 드래그도 화면 패닝이 되도록 한다.
  // React Flow 는 모든 엣지 <g> 에 'nopan' 을 붙여 d3-zoom 패닝을 막는데,
  // mousedown 캡처 단계에서 그 클래스를 떼어내면(다음 렌더에서 자동 복구)
  // d3-zoom 필터가 패닝을 허용한다. 캡처 단계라 d3-zoom(버블 리스너)의 필터보다
  // 먼저 실행돼 같은 mousedown 에 반영된다.
  useEffect(() => {
    const pane = paneRef.current
    if (!pane) return
    const onDown = (e: globalThis.MouseEvent) => {
      if (e.button !== 0) return
      const g = (e.target as Element | null)?.closest?.('.react-flow__edge')
      if (g) {
        g.classList.remove('nopan')
        edgeDownPos.current = { x: e.clientX, y: e.clientY }
      } else {
        edgeDownPos.current = null
      }
    }
    pane.addEventListener('mousedown', onDown, true)
    return () => pane.removeEventListener('mousedown', onDown, true)
  }, [])

  // 엣지 클릭/우클릭 → 컨텍스트 메뉴를 커서 위치에 연다 (컨테이너 안으로 클램프)
  const openMenu = useCallback((event: MouseEvent, edge: MappingEdge) => {
    // 좌클릭이 드래그(패닝)였으면 메뉴를 열지 않는다 — 임계값 5px
    if (event.type === 'click' && edgeDownPos.current) {
      const dx = event.clientX - edgeDownPos.current.x
      const dy = event.clientY - edgeDownPos.current.y
      if (Math.hypot(dx, dy) > 5) return
    }
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

  // 노드 표시/숨김 토글 — hidden 플래그만 뒤집는다(데이터·위치 보존).
  // 숨긴 노드에 걸린 엣지는 displayEdges 에서 함께 걸러낸다.
  const toggleNodeHidden = useCallback(
    (id: string) =>
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, hidden: !n.hidden } : n)),
      ),
    [setNodes],
  )
  const showAllNodes = useCallback(
    () =>
      setNodes((nds) =>
        nds.map((n) => (n.hidden ? { ...n, hidden: false } : n)),
      ),
    [setNodes],
  )

  // object 필드 접기/펴기 — 해당 노드 data.collapsed 토글
  const toggleCollapse = useCallback(
    (nodeId: string, path: string) =>
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId || n.type !== 'entity') return n
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
    const seeds =
      node && node.type === 'entity'
        ? hoverSeeds(hovered, node.data.fields, node.data.collapsed ?? [])
        : [hovered]
    if (!seeds) return null
    return computeHighlight(seeds, edges)
  }, [hovered, nodes, edges])

  // 그래프 안의 discriminator 들과, 현재 선택으로 정해지는 활성 변형 값 집합.
  const discriminators = useMemo(() => collectDiscriminators(nodes), [nodes])
  const activeValues = useMemo(() => {
    const s = new Set<string>()
    for (const d of discriminators)
      s.add(variant[discKey(d.nodeId, d.path)] ?? d.values[0])
    return s
  }, [discriminators, variant])

  // 현재 변형에서 "없는" 필드·엣지 (흐리게 표시할 대상)
  const dimmed = useMemo(
    () => computeDimmed(nodes, edges, activeValues),
    [nodes, edges, activeValues],
  )

  const onSelectVariant = useCallback(
    (key: string, value: string) =>
      setVariant((cur) => ({ ...cur, [key]: value })),
    [],
  )

  // 엔터티 수정 모달 열기 (EntityNode 헤더 ✏️)
  const onEditEntity = useCallback(
    (id: string) => setEntityDialog({ mode: 'edit', id }),
    [],
  )

  // 모달 저장 — 생성이면 새 노드, 수정이면 data 교체(접힘 상태는 보존).
  // setNodes 는 순수 updater 로만 호출하고(다른 setState 안에 중첩 금지 — StrictMode
  // 가 updater 를 두 번 호출해 중복 추가될 수 있다), 모달 닫기는 별도로 처리한다.
  const saveEntity = useCallback(
    (data: EntityData) => {
      if (!entityDialog) return
      if (entityDialog.mode === 'new') {
        setNodes((nds) => [
          ...nds,
          {
            id: uniqueId(data.name, nds),
            type: 'entity',
            position: nextEntityPos(nds),
            data,
          },
        ])
      } else {
        const id = entityDialog.id
        setNodes((nds) =>
          nds.map((n) =>
            n.id === id && n.type === 'entity'
              ? { ...n, data: { ...data, collapsed: n.data.collapsed } }
              : n,
          ),
        )
      }
      setEntityDialog(null)
    },
    [entityDialog, setNodes],
  )

  // 프로세스 수정 모달 열기 (ProcessNode 헤더 ✏️)
  const onEditProcess = useCallback(
    (id: string) => setProcessDialog({ mode: 'edit', id }),
    [],
  )

  // 프로세스 저장 — 생성이면 새 노드, 수정이면 data 교체. (setNodes 는 순수 updater 로만)
  const saveProcess = useCallback(
    (data: ProcessData) => {
      if (!processDialog) return
      if (processDialog.mode === 'new') {
        setNodes((nds) => [
          ...nds,
          {
            id: uniqueId(data.name, nds),
            type: 'process',
            position: nextEntityPos(nds),
            data,
          },
        ])
      } else {
        const id = processDialog.id
        setNodes((nds) =>
          nds.map((n) =>
            n.id === id && n.type === 'process' ? { ...n, data } : n,
          ),
        )
      }
      setProcessDialog(null)
    },
    [processDialog, setNodes],
  )

  const nodeCtx = useMemo(
    () => ({
      onToggleCollapse: toggleCollapse,
      onFieldHover,
      onEditEntity,
      onEditProcess,
      highlightedFields: highlight?.fields ?? EMPTY_HIGHLIGHT,
      dimmedFields: dimmed.fields,
    }),
    [toggleCollapse, onFieldHover, onEditEntity, onEditProcess, highlight, dimmed],
  )

  // 수정 모달에 넘길 초기 데이터 (생성이면 null)
  const editEntityNode =
    entityDialog?.mode === 'edit'
      ? nodes.find((n) => n.id === entityDialog.id)
      : undefined
  const entityInitial =
    editEntityNode && editEntityNode.type === 'entity'
      ? editEntityNode.data
      : null

  const editProcessNode =
    processDialog?.mode === 'edit'
      ? nodes.find((n) => n.id === processDialog.id)
      : undefined
  const processInitial =
    editProcessNode && editProcessNode.type === 'process'
      ? editProcessNode.data
      : null

  // 화면에 그릴 엣지 — 접힌 컨테이너로 롤업하고, 하이라이트는 진하게, 변형에 없는 엣지는 흐리게.
  // 우선순위: 하이라이트(호버) > dim(변형). 호버한 엣지는 dim 이어도 또렷이 보인다.
  const displayEdges = useMemo(() => {
    const hiddenIds = new Set(nodes.filter((n) => n.hidden).map((n) => n.id))
    const rerouted = rerouteCollapsedEdges(edges, nodes).filter(
      (e) => !hiddenIds.has(e.source) && !hiddenIds.has(e.target),
    )
    return rerouted.map((e) => {
      if (highlight?.edges.has(e.id))
        return {
          ...e,
          style: { ...e.style, stroke: 'var(--foreground)', strokeWidth: 2.5 },
          zIndex: 1000,
        }
      if (dimmed.edges.has(e.id))
        return { ...e, style: { ...e.style, opacity: 0.12 }, zIndex: 0 }
      return e
    })
  }, [edges, nodes, highlight, dimmed])

  return (
    <NodeContext.Provider value={nodeCtx}>
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
          <Panel position="top-left">
            <VariantControl
              discriminators={discriminators}
              selections={variant}
              onChange={onSelectVariant}
            />
          </Panel>
          <Panel position="top-right">
            <NodeVisibilityPanel
              nodes={nodes}
              onToggle={toggleNodeHidden}
              onShowAll={showAllNodes}
            />
          </Panel>
          <Panel position="bottom-right">
            <div className="flex flex-col items-end gap-2">
              <EdgeKindControl value={newEdgeKind} onChange={setNewEdgeKind} />
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  className="gap-1 shadow-md"
                  onClick={() => setEntityDialog({ mode: 'new' })}
                >
                  <Plus className="size-4" />
                  엔터티
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-1 border border-dashed border-border shadow-md"
                  onClick={() => setProcessDialog({ mode: 'new' })}
                >
                  <Plus className="size-4" />
                  프로세스
                </Button>
              </div>
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

      {entityDialog && (
        <EntityDialog
          key={entityDialog.mode === 'edit' ? entityDialog.id : 'new'}
          isNew={entityDialog.mode === 'new'}
          initial={entityInitial}
          onSave={saveEntity}
          onClose={() => setEntityDialog(null)}
        />
      )}

      {processDialog && (
        <ProcessDialog
          key={processDialog.mode === 'edit' ? processDialog.id : 'new'}
          isNew={processDialog.mode === 'new'}
          initial={processInitial}
          onSave={saveProcess}
          onClose={() => setProcessDialog(null)}
        />
      )}
    </div>
    </NodeContext.Provider>
  )
}
