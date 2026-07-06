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
import { EntityDialog, type FieldChanges } from './EntityDialog'
import { ProcessDialog } from './ProcessDialog'
import { uniqueId, nextEntityPos } from './entity-util'
import { NodeContext, EMPTY_HIGHLIGHT } from './node-context'
import { computeHighlight, hoverSeeds, type HoveredField } from './highlight'
import { SidePanel } from './SidePanel'
import { EdgeKindControl } from './EdgeKindControl'
import { NodeVisibilityPanel } from './NodeVisibilityPanel'
import { VariantControl } from './VariantControl'
import {
  assignSelfDiscs,
  collectDiscriminators,
  computeDimmed,
  discKey,
  variantColors,
} from './variant'
import { EdgeContextMenu } from './EdgeContextMenu'
import { edgeKindProps, type MappingEdge } from './edge-kind'
import { rerouteCollapsedEdges } from './collapse'
import type { AppNode } from './node-types'
import type { EntityData, MappingKind, ProcessData } from './types'

// 한 페이지의 그래프를 그린다. 페이지 전환은 부모(App)가 key={pageId} 리마운트로
// 처리한다 — 호버·변형 선택·메뉴 같은 페이지 종속 상태가 자연스럽게 초기화된다.
export default function Flow({
  initialNodes,
  initialEdges,
  onGraphChange,
}: {
  initialNodes: AppNode[]
  initialEdges: MappingEdge[]
  onGraphChange: (nodes: AppNode[], edges: MappingEdge[]) => void
}) {
  const nodeTypes = useMemo(
    () => ({ entity: EntityNode, process: ProcessNode }),
    [],
  )

  const paneRef = useRef<HTMLDivElement>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<MappingEdge>(
    initialEdges,
  )
  // 그래프가 바뀔 때마다 부모에 알린다 — 부모가 디바운스 자동저장을 담당.
  useEffect(() => onGraphChange(nodes, edges), [nodes, edges, onGraphChange])
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

  // 엣지 클릭/우클릭 → 컨텍스트 메뉴를 커서 위치에 연다.
  // 화면 밖 클램프·아래 공간 부족 시 위로 뒤집기는 메뉴가 실제 크기를 재서
  // 스스로 처리한다 (when 섹션 때문에 높이를 미리 알 수 없다).
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
    setMenu({
      edgeId: edge.id,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    })
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
    // 숨긴 노드의 엣지는 화면에서 사라지므로 계보 전파에서도 빼야 한다
    // (숨긴 A 를 거쳐 B.a → B.b 로 강조가 새어 나가지 않게).
    const hiddenIds = new Set(nodes.filter((n) => n.hidden).map((n) => n.id))
    const visibleEdges = edges.filter(
      (e) => !hiddenIds.has(e.source) && !hiddenIds.has(e.target),
    )
    return computeHighlight(seeds, visibleEdges)
  }, [hovered, nodes, edges])

  // 그래프 안의 discriminator 들과, 현재 선택으로 정해지는 활성 변형 값 집합.
  const discriminators = useMemo(() => collectDiscriminators(nodes), [nodes])
  // 변형 값 → 색 (필드 when 배지 · 셀렉터 공용). 값 순서로 안정 배정.
  const variantColorMap = useMemo(
    () => variantColors(discriminators),
    [discriminators],
  )
  // disc 키 → 현재 선택 값. 선택이 없으면 첫 enum 값이 기본.
  // 선택해 둔 값이 enum 에서 삭제됐으면(유령 선택) 첫 값으로 폴백한다 —
  // 편집·JSON 적용·가져오기 등 어디서 stale 이 생겼든 읽는 지점에서 걸러진다.
  const activeVariants = useMemo(() => {
    const m = new Map<string, string>()
    for (const d of discriminators) {
      const key = discKey(d.nodeId, d.path)
      const sel = variant[key]
      m.set(key, sel && d.values.includes(sel) ? sel : d.values[0])
    }
    return m
  }, [discriminators, variant])

  // 현재 변형에서 "없는" 필드·엣지 (흐리게 표시할 대상)
  const dimmed = useMemo(
    () => computeDimmed(nodes, edges, activeVariants),
    [nodes, edges, activeVariants],
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

  // 노드 id 의 필드 편집 결과(changes)에 맞춰 그 노드에 붙은 엣지를 정리한다.
  // 핸들에 개명을 반영한 뒤에도 리프 경로 집합에 없으면(삭제 또는 object 전환)
  // 무효한 매핑이므로 엣지를 제거하고, 있으면 핸들만 따라간다 — 무효 매핑이
  // 자동저장돼 다음 로드의 검증에서 페이지가 잠기는 일을 막는다.
  const reconcileEdges = useCallback(
    (id: string, changes: FieldChanges) => {
      const { renames, leafPaths } = changes
      setEdges((eds) =>
        eds.flatMap((e) => {
          let next = e
          if (e.source === id) {
            const p = renames.get(e.sourceHandle ?? '') ?? e.sourceHandle ?? ''
            if (!leafPaths.has(p)) return []
            if (p !== e.sourceHandle) next = { ...next, sourceHandle: p }
          }
          if (e.target === id) {
            const p = renames.get(e.targetHandle ?? '') ?? e.targetHandle ?? ''
            if (!leafPaths.has(p)) return []
            if (p !== e.targetHandle) next = { ...next, targetHandle: p }
          }
          return [next]
        }),
      )
    },
    [setEdges],
  )

  // 모달 저장 — 생성이면 새 노드, 수정이면 data 교체(접힘 상태는 보존).
  // setNodes 는 순수 updater 로만 호출하고(다른 setState 안에 중첩 금지 — StrictMode
  // 가 updater 를 두 번 호출해 중복 추가될 수 있다), 모달 닫기는 별도로 처리한다.
  // 필드가 개명됐으면(renames) 그 경로를 참조하는 곳을 모두 따라 갱신한다:
  // when.disc(전체 노드·엣지) · 엣지 핸들 · 접힘 상태 · 변형 선택 키.
  // 엣지 정리(reconcileEdges)는 개명이 없어도 실행한다 — 삭제·object 전환으로
  // 무효해진 매핑을 걸러내야 하기 때문.
  const saveEntity = useCallback(
    (data: EntityData, changes: FieldChanges) => {
      if (!entityDialog) return
      const { renames } = changes
      if (entityDialog.mode === 'new') {
        // 노드 id 는 여기서 만들어지므로, 모달이 "$self::" 로 담아둔
        // 자기 discriminator 참조를 실제 id 로 치환한다.
        setNodes((nds) => {
          const id = uniqueId(data.name, nds)
          return [
            ...nds,
            {
              id,
              type: 'entity',
              position: nextEntityPos(nds),
              data: { ...data, fields: assignSelfDiscs(data.fields, id) },
            },
          ]
        })
      } else {
        const id = entityDialog.id
        // when 은 자기 엔터티 안에서만 참조되고(엔터티 내부 변형), 다이얼로그의
        // 저장 변환(draftsToFields)이 when 을 최종 경로로 역번역·정리해 주므로
        // data.fields 는 이미 일관 상태다 — 여기서는 접힘 경로와 엣지 핸들만
        // 개명을 따라가면 된다.
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id === id && n.type === 'entity') {
              const collapsed = n.data.collapsed?.map(
                (p) => renames.get(p) ?? p,
              )
              return { ...n, data: { ...data, collapsed } }
            }
            return n
          }),
        )
        reconcileEdges(id, changes)
        if (renames.size) {
          // 좌상단 셀렉터 선택 상태의 disc 키도 따라 바꾼다
          setVariant((cur) => {
            const prefix = `${id}::`
            const out: Record<string, string> = {}
            for (const [k, v] of Object.entries(cur)) {
              const next = k.startsWith(prefix)
                ? renames.get(k.slice(prefix.length))
                : undefined
              out[next ? `${prefix}${next}` : k] = v
            }
            return out
          })
        }
      }
      setEntityDialog(null)
    },
    [entityDialog, setNodes, reconcileEdges],
  )

  // 노드 삭제 — 걸린 엣지도 함께 제거하고 열린 모달을 닫는다.
  const deleteNode = useCallback(
    (id: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== id))
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id))
      setEntityDialog(null)
      setProcessDialog(null)
    },
    [setNodes, setEdges],
  )

  // 프로세스 수정 모달 열기 (ProcessNode 헤더 ✏️)
  const onEditProcess = useCallback(
    (id: string) => setProcessDialog({ mode: 'edit', id }),
    [],
  )

  // 프로세스 저장 — 생성이면 새 노드, 수정이면 data 교체. (setNodes 는 순수 updater 로만)
  // 연결된 엣지는 항상 정리한다 — 개명된 핸들(in.<>/out.<>)은 따라가고,
  // 삭제·object 전환으로 무효해진 매핑은 제거.
  const saveProcess = useCallback(
    (data: ProcessData, changes: FieldChanges) => {
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
        setNodes((nds) =>
          nds.map((n) =>
            n.id === processDialog.id && n.type === 'process'
              ? { ...n, data }
              : n,
          ),
        )
        reconcileEdges(processDialog.id, changes)
      }
      setProcessDialog(null)
    },
    [processDialog, setNodes, reconcileEdges],
  )

  const nodeCtx = useMemo(
    () => ({
      onToggleCollapse: toggleCollapse,
      onFieldHover,
      onEditEntity,
      onEditProcess,
      // when 배지 클릭 → 그 변형으로 전환 (disc 키 = 셀렉터 키라 그대로 통한다)
      onSelectVariant,
      highlightedFields: highlight?.fields ?? EMPTY_HIGHLIGHT,
      dimmedFields: dimmed.fields,
      variantColors: variantColorMap,
    }),
    [
      toggleCollapse,
      onFieldHover,
      onEditEntity,
      onEditProcess,
      onSelectVariant,
      highlight,
      dimmed,
      variantColorMap,
    ],
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
        // 변형에 없는 엣지는 흐리게 + 라벨은 아예 숨기고, 클릭도 막는다
        // (흐린 엣지의 메뉴가 열리면 헷갈린다 — pointerEvents 차단 + 클릭 히트박스 제거).
        return {
          ...e,
          label: undefined,
          selectable: false,
          interactionWidth: 0,
          style: { ...e.style, opacity: 0.12, pointerEvents: 'none' as const },
          zIndex: 0,
        }
      return e
    })
  }, [edges, nodes, highlight, dimmed])

  return (
    <NodeContext.Provider value={nodeCtx}>
    <div className="flex h-full min-w-0 flex-1">
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
              selections={activeVariants}
              colors={variantColorMap}
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
          nodeId={entityDialog.mode === 'edit' ? entityDialog.id : null}
          onSave={saveEntity}
          onDelete={
            entityDialog.mode === 'edit'
              ? () => deleteNode(entityDialog.id)
              : undefined
          }
          onClose={() => setEntityDialog(null)}
        />
      )}

      {processDialog && (
        <ProcessDialog
          key={processDialog.mode === 'edit' ? processDialog.id : 'new'}
          isNew={processDialog.mode === 'new'}
          initial={processInitial}
          onSave={saveProcess}
          onDelete={
            processDialog.mode === 'edit'
              ? () => deleteNode(processDialog.id)
              : undefined
          }
          onClose={() => setProcessDialog(null)}
        />
      )}
    </div>
    </NodeContext.Provider>
  )
}
