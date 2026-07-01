import { useEffect, useMemo, useState } from 'react'
import { listMemories, deleteMemory, type MemoryRecord } from '../services/memories'

export function Memories() {
  const [items, setItems] = useState<MemoryRecord[] | null>(null)

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
    return <p className="text-text-dim text-sm py-8">불러오는 중...</p>
  }

  if (items.length === 0) {
    return <p className="text-text-dim text-sm py-8">아직 저장된 기억이 없습니다.</p>
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 py-8">
      {items.map((item, i) => (
        <div key={item.id} className="bg-surface border border-border rounded-3xl overflow-hidden flex flex-col shadow-paper">
          <video className="w-full aspect-video bg-black object-contain" src={urls[i]} controls loop />
          <div className="p-3.5 flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-text-dim">{new Date(item.createdAt).toLocaleString('ko-KR')}</span>
              <button
                className="bg-transparent border border-border text-text-dim py-1 px-2.5 rounded text-xs cursor-pointer transition-colors hover:border-error hover:text-error"
                onClick={() => handleDelete(item.id)}
              >
                삭제
              </button>
            </div>
            <p className="text-sm text-text-dim">{item.text}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
