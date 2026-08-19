// Foto asset via shared Upload Microservice (Go/Echo) di 10.10.1.3:1323.
//
// Alur:
//  1) UPLOAD  → POST /upload (multipart: file + productType). BUTUH header
//     `apiclient` → lewat proxy /upload-svc (vite) yang inject key server-side
//     (key TIDAK ke-bundle ke browser). Balik { StatusCode, Data, FileName },
//     Data = "uploads/asrilup/<ts><name>".
//  2) SIMPAN DB → PhotoPath = "http://10.10.1.3/preview/<Data>"  (URL download/
//     referensi, port 80 — konsisten dgn sistem lain).
//  3) RENDER <img> → "http://10.10.1.3:1323/preview/show/<Data>" (LANGSUNG,
//     preview TIDAK butuh apiclient). Path di-encode 1 segmen utk echo :path.

const UPLOAD_BASE = '/upload-svc' // proxy (vite) → 10.10.1.3:1323, inject apiclient
const PRODUCT_TYPE = 'asrilup'
const UPLOAD_TIMEOUT_MS = 30_000

// Host microservice (pakai port :1323 di dua-duanya).
const STORE_HOST = 'http://10.10.1.3:1323' // → disimpan di DB: <STORE_HOST>/preview/<Data>
const SHOW_BASE = 'http://10.10.1.3:1323/preview/show' // → render <img>

export interface UploadResult {
  path: string // → PhotoPath tersimpan ("http://10.10.1.3/preview/<Data>")
  fileName: string // → PhotoFileName
  size: number // bytes
  width: number // px (0 kalau gagal baca)
  height: number
}

/** Baca dimensi gambar (buat metadata "1280×960"). 0/0 kalau bukan gambar/gagal. */
function readDimensions(file: File | Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      resolve({ width: 0, height: 0 })
      URL.revokeObjectURL(url)
    }
    img.src = url
  })
}

export async function uploadPhoto(file: File | Blob, name = 'asset.jpg'): Promise<UploadResult> {
  const { width, height } = await readDimensions(file)
  const fd = new FormData()
  fd.append('file', file, name)
  fd.append('productType', PRODUCT_TYPE)

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), UPLOAD_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(`${UPLOAD_BASE}/upload`, { method: 'POST', body: fd, signal: ctrl.signal })
  } catch (e) {
    clearTimeout(timer)
    const msg =
      (e as Error)?.name === 'AbortError'
        ? `Upload timeout ${UPLOAD_TIMEOUT_MS / 1000}s (server upload tidak terjangkau?)`
        : `Upload gagal konek: ${(e as Error)?.message}`
    throw new Error(msg)
  }
  clearTimeout(timer)

  const raw = await res.text().catch(() => '')
  let j: { StatusCode?: string; StatusMessage?: string; Data?: string; FileName?: string } | null =
    null
  try {
    j = raw ? JSON.parse(raw) : null
  } catch {
    // biarin j=null → error di bawah
  }
  if (!res.ok || !j || !j.Data || String(j.StatusCode ?? '').toLowerCase() === 'warning') {
    throw new Error(j?.StatusMessage || `Upload foto gagal (HTTP ${res.status})`)
  }
  const data = j.Data.replace(/^\/+/, '') // "uploads/asrilup/<ts><name>"
  return {
    path: `${STORE_HOST}/preview/${data}`, // yang disimpan ke DB
    fileName: j.FileName ?? name,
    size: file.size,
    width,
    height,
  }
}

/** Ambil bagian data ("uploads/.../x.png") dari nilai tersimpan, apapun bentuknya. */
function extractData(stored: string): string {
  const m = stored.match(/\/preview(?:\/show)?\/(.+)$/)
  let data = m ? m[1] : stored
  data = data.replace(/^\/+/, '')
  try {
    data = decodeURIComponent(data) // kalau sempat ke-encode
  } catch {
    // biarin apa adanya
  }
  return data
}

/** URL render inline (`<img src>`) → LANGSUNG ke :1323/preview/show/<data>.
 *  Slash HARUS literal — microservice baca path apa adanya; `%2F` malah dianggap
 *  nama file literal → "File Not Found". Encode per-segmen aja (jaga karakter
 *  aneh), tapi `/` tetap `/`. (Terbukti: slash literal → image/png 530KB, %2F → JSON.) */
export function photoUrl(stored?: string | null): string {
  if (!stored) return ''
  const safe = extractData(stored)
    .split('/')
    .map(encodeURIComponent)
    .join('/')
  return `${SHOW_BASE}/${safe}`
}
