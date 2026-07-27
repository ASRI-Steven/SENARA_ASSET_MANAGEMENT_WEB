import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useSession } from '@/store/session'
import { initials } from '@/lib/format'

export default function AccountScreen() {
  const user = useSession((s) => s.user)
  const logout = useSession((s) => s.logout)
  const navigate = useNavigate()

  return (
    <>
      <PageHeader title="Akun" />
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
              {initials(user?.name)}
            </span>
            <div>
              <div className="text-lg font-semibold text-foreground">{user?.name ?? 'User'}</div>
              <div className="text-sm text-muted-foreground">NIK {user?.nik}</div>
            </div>
          </div>
          <Button
            variant="outline"
            className="mt-6 w-full text-rose-600 hover:text-rose-600"
            onClick={async () => {
              await logout()
              navigate('/login', { replace: true })
            }}
          >
            <LogOut className="h-4 w-4" /> Keluar
          </Button>
        </CardContent>
      </Card>
    </>
  )
}
