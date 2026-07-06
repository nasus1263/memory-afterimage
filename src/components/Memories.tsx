import { useEffect, useMemo, useState } from 'react'
import { listMemories, deleteMemory, type MemoryRecord } from '../services/memories'
import { KakaoTalkIcon } from './icons'
import { useAlert } from '../hooks/useAlert'

export function Memories() {
  const [items, setItems] = useState<MemoryRecord[] | null>(null)
  const { showAlert } = useAlert()

  useEffect(() => {
    listMemories().then(setItems)
  }, [])

  const urls = useMemo(() => items?.map((it) => URL.createObjectURL(it.video)) ?? [], [items])
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls])

  async function handleDelete(id?: number) {
    if (id == null) return
    if (!window.confirm('이 기억을 삭제하시겠습니까?')) return
    await deleteMemory(id)
    setItems((prev) => prev?.filter((it) => it.id !== id) ?? prev)
  }

  if (items === null) {
    return <p className="text-text-dim text-base py-8">불러오는 중...</p>
  }

  if (items.length === 0) {
    return <p className="text-text-dim text-base py-8">아직 저장된 기억이 없습니다.</p>
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 py-8">
      {items.map((item, i) => (
        <div key={item.id} className="bg-surface border border-border rounded-3xl overflow-hidden flex flex-col shadow-paper">
          <video className="w-full aspect-video bg-black object-contain" src={urls[i]} controls loop />
          <div className="p-3.5 flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-base text-text-dim">{new Date(item.createdAt).toLocaleString('ko-KR')}</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="min-w-11 min-h-11 flex items-center justify-center bg-transparent border-none cursor-pointer"
                  aria-label="카카오톡 공유"
                  onClick={() => showAlert('카카오톡 공유 기능은 곧 추가될 예정이에요.', { tone: 'info' })}
                >
                  <KakaoTalkIcon className="w-[22px] h-[22px]" />
                </button>
                <button
                  className="min-h-11 bg-transparent border border-border text-text-dim py-1 px-3 rounded text-base cursor-pointer transition-colors hover:border-error hover:text-error"
                  onClick={() => handleDelete(item.id)}
                >
                  삭제
                </button>
              </div>
            </div>
            <p className="text-base text-text-dim">{item.text}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
