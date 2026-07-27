import { useEffect, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useSession } from '@/store/session'

// Session gate. On first mount it resolves the httpOnly cookie via
// GET /api/auth/check; while that's pending (status 'unknown') it shows a splash
// to avoid a flash of the login screen for already-authenticated users.
export function RouteGuard({ children }: { children: ReactNode }) {
  const status = useSession((s) => s.status)
  const check = useSession((s) => s.check)
  const location = useLocation()

  useEffect(() => {
    if (status === 'unknown') void check()
  }, [status, check])

  if (status === 'unknown') {
    return (
      <div
        data-testid="session-splash"
        className="flex min-h-[100dvh] items-center justify-center text-sm text-muted-foreground"
      >
        Memuat…
      </div>
    )
  }
  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}
