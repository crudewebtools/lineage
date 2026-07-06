import type { CodeDoc } from '../flow/code'
import type { PageRecord } from './db'

// 페이지 전체 백업 파일 포맷 — 모든 페이지를 통째로 내보내고 다시 불러오기 위한 것.
// 공유 링크(share.ts)와 달리 위치·접힘까지 담은 PageRecord 를 그대로 싣는다
// → 레이아웃까지 완전 복원된다. 파일은 신뢰할 수 없는 입력이므로 파싱은 방어적으로,
//   깨진 레코드는 버리고 개수만 돌려준다(앱은 어차피 로드 시 doc 을 재검증한다).
const FORMAT = 'lineage-pages'
const BACKUP_VERSION = 1

type Backup = {
  app: typeof FORMAT
  version: number
  exportedAt: number
  pages: PageRecord[]
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// 파일명 타임스탬프 (yyyymmdd-hhmm) — 로컬 시각 기준
function stamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

// 페이지 목록 → 다운로드. 브라우저에서만 부르는 DOM 사이드이펙트.
export function downloadPages(pages: PageRecord[]): void {
  const backup: Backup = {
    app: FORMAT,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    pages,
  }
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `lineage-pages-${stamp()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// 레코드 하나를 정규화한다. name·doc 이 없으면 버린다(null). id/시각이 없거나
// 어긋나면 채워 넣는다 — merge 모드는 어차피 id 를 새로 부여하고, overwrite 모드는
// 여기서 살아남은 id 를 그대로 복원한다.
function normalizePage(p: unknown): PageRecord | null {
  if (!isRecord(p) || typeof p.name !== 'string' || !isRecord(p.doc)) return null
  const now = Date.now()
  return {
    id: typeof p.id === 'string' && p.id ? p.id : crypto.randomUUID(),
    name: p.name,
    createdAt: typeof p.createdAt === 'number' ? p.createdAt : now,
    updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : now,
    doc: p.doc as unknown as CodeDoc,
  }
}

export type ParsedBackup = {
  pages: PageRecord[] // 검증 통과분
  skipped: number // 형태가 어긋나 버린 수
}

// 파일 텍스트 → 페이지 배열. 포맷·버전이 맞지 않으면 null(가져오기 거부).
export function parseBackup(text: string): ParsedBackup | null {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  if (!isRecord(data) || data.app !== FORMAT) return null
  // 버전이 다르면 조용히 오파싱하지 않고 거부한다 (share.ts 의 PACK_VERSION 과 같은 이유)
  if (data.version !== BACKUP_VERSION) return null
  if (!Array.isArray(data.pages)) return null
  const pages: PageRecord[] = []
  const seenIds = new Set<string>()
  let skipped = 0
  for (const p of data.pages) {
    const rec = normalizePage(p)
    // 중복 id 는 버린다 — overwrite 는 id 를 그대로 복원하므로, 두 번째부터는
    // React 중복 key 와 put 덮어쓰기를 일으켜 재실행 후 페이지 수가 달라진다.
    if (!rec || seenIds.has(rec.id)) {
      skipped++
      continue
    }
    seenIds.add(rec.id)
    pages.push(rec)
  }
  return { pages, skipped }
}
