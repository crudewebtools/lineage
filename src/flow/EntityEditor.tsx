import {
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { KeyRound, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { KIND_META } from './entity-kind'
import type { EntityNodeType } from './EntityNode'
import type { EntityData, EntityKind, Field, FieldType } from './types'

const KINDS: EntityKind[] = ['event', 'api', 'db', 'etc']
const TYPES: FieldType[] = [
  'uuid',
  'string',
  'number',
  'boolean',
  'timestamp',
  'object',
  'json',
]

type Props = {
  nodes: EntityNodeType[]
  setNodes: Dispatch<SetStateAction<EntityNodeType[]>>
}

// null = 목록, 'new' = 추가 폼, string = 해당 id 수정 폼
type Editing = string | 'new' | null

export function EntityEditor({ nodes, setNodes }: Props) {
  const [editing, setEditing] = useState<Editing>(null)

  if (editing === null) {
    return (
      <EntityList
        nodes={nodes}
        onAdd={() => setEditing('new')}
        onEdit={setEditing}
      />
    )
  }

  const initial =
    editing === 'new' ? null : (nodes.find((n) => n.id === editing)?.data ?? null)

  return (
    <EntityForm
      key={editing}
      initial={initial}
      onCancel={() => setEditing(null)}
      onSave={(data) => {
        if (editing === 'new') {
          const id = uniqueId(data.name, nodes)
          setNodes((nds) => [
            ...nds,
            { id, type: 'entity', position: nextPos(nds), data },
          ])
        } else {
          setNodes((nds) =>
            nds.map((n) =>
              n.id === editing
                ? { ...n, data: { ...data, collapsed: n.data.collapsed } }
                : n,
            ),
          )
        }
        setEditing(null)
      }}
    />
  )
}

function EntityList({
  nodes,
  onAdd,
  onEdit,
}: {
  nodes: EntityNodeType[]
  onAdd: () => void
  onEdit: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-2 p-2">
      <Button size="sm" className="gap-1" onClick={onAdd}>
        <Plus className="size-4" />
        엔터티 추가
      </Button>
      <div className="flex flex-col gap-0.5">
        {nodes.map((n) => {
          const Icon = KIND_META[n.data.kind].icon
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => onEdit(n.id)}
              className="flex items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-accent"
            >
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm font-medium">{n.data.name}</span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                {n.data.fields.length} fields
              </span>
            </button>
          )
        })}
        {nodes.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            엔터티가 없습니다
          </p>
        )}
      </div>
    </div>
  )
}

type FieldDraft = {
  _k: number
  name: string
  type: FieldType
  array: boolean
  nullable: boolean
  pk: boolean
  children?: Field[] // 중첩 필드는 보존만 (폼에서 편집하지 않음)
}

function EntityForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: EntityData | null
  onSave: (data: EntityData) => void
  onCancel: () => void
}) {
  const nextKey = useRef(0)
  const [name, setName] = useState(initial?.name ?? '')
  const [kind, setKind] = useState<EntityKind>(initial?.kind ?? 'etc')
  const [fields, setFields] = useState<FieldDraft[]>(() =>
    (initial?.fields ?? [{ name: '', type: 'string' as FieldType }]).map((f) => ({
      _k: nextKey.current++,
      name: f.name,
      type: f.type,
      array: Boolean((f as Field).array),
      nullable: Boolean((f as Field).nullable),
      pk: Boolean((f as Field).pk),
      children: (f as Field).children,
    })),
  )
  const [error, setError] = useState<string | null>(null)

  const patch = (k: number, p: Partial<FieldDraft>) =>
    setFields((fs) => fs.map((f) => (f._k === k ? { ...f, ...p } : f)))
  const remove = (k: number) =>
    setFields((fs) => fs.filter((f) => f._k !== k))
  const add = () =>
    setFields((fs) => [
      ...fs,
      {
        _k: nextKey.current++,
        name: '',
        type: 'string',
        array: false,
        nullable: false,
        pk: false,
      },
    ])

  const handleSave = () => {
    const nm = name.trim()
    if (!nm) return setError('엔터티 이름을 입력하세요')
    const names = fields.map((f) => f.name.trim())
    if (names.some((n) => !n)) return setError('필드명을 모두 입력하세요')
    if (new Set(names).size !== names.length)
      return setError('필드명이 중복됩니다')
    onSave({ name: nm, kind, fields: fields.map(toField) })
  }

  const hasNested = fields.some((f) => f.children?.length)

  return (
    <div className="flex flex-col gap-3 p-3">
      <Labeled label="이름">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: OrderEvent"
          className="h-9"
        />
      </Labeled>

      <Labeled label="타입">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as EntityKind)}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_META[k].label}
            </option>
          ))}
        </select>
      </Labeled>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">필드</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-1.5 text-xs"
            onClick={add}
          >
            <Plus className="size-3" />
            추가
          </Button>
        </div>
        {fields.map((f) => (
          <div key={f._k} className="flex items-center gap-1">
            <Input
              value={f.name}
              onChange={(e) => patch(f._k, { name: e.target.value })}
              placeholder="필드명"
              className="h-8 flex-1"
            />
            <select
              value={f.type}
              onChange={(e) => patch(f._k, { type: e.target.value as FieldType })}
              className="h-8 w-28 rounded-md border border-input bg-transparent px-1 text-xs"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button
              type="button"
              title="배열 (array)"
              onClick={() => patch(f._k, { array: !f.array })}
              className={cn(
                'px-1 font-mono text-xs',
                f.array ? 'text-foreground' : 'text-muted-foreground/40',
              )}
            >
              []
            </button>
            <button
              type="button"
              title="nullable (null 허용)"
              onClick={() => patch(f._k, { nullable: !f.nullable })}
              className={cn(
                'px-1 font-mono text-xs',
                f.nullable ? 'text-foreground' : 'text-muted-foreground/40',
              )}
            >
              ?
            </button>
            <button
              type="button"
              title="primary key"
              onClick={() => patch(f._k, { pk: !f.pk })}
              className="p-1"
            >
              <KeyRound
                className={cn(
                  'size-3.5',
                  f.pk ? 'text-amber-500' : 'text-muted-foreground/40',
                )}
              />
            </button>
            <button
              type="button"
              title="삭제"
              onClick={() => remove(f._k)}
              className="p-1 text-muted-foreground/60 hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2 pt-1">
        <Button size="sm" className="flex-1" onClick={handleSave}>
          저장
        </Button>
        <Button size="sm" variant="outline" className="flex-1" onClick={onCancel}>
          취소
        </Button>
      </div>

      {hasNested && (
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          * 이 엔터티의 중첩 필드는 보존됩니다. 중첩 편집은 추후 코드 모드에서
          지원됩니다.
        </p>
      )}
    </div>
  )
}

function Labeled({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

function toField(d: FieldDraft): Field {
  const f: Field = { name: d.name.trim(), type: d.type }
  if (d.array) f.array = true
  if (d.nullable) f.nullable = true
  if (d.pk) f.pk = true
  if (d.children && d.children.length) f.children = d.children
  return f
}

function uniqueId(name: string, nodes: EntityNodeType[]): string {
  const base =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '') || 'entity'
  const ids = new Set(nodes.map((n) => n.id))
  if (!ids.has(base)) return base
  let i = 2
  while (ids.has(`${base}_${i}`)) i++
  return `${base}_${i}`
}

function nextPos(nodes: EntityNodeType[]) {
  return { x: 320, y: 40 + (nodes.length % 6) * 70 }
}
