// Thin fetch client for the BFF. The browser only ever calls same-origin
// `/api/*` (Vite dev proxy → BFF :8080). The session is an httpOnly cookie, so
// JS never holds a token — every call just sends `credentials: 'include'`.

export interface Envelope<Row = Record<string, unknown>> {
  status: string // "success" | "error"
  message: string
  data: Row[][] // array of SP result sets (Table, Table1, …)
}

export class UnauthorizedError extends Error {
  constructor() {
    super('unauthorized')
    this.name = 'UnauthorizedError'
  }
}

async function request<Row = Record<string, unknown>>(
  path: string,
  init: RequestInit,
): Promise<Envelope<Row>> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (res.status === 401) throw new UnauthorizedError()
  const raw = await res.text()
  try {
    return JSON.parse(raw) as Envelope<Row>
  } catch {
    // Respons bukan JSON — paling sering 404 "404 page not found" (BFF belum
    // di-restart jadi route baru belum ada) atau proxy salah target. Kasih pesan
    // yang jelas, bukan native "Unexpected non-whitespace character after JSON".
    const snippet = raw.trim().slice(0, 120)
    throw new Error(
      `Respons server bukan JSON (HTTP ${res.status}) untuk ${path}` +
        (snippet ? ` — "${snippet}". Sudah restart BFF?` : ''),
    )
  }
}

export const api = {
  get: <Row = Record<string, unknown>>(path: string) => request<Row>(path, { method: 'GET' }),
  post: <Row = Record<string, unknown>>(path: string, body?: unknown) =>
    request<Row>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  patch: <Row = Record<string, unknown>>(path: string, body?: unknown) =>
    request<Row>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  del: <Row = Record<string, unknown>>(path: string, body?: unknown) =>
    request<Row>(path, { method: 'DELETE', body: JSON.stringify(body ?? {}) }),
}

/** First row of the first result set (the common single-row shape). */
export function firstRow<Row = Record<string, unknown>>(env: Envelope<Row>): Row | undefined {
  return env.data?.[0]?.[0]
}

/** First result set (the common list shape). */
export function rows<Row = Record<string, unknown>>(env: Envelope<Row>): Row[] {
  return env.data?.[0] ?? []
}
