import { useState, type ReactNode } from 'react'
import { GitBranch } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { KIND_META } from './entity-kind'
import { KINDS } from './code'
import { FieldTreeEditor } from './FieldTreeEditor'
import { anyVariant, toDraft, toField, validate } from './field-draft'
import type { EntityData, EntityKind } from './types'

export function EntityDialog({
  isNew,
  initial,
  onSave,
  onClose,
}: {
  isNew: boolean
  initial: EntityData | null
  onSave: (data: EntityData) => void
  onClose: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [kind, setKind] = useState<EntityKind>(initial?.kind ?? 'etc')
  const [fields, setFields] = useState(() => toDraft(initial?.fields ?? []))
  const [error, setError] = useState<string | null>(null)

  const handleSave = () => {
    const nm = name.trim()
    if (!nm) return setError('엔터티 이름을 입력하세요')
    const e = validate(fields, '최상위')
    if (e) return setError(e)
    onSave({ name: nm, kind, fields: fields.map(toField) })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isNew ? '엔터티 생성' : '엔터티 수정'}</DialogTitle>
          <DialogDescription>
            이름·종류와 필드를 구성합니다. object 타입은 내부에 하위 필드를 추가할
            수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-3">
          <Labeled label="이름" className="min-w-[180px] flex-1">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: OrderEvent"
              className="h-9"
              autoFocus
            />
          </Labeled>
          <Labeled label="종류">
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
        </div>

        <FieldTreeEditor
          title="필드"
          addLabel="필드 추가"
          fields={fields}
          setFields={setFields}
        />

        {anyVariant(fields) && (
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            <GitBranch className="mr-1 inline size-3 text-sky-500" />
            변형(discriminator·when) 설정이 있는 필드는 그대로 보존됩니다. 변경은
            오른쪽 코드 패널(JSON)에서.
          </p>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            취소
          </Button>
          <Button size="sm" onClick={handleSave}>
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Labeled({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <label className={cn('flex flex-col gap-1', className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
