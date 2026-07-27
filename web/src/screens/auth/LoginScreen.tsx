import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSession } from '@/store/session'

export default function LoginScreen() {
  const login = useSession((s) => s.login)
  const navigate = useNavigate()
  const [nik, setNik] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!nik || !password) {
      toast.error('NIK dan Password wajib diisi')
      return
    }
    setLoading(true)
    try {
      await login(nik, password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Login gagal')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-b from-[#CFE9EF] via-[#9ED3DF] to-[#6FB9CB] p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground">
            AL
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">ASRILup</h1>
            <p className="text-sm text-muted-foreground">Asset Management · Alam Sutera</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nik">NIK</Label>
            <Input
              id="nik"
              value={nik}
              onChange={(e) => setNik(e.target.value)}
              placeholder="Nomor Induk Karyawan"
              autoComplete="username"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Memproses…' : 'Masuk'}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Masuk dengan NIK &amp; password ASRILup Anda.
        </p>
      </div>
    </div>
  )
}
