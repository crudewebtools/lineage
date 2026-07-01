import {
  useCallback,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { createPortal } from 'react-dom'
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  KeyRound,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { FIELD_TYPES } from './code'
import {
  addChildTree,
  findTree,
  mapTree,
  newDraftField,
  removeTree,
  reorderTree,
  siblingKeys,
  type DraftField,
} from './field-draft'
import type { FieldType } from './types'

// 행에서 호출하는 편집 콜백 묶음 (트리 전체로 내려간다).
type RowHandlers = {
  onPatch: (k: string, p: Partial<DraftField>) => void
  onRemove: (k: string) => void
  onAddChild: (k: string) => void
  onToggleCollapse: (k: string) => void
}

// 재귀 필드 트리 에디터 (엔터티 fields / 프로세스 inputs·outputs 공용).
//  - nested=true  : object 타입에 하위 필드 추가·접기 가능 (엔터티)
//  - nested=false : 플랫 리스트 (프로세스 input/output — 핸들이 한 단계라 중첩 미지원)
// 순서 변경은 행 좌측 손잡이를 드래그 (같은 부모 안에서만 재배치).
// 펼친 object 는 펼친 모습 그대로 DragOverlay 로 떠서 끌린다.
export function FieldTreeEditor({
  title,
  addLabel,
  fields,
  setFields,
  nested = true,
}: {
  title: string
  addLabel: string
  fields: DraftField[]
  setFields: Dispatch<SetStateAction<DraftField[]>>
  nested?: boolean
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  // 드래그 중인 행의 _k 와 폭 — DragOverlay 복제본을 그릴 때 쓴다.
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeWidth, setActiveWidth] = useState<number | undefined>(undefined)

  // 손잡이를 약간(4px) 움직여야 드래그로 인식 — 클릭/포커스를 방해하지 않게.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  )

  // 충돌 후보를 "끌고 있는 항목의 형제 그룹"으로 제한한다.
  //  - 다른 그룹의 자식(예: 펼친 items 의 하위 필드)이 커서 아래 있어도 무시되고,
  //    형제 중 가장 가까운 대상으로 잡혀 재정렬이 자연스럽게 된다.
  //  - 포인터가 형제 위면 그 행을, 형제 자식 위 등 빈손이면 가장 가까운 형제 중심으로.
  const collisionDetection = useCallback<CollisionDetection>(
    (args) => {
      const sibs = siblingKeys(fields, String(args.active.id))
      const scoped = sibs
        ? {
            ...args,
            droppableContainers: args.droppableContainers.filter((d) =>
              sibs.has(String(d.id)),
            ),
          }
        : args
      const hits = pointerWithin(scoped)
      return hits.length ? hits : closestCenter(scoped)
    },
    [fields],
  )

  const handlers: RowHandlers = {
    onPatch: (k, p) => setFields((fs) => mapTree(fs, k, (f) => ({ ...f, ...p }))),
    onRemove: (k) => setFields((fs) => removeTree(fs, k)),
    onAddChild: (parentK) =>
      setFields((fs) => addChildTree(fs, parentK, newDraftField())),
    onToggleCollapse: (k) =>
      setCollapsed((cur) => {
        const next = new Set(cur)
        if (next.has(k)) next.delete(k)
        else next.add(k)
        return next
      }),
  }
  const addRoot = () => setFields((fs) => [...fs, newDraftField()])

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id))
    setActiveWidth(e.active.rect.current.initial?.width)
  }
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (over && active.id !== over.id)
      setFields((fs) => reorderTree(fs, String(active.id), String(over.id)))
    setActiveId(null)
  }
  const onDragCancel = () => setActiveId(null)

  const activeField = activeId ? findTree(fields, activeId) : null

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        <Button variant="ghost" size="xs" onClick={addRoot} title={addLabel}>
          <Plus />
          {addLabel}
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto rounded-md border border-border/60 p-1.5">
        {fields.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            비어 있음 · "{addLabel}"로 시작하세요
          </p>
        )}
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
        >
          <FieldRows
            fields={fields}
            depth={0}
            nested={nested}
            collapsed={collapsed}
            handlers={handlers}
          />
          {/* 끌리는 행(과 펼친 하위)의 복제본 — 커서를 따라 떠다닌다.
              dropAnimation=null: 놓는 순간 바로 사라진다 (실제 행은 이미 제자리로 이동).
              body 로 포탈: 다이얼로그의 translate transform 안에 있으면 fixed 기준이
              뷰포트가 아니라 다이얼로그가 돼 오버레이가 엉뚱한 위치에 뜬다. */}
          {createPortal(
            <DragOverlay dropAnimation={null}>
              {activeField ? (
                <div
                  className="rounded-md border border-border bg-background shadow-lg"
                  style={{ width: activeWidth }}
                >
                  <OverlayRows
                    fields={[activeField]}
                    depth={0}
                    nested={nested}
                    collapsed={collapsed}
                    handlers={handlers}
                  />
                </div>
              ) : null}
            </DragOverlay>,
            document.body,
          )}
        </DndContext>
      </div>
    </div>
  )
}

function FieldRows({
  fields,
  depth,
  nested,
  collapsed,
  handlers,
}: {
  fields: DraftField[]
  depth: number
  nested: boolean
  collapsed: Set<string>
  handlers: RowHandlers
}) {
  // 같은 부모 그룹은 하나의 SortableContext — 형제끼리만 재배치된다.
  return (
    <SortableContext
      items={fields.map((f) => f._k)}
      strategy={verticalListSortingStrategy}
    >
      {fields.map((f) => (
        <FieldRow
          key={f._k}
          field={f}
          depth={depth}
          nested={nested}
          collapsed={collapsed}
          handlers={handlers}
        />
      ))}
    </SortableContext>
  )
}

