import { useState } from 'react'
import { Check, Copy, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CodeDoc } from '../flow/code'

// 저장본(doc)이 검증을 통과하지 못한 페이지의 안내 화면 — Flow 대신 렌더된다.
// Flow 를 마운트하지 않는 것이 핵심: onGraphChange 가 발생하지 않아
// "빈 그래프 자동저장"으로 원본이 덮어써지는 일이 없다.
// 원본은 "초기화"를 명시적으로 누르기 전까지 그대로 보존된다.
export function InvalidPagePanel({
  errors,
  doc,
  onReset,
}: {
  errors: string[]
  doc: CodeDoc
  onReset: () => void
}) {
  const [copied, setCopied] = useState(false)

  // 원본 doc 을 JSON 그대로 클립보드로 — 수동 복구(코드 패널에 붙여넣기 등)용
  const copyDoc = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(doc, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      console.warn('[lineage] 클립보드 복사에 실패했습니다.')
    }
  }

  return (
    <div className="flex min-w-0 flex-1 items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <TriangleAlert className="size-4 text-amber-500" />
          이 페이지의 저장 데이터를 읽을 수 없습니다
        </h2>
        <p className="mt-2 text-xs text-muted-foreground">
          저장본이 현재 버전에서 유효하지 않은 형태입니다. 원본은 그대로
          보존되어 있으니, 필요하면 JSON 을 복사해 두고 초기화하세요.
        </p>
        <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto rounded-md bg-muted p-2 font-mono text-xs text-muted-foreground">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={copyDoc}>
            {copied ? (
              <Check className="size-3.5 text-emerald-500" />
            ) : (
              <Copy className="size-3.5" />
            )}
            원본 JSON 복사
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (
                window.confirm(
                  '이 페이지를 빈 페이지로 초기화할까요? 저장돼 있던 원본 데이터는 사라집니다.',
                )
              )
                onReset()
            }}
          >
            빈 페이지로 초기화
          </Button>
        </div>
      </div>
    </div>
  )
}
