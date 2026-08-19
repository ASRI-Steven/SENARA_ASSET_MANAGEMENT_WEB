import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api, firstRow, UnauthorizedError } from '@/api/client'
import { fetchUserRole } from '@/api/menu'

export type SessionStatus = 'unknown' | 'authenticated' | 'unauthenticated'

export interface SessionUser {
  nik: string
  name: string
}

interface SessionState {
  status: SessionStatus
  user: SessionUser | null
  /** GroupRole_Name (app 78) — "Lihat sebagai {role}" di topbar. null bila belum ada. */
  role: string | null
  /** Resolve the current session from the httpOnly cookie (GET /api/auth/check). */
  check: () => Promise<void>
  /** POST /api/auth/login; throws on invalid credentials. remember=false → cookie sesi (hilang saat browser ditutup). */
  login: (nik: string, password: string, remember?: boolean) => Promise<void>
  /** POST /api/auth/logout; clears the cookie server-side. */
  logout: () => Promise<void>
}

interface AuthRow {
  NIK?: string
  Name?: string
  Session_ID?: string
}

// The real session lives in the BFF's httpOnly cookie; this store only mirrors
// the identity for the UI (no token). It is PERSISTED so a page reload (or a
// Vite HMR full-reload during dev) does NOT reset the user to a logged-out state
// and bounce them to /login before check() re-validates in the background.
export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      status: 'unknown',
      user: null,
      role: null,

      check: async () => {
        try {
          const env = await api.get<AuthRow>('/api/auth/check')
          const row = firstRow(env)
          if (env.status === 'success' && row?.Name) {
            set({ status: 'authenticated', user: { nik: row.NIK ?? '', name: row.Name } })
            void fetchUserRole().then((role) => set({ role }))
          } else {
            // Server answered but there's no valid session → definitely logged out.
            set({ status: 'unauthenticated', user: null, role: null })
          }
        } catch (e) {
          if (e instanceof UnauthorizedError) {
            // Explicit 401 → the session is gone.
            set({ status: 'unauthenticated', user: null })
          }
          // Any OTHER error (network hiccup, an aborted request when Vite HMR
          // reloads the page mid-flight, BFF momentarily down) is TRANSIENT — do
          // NOT log the user out. Keep the current (possibly persisted) status.
        }
      },

      login: async (nik, password, remember = true) => {
        const env = await api.post<AuthRow>('/api/auth/login', {
          NIK: nik,
          Password: password,
          Remember: remember ? '1' : '0',
        })
        const row = firstRow(env)
        if (env.status !== 'success' || !row?.Session_ID) {
          throw new Error(env.message || 'NIK atau password salah')
        }
        set({ status: 'authenticated', user: { nik: row.NIK ?? nik, name: row.Name ?? nik } })
        void fetchUserRole().then((role) => set({ role }))
      },

      logout: async () => {
        try {
          await api.post('/api/auth/logout')
        } catch {
          // ignore — clear the UI regardless
        }
        set({ status: 'unauthenticated', user: null, role: null })
      },
    }),
    {
      name: 'asrilup-session',
      // Persist identity + status. A rehydrated 'authenticated' lets the app
      // render immediately on reload while check() re-validates in the
      // background (and only a definitive 401/no-session flips to logged-out).
      partialize: (s) => ({ user: s.user, status: s.status, role: s.role }),
    },
  ),
)
