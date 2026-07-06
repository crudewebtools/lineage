import { openDB, type IDBPDatabase } from 'idb'
import type { CodeDoc } from '../flow/code'

// 페이지 저장소 — IndexedDB `lineage` 의 object store `pages` 하나.
// 그래프는 React Flow 노드가 아니라 CodeDoc(코드 패널과 같은 포맷)으로 담는다.
// 로드할 때 항상 graphFromDoc 검증을 거치므로 깨진 데이터가 앱을 죽이지 않는다.
export type PageRecord = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  doc: CodeDoc
}

const DB_NAME = 'lineage'
const STORE = 'pages'
const LAST_PAGE_KEY = 'lineage:lastPageId'

let dbPromise: Promise<IDBPDatabase> | null = null
function db(): Promise<IDBPDatabase> {
  // 실패한 프로미스는 캐시하지 않는다 — 일시적 오류였다면 다음 호출에서 다시 연다
  dbPromise ??= openDB(DB_NAME, 1, {
    upgrade(d) {
      d.createObjectStore(STORE, { keyPath: 'id' })
    },
  }).catch((e: unknown) => {
    dbPromise = null
    throw e
  })
  return dbPromise
}

// 만든 순서(createdAt)로 정렬해 돌려준다 — 편집할 때마다 목록이 뒤섞이지 않게.
export async function listPages(): Promise<PageRecord[]> {
  const all = (await (await db()).getAll(STORE)) as PageRecord[]
  return all.sort((a, b) => a.createdAt - b.createdAt)
}

export async function putPage(rec: PageRecord): Promise<void> {
  await (await db()).put(STORE, rec)
}

export async function deletePage(id: string): Promise<void> {
  await (await db()).delete(STORE, id)
}

// 여러 페이지를 하나의 readwrite 트랜잭션으로 기록한다 (백업 "병합 가져오기").
// 도중 하나라도 실패하면 트랜잭션이 통째로 롤백된다 — 부분 저장이 남지 않는다.
export async function putPages(pages: PageRecord[]): Promise<void> {
  const tx = (await db()).transaction(STORE, 'readwrite')
  await Promise.all([...pages.map((rec) => tx.store.put(rec)), tx.done])
}

// 스토어를 비우고 주어진 페이지로 교체한다 (백업 "덮어쓰기 복원").
// clear + 전체 put 을 한 트랜잭션에 묶어 원자적으로 처리한다 — put 이 실패하면
// clear 도 롤백돼, 성공 알림과 달리 DB 가 비어 버리는 사고를 막는다.
export async function replaceAllPages(pages: PageRecord[]): Promise<void> {
  const tx = (await db()).transaction(STORE, 'readwrite')
  await tx.store.clear()
  await Promise.all([...pages.map((rec) => tx.store.put(rec)), tx.done])
}

// 마지막으로 열었던 페이지 — DB 에 넣을 만큼 무겁지 않아 localStorage 에 둔다.
// localStorage 가 막혀 있어도(프라이빗 모드 등) 치명적이지 않으니 조용히 무시한다.
export function readLastPageId(): string | null {
  try {
    return localStorage.getItem(LAST_PAGE_KEY)
  } catch {
    return null
  }
}

export function writeLastPageId(id: string): void {
  try {
    localStorage.setItem(LAST_PAGE_KEY, id)
  } catch {
    // 무시 — 다음 방문에 첫 페이지가 열릴 뿐
  }
}
