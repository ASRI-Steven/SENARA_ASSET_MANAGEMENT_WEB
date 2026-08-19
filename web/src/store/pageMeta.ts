import { useEffect } from 'react'
import { create } from 'zustand'

// Judul + subjudul yang tampil di topbar. Tiap screen bisa override via
// useSetPageMeta(); kalau nggak, TopBar pakai fallback dari route.
interface PageMetaState {
  title: string
  subtitle: string
  set: (m: { title: string; subtitle?: string }) => void
}

export const usePageMeta = create<PageMetaState>((set) => ({
  title: '',
  subtitle: '',
  set: ({ title, subtitle }) => set({ title, subtitle: subtitle ?? '' }),
}))

/** Set judul topbar untuk screen ini; auto-reset saat pindah layar. */
export function useSetPageMeta(title: string, subtitle?: string) {
  const set = usePageMeta((s) => s.set)
  useEffect(() => {
    set({ title, subtitle })
    return () => set({ title: '', subtitle: '' })
  }, [set, title, subtitle])
}
