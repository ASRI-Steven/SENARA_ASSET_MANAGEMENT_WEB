// Request-form data layer. Backs RequestFormScreen.
//
// Submits a real ICT asset request via POST /api/requests
// (usp_CMS_AssetRequestForm_Save). Dropdown option lists come from
// GET /api/assets/lookups (11 rowsets), reusing the asset-grid filter SP.

import { api } from '@/api/client'

export interface CompanyOption {
  IDX_M_Company: number
  CompanyName: string
  CompanyAlias: string
}

export interface UserOption {
  IDX_M_AssetUser: number
  AssetUserName: string
  DepartmentName: string | null
  PositionName: string | null
}

export interface LocationOption {
  IDX_M_AssetLocation: number
  AssetLocationName: string
}

export interface BrandOption {
  IDX_M_AssetBrand: number
  AssetBrandName: string
}

export interface RequestLookups {
  companies: CompanyOption[]
  users: UserOption[]
  locations: LocationOption[]
  brands: BrandOption[]
}

/**
 * GET /api/assets/lookups → the option lists the request form needs.
 * Rowset order (verified live): [0]=types [1]=colors [2]=locations [3]=statuses
 * [4]=users [5]=sizes [6]=brands [7]=managements [8]=departments [9]=typemodels
 * [10]=companies.
 */
export async function fetchRequestLookups(): Promise<RequestLookups> {
  const env = await api.get<Record<string, unknown>>('/api/assets/lookups')
  if (env.status !== 'success') throw new Error(env.message || 'Gagal memuat data pilihan')
  const data = env.data ?? []
  return {
    locations: (data[2] as unknown as LocationOption[]) ?? [],
    users: (data[4] as unknown as UserOption[]) ?? [],
    brands: (data[6] as unknown as BrandOption[]) ?? [],
    companies: (data[10] as unknown as CompanyOption[]) ?? [],
  }
}

/** Request types (local constant — not a DB lookup; labels match RequestForm.vue). */
export const REQUEST_TYPES = [
  { value: 'new', label: 'New Request' },
  { value: 'assignto', label: 'Request Assign' },
  { value: 'unassign', label: 'Request UnAssign' },
  { value: 'assignfromto', label: 'Request Assign (From-To)' },
  { value: 'renewal', label: 'Request Renewal (for software only)' },
  { value: 'service', label: 'Request Service' },
] as const

/** One line item in a request. Field names match the legacy ItemRequest array. */
export interface RequestItem {
  iname: string
  ibrand: string
  idesc: string
  iqty: number
  irem: string
}

/** Body for POST /api/requests — fields match usp_CMS_AssetRequestForm_Save. */
export interface RequestPayload {
  RequestDate: string
  RequestType: string
  RequestFrom: string
  RequestTo: string
  IDX_M_Company: string
  IDX_M_AssetUser: string
  RequestInformation: string
  RequestDueDate: string
  IDX_M_AssetLocation: string
  ItemRequest: RequestItem[]
}

interface StatusRow {
  StatusCode?: string
  StatusMessage?: string
}

function xmlEscape(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Build the `<root><item>…</item></root>` XML that usp_CMS_AssetRequestForm_Save
 * parses via SP_XML_PREPAREDOCUMENT + OPENXML('/root/item'). The SP's element
 * names are fixed: iname, idesc, ibrand, iqty, imark — note the remark field is
 * **imark** (our RequestItem calls it `irem`). Sending JSON here (the BFF's
 * default for arrays) makes the SP's XML parse fail, so we serialise it ourselves.
 */
function itemRequestXml(items: RequestItem[]): string {
  const body = items
    .map(
      (i) =>
        '<item>' +
        `<iname>${xmlEscape(i.iname ?? '')}</iname>` +
        `<idesc>${xmlEscape(i.idesc ?? '')}</idesc>` +
        `<ibrand>${xmlEscape(String(i.ibrand ?? ''))}</ibrand>` +
        `<iqty>${xmlEscape(String(i.iqty ?? ''))}</iqty>` +
        `<imark>${xmlEscape(i.irem ?? '')}</imark>` +
        '</item>',
    )
    .join('')
  return `<root>${body}</root>`
}

/**
 * Read the SP's status row from the LAST rowset. usp_CMS_AssetRequestForm_Save
 * emits `SELECT * FROM @TempItemRequest` (the parsed line items) as the FIRST
 * rowset and the {StatusCode, StatusMessage, StatusCSS} row only at the END — so
 * data[0][0] is an item row with no StatusCode. Reading the first rowset would
 * miss a business failure (e.g. a mid-transaction insert error) and report it as
 * success. Scan from the end for the row that actually carries the status.
 */
function statusRow(data: unknown[] | undefined): StatusRow | undefined {
  const sets = (data ?? []) as StatusRow[][]
  for (let i = sets.length - 1; i >= 0; i--) {
    const first = sets[i]?.[0]
    if (first && (first.StatusCode !== undefined || first.StatusMessage !== undefined)) {
      return first
    }
  }
  return undefined
}

/**
 * POST /api/requests — submit an ICT asset request. The BFF injects Session_ID
 * from the httpOnly cookie and forwards to usp_CMS_AssetRequestForm_Save.
 * Returns the SP's status message; throws on a BFF/SP error.
 */
export async function submitRequest(payload: RequestPayload): Promise<string> {
  // Serialise the line items to the XML the SP expects (the BFF forwards a string
  // param verbatim; an array would be sent as JSON and break the SP's OPENXML).
  const env = await api.post<StatusRow>('/api/requests', {
    ...payload,
    ItemRequest: itemRequestXml(payload.ItemRequest),
  })
  if (env.status !== 'success') throw new Error(env.message || 'Gagal mengirim request')
  const row = statusRow(env.data)
  // SPs signal a business failure via StatusCode !== 'success' in the last rowset.
  if (row?.StatusCode && row.StatusCode.toLowerCase() !== 'success') {
    throw new Error(row.StatusMessage || 'Request gagal disimpan')
  }
  return row?.StatusMessage || 'Request berhasil dikirim'
}
