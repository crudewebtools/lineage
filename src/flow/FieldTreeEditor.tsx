import { useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  KeyRound,
  Plus,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { FIELD_TYPES } from './code'
import {
  addChildTree,
  mapTree,
  moveTree,
  newDraftField,
  removeTree,
  type DraftField,
} from './field-draft'
import type { FieldType } from './types'

// 재귀 필드 트리 에디터 (엔터티 fields / 프로세스 inputs·outputs 공용).
//  - nested=true  : object 타입에 하위 필드 추가·접기 가능 (엔터티)
//  - nested=false : 플랫 리스트 (프로세스 input/output — 핸들이 한 단계라 중첩 미지원)
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

  const patch = (k: string, p: Partial<DraftField>) =>
    setFields((fs) => mapTree(fs, k, (f) => ({ ...f, ...p })))
  const remove = (k: string) => setFields((fs) => removeTree(fs, k))
  const addChild = (parentK: string) =>
    setFields((fs) => addChildTree(fs, parentK, newDraftField()))
  const addRoot = () => setFields((fs) => [...fs, newDraftField()])
  const move = (k: string, dir: -1 | 1) =>
    setFields((fs) => moveTree(fs, k, dir))
  const toggleCollapse = (k: string) =>
    setCollapsed((cur) => {
      const next = new Set(cur)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })

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
        <FieldRows
          fields={fields}
          depth={0}
          nested={nested}
          collapsed={collapsed}
          onPatch={patch}
          onRemove={remove}
          onAddChild={addChild}
          onMove={move}
          onToggleCollapse={toggleCollapse}
        />
      </div>
    </div>
  )
}

function FieldRows({
  fields,
  depth,
  nested,
  collapsed,
  onPatch,
  onRemove,
  onAddChild,
  onMove,
  onToggleCollapse,
}: {
  fields: DraftField[]
  depth: number
  nested: boolean
  collapsed: Set<string>
  onPatch: (k: string, p: Partial<DraftField>) => void
  onRemove: (k: string) => void
  onAddChild: (k: string) => void
  onMove: (k: string, dir: -1 | 1) => void
  onToggleCollapse: (k: string) => void
}) {
  return (
    <>
      {fields.map((f, i) => {
        const canNest = nested && f.type === 'object'
        const isCollapsed = collapsed.has(f._k)
        const showChildren = canNest && !isCollapsed
        return (
          <div key={f._k} className="flex flex-col gap-1">
            <div
              className="flex items-center gap-1"
              style={{ paddingLeft: depth * 16 }}
            >
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
                onChange={(e) =>
                  onPatch(f._k, { type: e.target.value as FieldType })
                }
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

              {/* 순서 변경 (형제 안에서 위/아래) */}
              <button
                type="button"
                title="위로"
                disabled={i === 0}
                onClick={() => onMove(f._k, -1)}
                className="p-0.5 text-muted-foreground/60 hover:text-foreground disabled:opacity-25 disabled:hover:text-muted-foreground/60"
              >
                <ArrowUp className="size-3.5" />
              </button>
              <button
                type="button"
                title="아래로"
                disabled={i === fields.length - 1}
                onClick={() => onMove(f._k, 1)}
                className="p-0.5 text-muted-foreground/60 hover:text-foreground disabled:opacity-25 disabled:hover:text-muted-foreground/60"
              >
                <ArrowDown className="size-3.5" />
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

            {showChildren && (
              <FieldRows
                fields={f.children}
                depth={depth + 1}
                nested={nested}
                collapsed={collapsed}
                onPatch={onPatch}
                onRemove={onRemove}
                onAddChild={onAddChild}
                onMove={onMove}
                onToggleCollapse={onToggleCollapse}
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
      })}
    </>
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
