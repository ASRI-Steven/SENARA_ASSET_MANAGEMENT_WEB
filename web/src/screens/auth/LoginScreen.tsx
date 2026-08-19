import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Boxes,
  Eye,
  EyeOff,
  Hash,
  Loader2,
  Lock,
  LogIn,
  ShieldCheck,
  UploadCloud,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useSession } from '@/store/session'

/** Small "required" marker shared by both field labels. */
function Required() {
  return (
    <span className="ml-0.5 font-semibold text-destructive" aria-hidden="true">
      *
    </span>
  )
}

/** One selling-point row in the left brand panel. */
function Feature({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-[13.5px] text-white/90">
      <Icon className="h-[18px] w-[18px] shrink-0 text-teal-300" />
      {children}
    </div>
  )
}

export default function LoginScreen() {
  const login = useSession((s) => s.login)
  const navigate = useNavigate()
  const [nik, setNik] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!nik || !password) {
      toast.error('NIK dan Password wajib diisi')
      return
    }
    setLoading(true)
    try {
      await login(nik, password, remember)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Login gagal')
    } finally {
      setLoading(false)
    }
  }

  const fieldFocus =
    'focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1 focus-visible:ring-offset-background focus-visible:border-primary'

  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-[1.05fr_0.95fr]">
      {/* LEFT — brand panel (desktop only, mockup asril-backend login) */}
      <div
        className="relative hidden flex-col justify-between overflow-hidden p-14 text-white lg:flex"
        style={{ backgroundImage: 'linear-gradient(150deg, #0f2a28 0%, #0f766e 60%, #0d9488 100%)' }}
      >
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-[360px] w-[360px] rounded-full bg-white/[0.06]" />

        <div className="relative flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-white/[0.14]">
          <Boxes className="h-7 w-7" />
        </div>

        <div className="relative">
          <h1 className="text-[38px] font-extrabold leading-[1.05] tracking-[-0.02em]">
            Senara
            <br />
            Asset Management
          </h1>
          <p className="mt-3.5 max-w-[42ch] text-[15px] leading-relaxed text-white/85">
            System of record seluruh asset PT Alam Sutera Realty Group beserta history perubahannya
            — data source untuk opname lapangan Senara Mobile.
          </p>
          <div className="mt-7 flex flex-col gap-3">
            <Feature icon={Boxes}>32.432 asset terdata</Feature>
            <Feature icon={ShieldCheck}>Role-based access control</Feature>
            <Feature icon={UploadCloud}>Batching Status Asset dengan approval Manager</Feature>
          </div>
        </div>

        <div className="relative text-xs text-white/60">
          © 2026 PT Alam Sutera Realty, Tbk · ICT Business &amp; Digital Solution
        </div>
      </div>

      {/* RIGHT — form */}
      <div className="flex items-center justify-center bg-muted/30 p-6 sm:p-10">
        <div className="w-full max-w-[400px]">
          {/* Brand chip */}
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Boxes className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <div className="text-[17px] font-bold text-foreground">Senara Backend</div>
              <div className="text-xs text-muted-foreground">Asset Management · Web</div>
            </div>
          </div>

          <h2 className="text-2xl font-extrabold tracking-[-0.01em] text-foreground">Masuk</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gunakan NIK dan password Senara Anda.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            {/* NIK */}
            <div className="space-y-1.5">
              <Label htmlFor="nik" className="text-[13px] font-medium text-foreground">
                NIK
                <Required />
              </Label>
              <div className="relative">
                <Hash className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="nik"
                  value={nik}
                  onChange={(e) => setNik(e.target.value)}
                  placeholder="mis. 30110001"
                  autoComplete="username"
                  inputMode="numeric"
                  required
                  className={cn('h-11 pl-10 font-mono', fieldFocus)}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[13px] font-medium text-foreground">
                Password
                <Required />
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className={cn('h-11 pl-10 pr-11', fieldFocus)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  aria-pressed={showPassword}
                  className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Remember + Forgot */}
            <div className="flex items-center justify-between pt-0.5">
              <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                />
                Ingat saya
              </label>
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                className="rounded text-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                Lupa password?
              </a>
            </div>

            {/* Submit */}
            <Button type="submit" disabled={loading} className="mt-1 h-11 w-full text-[15px] font-semibold">
              {loading ? (
                <>
                  <Loader2 className="animate-spin" /> Memproses…
                </>
              ) : (
                <>
                  <LogIn /> Masuk
                </>
              )}
            </Button>
          </form>

          {/* Info banner */}
          <div className="mt-5 flex gap-3 rounded-xl border border-primary/15 bg-primary/[0.06] p-3.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="space-y-0.5">
              <p className="text-[13px] font-medium leading-snug text-foreground">
                Menu menyesuaikan Role
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Tampilan &amp; hak akses mengikuti Role + Management scope akun Anda (PIC / Tim Asset
                / Supervisor / Manager GA).
              </p>
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            Belum punya akses? Hubungi Supervisor (Admin Asset).
          </p>
        </div>
      </div>
    </div>
  )
}