function FieldRow({
  field: f,
  depth,
  nested,
  collapsed,
  handlers,
}: {
  field: DraftField
  depth: number
  nested: boolean
  collapsed: Set<string>
  handlers: RowHandlers
}) {
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: f._k })

  const canNest = nested && f.type === 'object'
  const isCollapsed = collapsed.has(f._k)
  const showChildren = canNest && !isCollapsed

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      // 끌리는 동안 원래 자리는 흐린 자리표시자로 남겨 어디에 놓일지 보인다
      // (실제 모습은 위 DragOverlay 가 커서를 따라 보여준다).
      className={cn('flex flex-col gap-1', isDragging && 'opacity-40')}
    >
      <RowBar
        field={f}
        depth={depth}
        canNest={canNest}
        isCollapsed={isCollapsed}
        handlers={handlers}
        handleRef={setActivatorNodeRef}
        handleProps={{ ...attributes, ...listeners }}
      />
      {showChildren && (
        <FieldRows
          fields={f.children}
          depth={depth + 1}
          nested={nested}
          collapsed={collapsed}
          handlers={handlers}
        />
      )}
      {showChildren && f.children.length === 0 && (
        <p
          className="text-[10px] text-muted-foreground/70"
          style={{ paddingLeft: (depth + 1) * 16 + 18 }}
        >
          하위 필드 없음 · + 로 추가
        </p>
      )}
    </div>
  )
}

// DragOverlay 안에서 끌리는 서브트리를 정적으로(정렬 훅 없이) 그린다 — 행 모습은 RowBar 로 공유.
function OverlayRows({
  fields,
  depth,
  nested,
  collapsed,
  handlers,
}: {
  fields: DraftField[]
  depth: number
  nested: boolean
  collapsed: Set<string>
  handlers: RowHandlers
}) {
  return (
    <>
      {fields.map((f) => {
        const canNest = nested && f.type === 'object'
        const isCollapsed = collapsed.has(f._k)
        const showChildren = canNest && !isCollapsed
        return (
          <div key={f._k} className="flex flex-col gap-1">
            <RowBar
              field={f}
              depth={depth}
              canNest={canNest}
              isCollapsed={isCollapsed}
              handlers={handlers}
            />
            {showChildren && (
              <OverlayRows
                fields={f.children}
                depth={depth + 1}
                nested={nested}
                collapsed={collapsed}
                handlers={handlers}
              />
            )}
          </div>
        )
      })}
    </>
  )
}

// 한 행의 시각 요소 (손잡이·필드명·타입·플래그·액션). 정렬 행과 오버레이 복제본이 공유한다.
function RowBar({
  field: f,
  depth,
  canNest,
  isCollapsed,
  handlers: { onPatch, onRemove, onAddChild, onToggleCollapse },
  handleRef,
  handleProps,
}: {
  field: DraftField
  depth: number
  canNest: boolean
  isCollapsed: boolean
  handlers: RowHandlers
  handleRef?: (el: HTMLElement | null) => void
  handleProps?: Record<string, unknown>
}) {
  return (
    <div className="flex items-center gap-1" style={{ paddingLeft: depth * 16 }}>
      {/* 드래그 손잡이 — 같은 부모 안에서 순서 변경 */}
      <button
        type="button"
        ref={handleRef}
        title="드래그하여 순서 변경"
        className="cursor-grab p-0.5 text-muted-foreground/50 hover:text-foreground active:cursor-grabbing"
        {...handleProps}
      >
        <GripVertical className="size-3.5" />
      </button>

      {/* 접기 토글 (object & nested) — 자리 맞춤용 빈 칸 유지 */}
      {canNest ? (
        <button
          type="button"
          onClick={() => onToggleCollapse(f._k)}
          className="p-0.5 text-muted-foreground hover:text-foreground"
          title={isCollapsed ? '펼치기' : '접기'}
        >
          {isCollapsed ? (
            <ChevronRight className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
        </button>
      ) : (
        <span className="w-[18px] shrink-0" />
      )}

      <Input
        value={f.name}
        onChange={(e) => onPatch(f._k, { name: e.target.value })}
        placeholder="필드명"
        className="h-8 flex-1"
      />
      <select
        value={f.type}
        onChange={(e) => onPatch(f._k, { type: e.target.value as FieldType })}
        className="h-8 w-24 rounded-md border border-input bg-transparent px-1 text-xs"
      >
        {FIELD_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      <Toggle
        active={f.array}
        onClick={() => onPatch(f._k, { array: !f.array })}
        title="배열 (array)"
      >
        []
      </Toggle>
      <Toggle
        active={f.nullable}
        onClick={() => onPatch(f._k, { nullable: !f.nullable })}
        title="nullable (null 허용)"
      >
        ?
      </Toggle>
      <button
        type="button"
        title="primary key"
        onClick={() => onPatch(f._k, { pk: !f.pk })}
        className="p-1"
      >
        <KeyRound
          className={cn(
            'size-3.5',
            f.pk ? 'text-amber-500' : 'text-muted-foreground/40',
          )}
        />
      </button>

      {canNest && (
        <button
          type="button"
          title="하위 필드 추가"
          onClick={() => onAddChild(f._k)}
          className="p-0.5 text-muted-foreground/70 hover:text-foreground"
        >
          <Plus className="size-3.5" />
        </button>
      )}
      <button
        type="button"
        title="삭제"
        onClick={() => onRemove(f._k)}
        className="p-1 text-muted-foreground/60 hover:text-destructive"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  )
}

function Toggle({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean
  onClick: () => void
  title: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'px-1 font-mono text-xs',
        active ? 'text-foreground' : 'text-muted-foreground/40',
      )}
    >
      {children}
    </button>
  )
}
