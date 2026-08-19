import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { RouteGuard } from './guard'

const LoginScreen = lazy(() => import('@/screens/auth/LoginScreen'))
const DashboardScreen = lazy(() => import('@/screens/dashboard/DashboardScreen'))
const AssetListScreen = lazy(() => import('@/screens/assets/AssetListScreen'))
const AssetNewScreen = lazy(() => import('@/screens/assets/AssetNewScreen'))
const AssetEditScreen = lazy(() => import('@/screens/assets/AssetEditScreen'))
const AssetDetailScreen = lazy(() => import('@/screens/assets/AssetDetailScreen'))
const RequestFormScreen = lazy(() => import('@/screens/requests/RequestFormScreen'))
const MasterHubScreen = lazy(() => import('@/screens/master/MasterHubScreen'))
const MasterCrudScreen = lazy(() => import('@/screens/master/MasterCrudScreen'))
const UploadAssetScreen = lazy(() => import('@/screens/upload/UploadAssetScreen'))
const UploadAssetDetailScreen = lazy(() => import('@/screens/upload/UploadAssetDetailScreen'))
const AdminAccessScreen = lazy(() => import('@/screens/settings/AdminAccessScreen'))
const GroupAccessScreen = lazy(() => import('@/screens/settings/GroupAccessScreen'))
const UserRolesScreen = lazy(() => import('@/screens/settings/UserRolesScreen'))
const PrintQrScreen = lazy(() => import('@/screens/print/PrintQrScreen'))
const AccountScreen = lazy(() => import('@/screens/account/AccountScreen'))

function Fallback() {
  return (
    <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
      Memuat…
    </div>
  )
}

function S({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Fallback />}>{children}</Suspense>
}

export const router = createBrowserRouter([
  { path: '/login', element: <S><LoginScreen /></S> },
  {
    path: '/',
    element: (
      <RouteGuard>
        <AppShell />
      </RouteGuard>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <S><DashboardScreen /></S> },
      { path: 'assets', element: <S><AssetListScreen /></S> },
      { path: 'assets/new', element: <S><AssetNewScreen /></S> },
      { path: 'assets/:id', element: <S><AssetDetailScreen /></S> },
      { path: 'assets/:id/edit', element: <S><AssetEditScreen /></S> },
      { path: 'request', element: <S><RequestFormScreen /></S> },
      { path: 'master', element: <S><MasterHubScreen /></S> },
      { path: 'master/:entity', element: <S><MasterCrudScreen /></S> },
      { path: 'upload-asset', element: <S><UploadAssetScreen /></S> },
      { path: 'upload-asset/:id', element: <S><UploadAssetDetailScreen /></S> },
      { path: 'settings/admin-access', element: <S><AdminAccessScreen /></S> },
      { path: 'settings/groups', element: <S><GroupAccessScreen /></S> },
      { path: 'settings/users', element: <S><UserRolesScreen /></S> },
      { path: 'print-qr', element: <S><PrintQrScreen /></S> },
      { path: 'account', element: <S><AccountScreen /></S> },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
])
