import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { searchBatches, type UploadBatch } from '@/api/uploadAsset'

/**
 * Lonceng notifikasi: menampilkan batch "Pending Approval" (Status='P') sebagai
 * notif yang bisa ditindak. Badge = jumlah, item → halaman Review batch.
 * Di-refresh tiap 1 menit + saat dropdown dibuka. Gagal fetch didiamkan (lonceng
 * tak boleh bikin app error).
 */
export function NotificationBell() {
  const navigate = useNavigate()
  const [items, setItems] = useState<UploadBatch[]>([])

  async function load() {
    try {
      setItems(await searchBatches('P'))
    } catch {
      /* diamkan */
    }
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [])

  const count = items.length

  return (
    <DropdownMenu onOpenChange={(o) => o && load()}>
      <DropdownMenuTrigger
        aria-label={count ? `Notifikasi (${count} menunggu persetujuan)` : 'Notifikasi'}
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifikasi</span>
          {count > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              {count} menunggu persetujuan
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {count === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
            Tidak ada notifikasi baru
          </div>
        ) : (
          items.slice(0, 6).map((b) => (
            <DropdownMenuItem
              key={b.IDX_T_UploadBatch}
              className="flex flex-col items-start gap-0.5"
              onClick={() => navigate(`/upload-asset/${b.IDX_T_UploadBatch}?mode=review`)}
            >
              <span className="text-sm font-medium text-foreground">
                {b.BatchNo} menunggu persetujuan
              </span>
              <span className="text-xs text-muted-foreground">
                {b.SubmitName || '—'} · {b.Qty} aset → {b.TargetStatus}
              </span>
            </DropdownMenuItem>
          ))
        )}
        {count > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => navigate('/upload-asset')}
              className="justify-center text-sm font-medium text-primary"
            >
              Lihat semua di Batching
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
