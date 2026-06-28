import { useContext, useEffect, useMemo } from 'react'
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { ChevronDown, ChevronRight, GitBranch, KeyRound, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { NodeContext } from './node-context'
import { fieldKey } from './highlight'
import { KIND_META } from './entity-kind'
import type { EntityNodeType } from './node-types'
import type { Field } from './types'

// 모든 필드 행이 양쪽에 핸들을 가진다(좌=target, 우=source).
// overflow-hidden 부모에 가려지지 않도록 X 이동 없이 모서리 안쪽에 붙인다.
const handleStyle = {
  width: 8,
  height: 8,
  background: 'var(--muted-foreground)',
  border: '2px solid var(--background)',
  transform: 'translateY(-50%)',
}

// 접힌 컨테이너의 핸들 — 롤업 엣지가 붙는 자리. 일반 핸들과 구분되게 흐리게.
const collapsedHandleStyle = { ...handleStyle, background: 'var(--border)' }

// 안 보이는 핸들 — DOM 에는 남겨 측정은 유지하되(접기/펴기 시 #008 방지) 시각·연결만 끈다.
const hiddenHandleStyle = {
  ...handleStyle,
  opacity: 0,
  pointerEvents: 'none' as const,
}

function FieldRow({
  field,
  depth,
  path,
  nodeId,
  collapsed,
  hidden = false,
}: {
  field: Field
  depth: number
  /** 필드 경로 — 핸들 id 로 쓰여 필드 단위 연결을 가능하게 한다 */
  path: string
  nodeId: string
  /** 이 노드에서 접힌 object 경로 집합 */
  collapsed: Set<string>
  /** 조상이 접혀 있어 이 행이 화면에서 접혔는지 */
  hidden?: boolean
}) {
  const { onToggleCollapse, onFieldHover, highlightedFields, dimmedFields } =
    useContext(NodeContext)
  const children = field.children ?? []
  const isObject = field.type === 'object'
  const collapsible = isObject && children.length > 0
  const isCollapsed = collapsible && collapsed.has(path)
  const isHighlighted = highlightedFields.has(fieldKey(nodeId, path))
  // 현재 변형에서 "없는" 필드 → 흐리게. discriminator 는 분기 기준이라 항상 또렷.
  const isDimmed = dimmedFields.has(fieldKey(nodeId, path))

  // 핸들은 늘 mount 한다 → 접기/펴기로 추가·삭제되지 않아 React Flow #008 경고를 피한다.
  // 보임/연결 여부만 제어한다:
  //  - 리프(보임)   : 일반 핸들, 연결 가능
  //  - object 펼침  : 투명 핸들(컨테이너 직접 연결 금지)
  //  - object 접힘  : 흐린 핸들(롤업 엣지가 붙음), 비연결
  //  - 접혀 숨은 행 : 투명 핸들(측정만)
  const connectable = !isObject && !hidden
  const handleVisible = hidden ? false : isObject ? isCollapsed : true
  const hStyle = !handleVisible
    ? hiddenHandleStyle
    : isCollapsed
      ? collapsedHandleStyle
      : handleStyle

  return (
    <>
      <div
        className={cn(
          'relative flex items-center gap-2 text-xs',
          hidden
            ? 'h-0 overflow-hidden border-0 p-0 opacity-0'
            : 'border-t border-border/60 py-1.5 pr-3 hover:bg-accent/40',
          collapsible && !hidden && 'cursor-pointer select-none',
          !hidden && isDimmed && 'opacity-35',
        )}
        style={{ paddingLeft: hidden ? 0 : 12 + depth * 16 }}
        onClick={
          collapsible && !hidden
            ? (e) => {
                e.stopPropagation()
                onToggleCollapse(nodeId, path)
              }
            : undefined
        }
        onMouseEnter={
          hidden ? undefined : () => onFieldHover(nodeId, path, true)
        }
        onMouseLeave={
          hidden ? undefined : () => onFieldHover(nodeId, path, false)
        }
        aria-hidden={hidden || undefined}
      >
        {/* 도착 핸들 (왼쪽) */}
        <Handle
          type="target"
          position={Position.Left}
          id={path}
          isConnectable={connectable}
          style={hStyle}
        />

        {field.pk && <KeyRound className="size-3 shrink-0 text-amber-500" />}
        {field.discriminator && (
          <GitBranch className="size-3 shrink-0 text-sky-500" />
        )}
        <span
          className={cn(
            'font-medium',
            isHighlighted && 'font-bold text-foreground',
          )}
        >
          {field.name}
        </span>
        {collapsible &&
          (isCollapsed ? (
            <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
          ))}
        {/* 조건부 필드 — 어떤 변형 값에서만 존재하는지 배지로 표시 (왜 흐려지는지 보임) */}
        {field.when?.length ? (
          <Badge
            variant="outline"
            className="h-4 shrink-0 border-sky-500/40 px-1 text-[9px] font-normal text-sky-600"
          >
            {field.when.join('·')}
          </Badge>
        ) : null}
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
          {field.type}
          {field.array ? '[]' : ''}
          {field.nullable ? '?' : ''}
        </span>

        {/* 출발 핸들 (오른쪽) */}
        <Handle
          type="source"
          position={Position.Right}
          id={path}
          isConnectable={connectable}
          style={hStyle}
        />
      </div>

      {/* 하위 필드는 항상 렌더하되, 접혀 있으면 hidden 으로 화면에서만 접는다
          (핸들을 unmount 하지 않아야 펼칠 때 엣지가 끊기지 않는다) */}
      {children.map((child) => (
        <FieldRow
          key={child.name}
          field={child}
          depth={depth + 1}
          path={`${path}.${child.name}`}
          nodeId={nodeId}
          collapsed={collapsed}
          hidden={hidden || isCollapsed}
        />
      ))}
    </>
  )
}

export function EntityNode({ id, data }: NodeProps<EntityNodeType>) {
  const { onEditEntity } = useContext(NodeContext)
  const meta = KIND_META[data.kind]
  const Icon = meta.icon
  const collapsed = useMemo(() => new Set(data.collapsed ?? []), [data.collapsed])

  // 접기/펴기로 핸들 위치가 바뀌면 React Flow 에 재측정을 알려 엣지 끝점을 갱신
  const updateNodeInternals = useUpdateNodeInternals()
  useEffect(() => {
    updateNodeInternals(id)
  }, [id, data.collapsed, updateNodeInternals])

  return (
    <div className="min-w-[220px] overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-md">
      {/* 헤더: 종류 아이콘 + 엔티티 이름 + 종류 라벨 */}
      <div className="flex items-center gap-2 bg-muted/60 px-3 py-2">
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="text-sm font-semibold">{data.name}</span>
        <Badge
          variant="outline"
          className="ml-auto bg-background/60 text-[10px] font-normal"
        >
          {meta.label}
        </Badge>
        <button
          type="button"
          className="nodrag rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
          title="엔터티 수정"
          onClick={(e) => {
            e.stopPropagation()
            onEditEntity(id)
          }}
        >
          <Pencil className="size-3.5" />
        </button>
      </div>

      {/* 필드 목록 */}
      <div className="py-0.5">
        {data.fields.map((field) => (
          <FieldRow
            key={field.name}
            field={field}
            depth={0}
            path={field.name}
            nodeId={id}
            collapsed={collapsed}
          />
        ))}
      </div>
    </div>
  )
}
