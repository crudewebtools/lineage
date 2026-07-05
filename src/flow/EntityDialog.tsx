import { useState, type ReactNode } from 'react'
import { GitBranch, Trash2 } from 'lucide-react'
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
import {
  anyVariant,
  buildRenames,
  collectLeafPaths,
  collectPaths,
  toDraft,
  toField,
  validate,
} from './field-draft'
import type { EntityData, EntityKind } from './types'

// 저장 시 필드 편집 결과 요약 — 부모(Flow)가 참조 갱신·엣지 정리에 쓴다.
//  - renames  : 바뀐 필드 경로(옛 → 새). when.disc·엣지 핸들·접힘 상태 갱신용.
//  - leafPaths: 저장 후 연결 가능한(리프) 경로 전체. 개명을 반영해도 여기 없는
//               핸들의 엣지는 삭제·object 전환으로 무효 → 제거 대상.
export type FieldChanges = {
  renames: ReadonlyMap<string, string>
  leafPaths: ReadonlySet<string>
}

export function EntityDialog({
  isNew,
  initial,
  onSave,
  onDelete,
  onClose,
}: {
  isNew: boolean
  initial: EntityData | null
  onSave: (data: EntityData, changes: FieldChanges) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [kind, setKind] = useState<EntityKind>(initial?.kind ?? 'etc')
  const [fields, setFields] = useState(() => toDraft(initial?.fields ?? []))
  // 열었을 때의 _k → 경로. 저장 시점 경로와 비교해 개명을 알아낸다.
  const [origPaths] = useState(() => collectPaths(fields))
  const [error, setError] = useState<string | null>(null)
  // 삭제 버튼 2단계 확인 — 한 번 누르면 "정말 삭제" 로 바뀌고, 다시 누르면 삭제
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleSave = () => {
    const nm = name.trim()
    if (!nm) return setError('엔터티 이름을 입력하세요')
    const e = validate(fields, '최상위')
    if (e) return setError(e)
    onSave(
      { name: nm, kind, fields: fields.map(toField) },
      {
        renames: buildRenames(origPaths, collectPaths(fields)),
        leafPaths: collectLeafPaths(fields),
      },
    )
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
            변형(discriminator·when) 설정이 있는 필드는 그대로 보존되고, 필드
            이름을 바꾸면 이를 참조하는 when 조건도 함께 갱신됩니다. 설정 변경은
            오른쪽 코드 패널(JSON)에서.
          </p>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        <DialogFooter>
          {onDelete && (
            <Button
              variant={confirmDelete ? 'destructive' : 'outline'}
              size="sm"
              className={cn(
                'sm:mr-auto',
                !confirmDelete && 'text-destructive hover:text-destructive',
              )}
              onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
            >
              <Trash2 />
              {confirmDelete ? '정말 삭제 (연결 엣지 포함)' : '삭제'}
            </Button>
          )}
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
