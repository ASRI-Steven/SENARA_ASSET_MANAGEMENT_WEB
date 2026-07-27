# ASRILup PWA

Rebuild ASRILup (asset management) menjadi **PWA**, mengikuti stack & tema template `Nareswari_PWA`.
Saat ini **frontend/UI dulu dengan mock data** — backend (BFF) menyusul.

## Stack

React 19 · Vite 8 · TypeScript · Tailwind + shadcn/ui (tema teal `#1B90A5`) · react-router · zustand ·
TanStack Query (siap dipakai saat BFF ada) · vite-plugin-pwa (service worker).

## Jalankan

```bash
cd web
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + build produksi + generate service worker
npm run preview  # preview hasil build
```

Login: isi **NIK & password apa saja** (auth masih mock).

## Layout (responsive)

- **Mobile:** bottom-nav 5 tab (Dashboard / Asset / Request / Master / Akun).
- **Desktop (lg+):** sidebar kiri tetap + top bar; tabel aset lebar.

## Layar (semua pakai mock data di `web/src/mock/data.ts`)

| Route | Layar |
|-------|-------|
| `/login` | Login |
| `/dashboard` | Score card + breakdown (per company/type/location) |
| `/assets` | Manage Asset — tabel (desktop) / kartu (mobile) + search + filter sheet + paginasi |
| `/assets/:id` | Detail aset + QR + riwayat |
| `/request` | Request Form ICT (header + item repeatable) |
| `/master` | Hub master data |
| `/master/:entity` | CRUD generik (tambah/edit/hapus + search) untuk 14 entity |
| `/print-qr` | Pilih aset → cetak QR (**`qrcode.react` + `window.print()` → Save as PDF**) |
| `/account` | Info user + logout |

## Cetak / PDF (pengganti SSRS)

Mengikuti gaya Nareswari yang **tidak pakai library PDF**: QR dirender `qrcode.react`, lalu
`window.print()` + CSS `@media print` (di `src/index.css`) → browser "Save as PDF". Nol dependency, jalan offline.

## Menyambung backend nanti

- `src/mock/data.ts` diganti hook TanStack Query yang memanggil `/api/*` (di-proxy ke BFF; lihat `vite.config.ts`).
- Session pindah ke **httpOnly cookie** (store `src/store/session.ts` cukup simpan identitas untuk UI).
- Peta endpoint → stored procedure ada di `../ASRILUP_ANALYSIS/`.

## Struktur

```
web/src/
  app/        App.tsx, router.tsx (lazy), guard.tsx, nav.ts
  components/
    ui/       shadcn primitives
    layout/   AppShell, Sidebar, BottomNav, TopBar, BrandMark, PageHeader
  screens/    auth, dashboard, assets, requests, master, print, account
  store/      session.ts (zustand)
  mock/       data.ts (ganti dengan API nanti)
  lib/        utils.ts (cn), format.ts (rupiah/tanggal)
  pwa/        sw.ts (service worker)
```
