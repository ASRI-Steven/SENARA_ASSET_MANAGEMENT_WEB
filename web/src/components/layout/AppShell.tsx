import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { TopBar } from './TopBar'

// Responsive shell: fixed sidebar on desktop (lg+), bottom nav on mobile.
export function AppShell() {
  return (
    <div className="min-h-[100dvh] bg-muted/30">
      <Sidebar />
      <div className="lg:pl-64">
        <TopBar />
        <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-5 lg:px-8 lg:pb-10">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
