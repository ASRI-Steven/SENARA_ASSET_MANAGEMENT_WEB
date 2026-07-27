# ASRILup PWA — Internal Acceptance Test (IAT) Scenarios

Comprehensive IAT coverage for every screen. Data screens are wired to the **real
BFF** (Go + chi) against the **development** `GeneralAffairDB`
(`10.10.0.42\SQLDEVOPERATION2`), so most scenarios now assert **real end-to-end
data**, not mocks. Responsive behavior (desktop table + sidebar vs mobile cards +
bottom-nav) is covered throughout.

## Conventions

- **Auth**: log in at `/login` with NIK `2403077` / password `2403077` → real user
  **STEVEN ALEXANDER** (verified: `POST /api/auth/login` → `data[0][0].Name`).
- **Viewports**: `desktop` = 1280x800, `mobile` = 390x844, `both` = run under each.
- **`realData=true`**: the scenario asserts against live BFF / dev-DB values (real
  AssetIDs, real counts, real master rows), not hardcoded fixtures.
- **`mutates=true`**: the scenario writes to the shared dev DB. Per the SAFETY note:
  - Asset assign/change/return and the request-form submit are **UI-level only** —
    open the dialog/form, fill fields, assert validation and inline behavior, but
    **never click the final submit** that writes shared operational data.
  - Master CRUD is the **one exception**: a single self-cleaning
    `create → verify-in-list → disable → delete` roundtrip using a clearly
    test-marked name (`ZZ_IAT_TEST_*`) is allowed. Never touch pre-existing rows.
- Read / login / search / filter / pagination / detail / history / print / nav are
  safe to exercise fully end-to-end.
- UI is **Bahasa Indonesia** (buttons: "Masuk", "Kirim", "Tambah", "Simpan",
  "Batal", "Hapus", "Sebelumnya", "Berikutnya", "Keluar", "Cetak", "Reset Filter").

## Live-data reference (verified against the dev DB)

Values drift over time — assert **shape and magnitude**, not exact frozen numbers,
except where noted as a stable format.

- Managements dropdown: **23 options** incl. `All` (idx 0) and `Corporate` (idx 1).
- Dashboard (All): TotalAsset ≈ **27,901**; TotalManagement = 22; TotalBroken ≈ 588
  (~2.1%); TotalMIA ≈ 54 (~0.19%); top company **PT. ALFA GOLDLAND REALTY**, top
  location **GWK BALI**, top type **MISCELLANEOUS**.
- Assets grid: **≈27,905 TotalRecords**, MaxPage ≈ 9302 at PageSize 3 (930 at
  PageSize 10). AssetID format is stable, e.g. `GAIN-2019-10-27-00381`.
- `CurrentColorAssetStatus` is a **Vuetify** color class (e.g. `teal darken-2`),
  mapped to a tailwind class by `statusColorClass` — never rendered raw.
- Filter lookups populate: types **27**, colors 35, locations **67**, statuses **5**.
- Master `brand` list ≈ **794** rows; each row carries `Status` + ACL flags
  (`isUpdate/isDelete/isDisable/isEnable`).

---

## Auth (`/login`, guard)

### auth-login-success
- Viewport: both. realData: yes. mutates: no.
- Go to `/login`; fill NIK `2403077`, Password `2403077`; click "Masuk".
- Expect: redirect to `/dashboard`; "Dashboard" heading visible; the top bar / account
  shows the **real** name **STEVEN ALEXANDER** (came from the login envelope).

### auth-login-wrong-password
- Viewport: desktop. realData: yes. mutates: no.
- Go to `/login`; fill NIK `2403077`, Password `salah-password`; click "Masuk".
- Expect: stays on `/login`; an error toast appears (real BFF rejects the credentials);
  not redirected to dashboard.

### auth-login-empty-validation
- Viewport: desktop. realData: no. mutates: no.
- Go to `/login`; leave both fields empty; click "Masuk".
- Expect: toast "NIK dan Password wajib diisi"; still on `/login`; no network call made.

### auth-guard-redirect-unauthenticated
- Viewport: desktop. realData: no. mutates: no.
- Without logging in, navigate directly to `/assets`.
- Expect: the session splash ("Memuat…", `data-testid="session-splash"`) shows while
  `GET /api/auth/check` resolves, then redirects to `/login`.

### auth-guard-persists-session
- Viewport: desktop. realData: yes. mutates: no.
- Log in, then reload the page on `/dashboard`.
- Expect: the httpOnly cookie is re-validated via `/api/auth/check`; user stays on
  `/dashboard` (no bounce to `/login`); real data re-renders.

### auth-logout-from-account
- Viewport: mobile. realData: no. mutates: no.
- Log in; go to `/account`; click "Keluar".
- Expect: redirected to `/login`; visiting a protected route again redirects to `/login`.

### auth-logout-from-topbar
- Viewport: desktop. realData: no. mutates: no.
- Log in; open the top-bar user menu; click "Keluar".
- Expect: redirected to `/login`.

---

## Dashboard (`/dashboard`)

### dashboard-real-summary-cards
- Viewport: desktop. realData: yes. mutates: no.
- Log in and land on `/dashboard`.
- Expect: "Dashboard" heading + 4 score cards — **Total Asset** (~27,901, thousands
  grouped with dots), **Nilai Asset** (large Rupiah value), **Broken** (with
  "% dari total" hint ≈ 2.10%), **MIA** (with "% dari total" hint ≈ 0.19%). Values are
  the real `POST /api/dashboard {IDX_M_AssetManagement:0}` summary, not zeros.

### dashboard-breakdown-panels-real
- Viewport: desktop. realData: yes. mutates: no.
- On `/dashboard`, inspect the four breakdown panels.
- Expect: "Aset per Company" shows real companies (e.g. **PT. ALFA GOLDLAND REALTY**
  near the top), "Aset per Location" shows real locations (e.g. **GWK BALI**), "Aset
  per Type" shows real types (e.g. **MISCELLANEOUS**), "Aset per Type Model (Top 6)"
  renders; each row shows a count and a proportional bar.

### dashboard-management-filter-corporate
- Viewport: desktop. realData: yes. mutates: no.
- On `/dashboard`, open the management select (default "Semua Management" / "All") and
  pick **Corporate** (idx 1).
- Expect: dropdown lists ~23 real options incl. "Corporate"; selecting it re-fetches
  `POST /api/dashboard {IDX_M_AssetManagement:1}`; the score cards and breakdowns
  update to Corporate-scoped numbers (smaller than the All totals).

### dashboard-loading-skeletons
- Viewport: desktop. realData: yes. mutates: no.
- Land on `/dashboard` (or switch management) and observe the initial render.
- Expect: 4 score-card skeletons and per-panel bar skeletons show while the request is
  in flight, then swap to real values.

### dashboard-mobile-layout
- Viewport: mobile. realData: yes. mutates: no.
- On `/dashboard` at 390px width.
- Expect: score cards render in a 2-column grid; breakdown panels stack; bottom-nav
  visible; sidebar hidden; real numbers still present.

---

## Assets list (`/assets`)

### assets-list-real-ids
- Viewport: desktop. realData: yes. mutates: no.
- Navigate to `/assets`.
- Expect: "Manage Asset" heading; header description shows a large real count
  (≈ "27.905 aset"); desktop table with columns Asset ID / Type / Model / Status / User
  / Location / Nilai; first rows show real AssetIDs (pattern like `GAIN-2019-10-27-00381`),
  each a link; status pill uses a mapped tailwind color (not the raw Vuetify class).

### assets-server-pagination
- Viewport: desktop. realData: yes. mutates: no.
- On `/assets`, read "Halaman 1 / N" (N is a large real MaxPage ≈ 930 at PageSize 10);
  click "Berikutnya"; confirm rows change; click "Sebelumnya".
- Expect: server-side paging via `CurrentPage` — the indicator advances then returns;
  "Sebelumnya" is disabled on page 1; row set differs between pages.

### assets-keyword-search-real
- Viewport: desktop. realData: yes. mutates: no.
- On `/assets`, type a real fragment (e.g. `GAIN-2019`) into "Cari AssetID, model, user…".
- Expect: after debounce, the grid re-queries with `Keyword`; page resets to 1; the
  header count drops to the real match total; visible AssetIDs contain the fragment.

### assets-search-no-match
- Viewport: desktop. realData: yes. mutates: no.
- On `/assets`, search for a nonsense keyword (e.g. `ZZZZNOMATCH999`).
- Expect: the BFF returns 0 rows; empty-state card "Tidak ada aset yang cocok." shows;
  header count is "0 aset".

### assets-filter-by-type-real
- Viewport: desktop. realData: yes. mutates: no.
- On `/assets`, click "Filter"; the sheet opens with Type / Status / Location selects
  populated from real lookups (27 types, 5 statuses, 67 locations). Pick a Type
  (e.g. "AC").
- Expect: a filter-count badge appears on the "Filter" button; the grid re-queries with
  `IDX_M_AssetType` and narrows to that type; the header count reflects the filtered total.

### assets-filter-reset
- Viewport: desktop. realData: yes. mutates: no.
- After applying a Type (and/or Status/Location) filter, open the sheet and click
  "Reset Filter".
- Expect: all three selects return to "Semua …"; the badge clears; the grid re-queries
  unfiltered; count returns to the full total.

### assets-row-to-detail
- Viewport: desktop. realData: yes. mutates: no.
- On `/assets`, click the first asset-id link.
- Expect: navigates to `/assets/:id`; the detail heading equals the clicked real AssetID.

### assets-row-actions-menu
- Viewport: desktop. realData: yes. mutates: no.
- On `/assets`, open a row's kebab (⋮) menu.
- Expect: "Lihat Detail", "Assign User", "Return" items appear; "Assign User"/"Return"
  show an info toast ("backend menyusul") — no write occurs; "Lihat Detail" routes to
  the real detail page.

### assets-loading-skeleton
- Viewport: desktop. realData: yes. mutates: no.
- Navigate to `/assets` and observe the first paint before data arrives.
- Expect: a row skeleton (PAGE_SIZE placeholder rows) renders, then swaps to real rows.

### assets-mobile-cards
- Viewport: mobile. realData: yes. mutates: no.
- On `/assets` at 390px.
- Expect: the desktop table is hidden; real asset **cards** render instead (AssetID +
  status pill + type/model + user·location + Rupiah value); each card links to detail.

---

## Asset detail (`/assets/:id`)

### asset-detail-real-fields-qr
- Viewport: desktop. realData: yes. mutates: no.
- Open a valid asset detail via the list (e.g. `GAIN-2019-10-27-00381`).
- Expect: a QR (svg from `qrcode.react`) encoding the AssetID; detail fields populated
  from `POST /api/asset/search` — Type, Model, Brand, Color, Size, Company, Management,
  Department, User, Location, PO No, PO Date, Nilai (Rupiah), Tanggal Aset, Remarks;
  status pill; "Kembali", "Edit", "Cetak QR" buttons present.

### asset-detail-real-history
- Viewport: desktop. realData: yes. mutates: no.
- On an asset detail page, scroll to "Riwayat".
- Expect: history cards fetched via `POST /api/assets/history/{status|user|location|
  management|company}` using the resolved `IDX_M_Asset`; at least the "Status" group has
  a dated real entry (e.g. status "OK" dated 2019-10-28); empty groups are hidden; a
  loading skeleton shows while histories are in flight.

### asset-detail-edit-ui-only
- Viewport: desktop. realData: yes. mutates: no.
- On an asset detail page, click "Edit".
- Expect: an info toast ("Edit aset … backend menyusul"); no write occurs (UI-level).

### asset-detail-print
- Viewport: desktop. realData: yes. mutates: no.
- On an asset detail page, click "Cetak QR".
- Expect: `window.print()` is invoked (client-side only); no navigation, no DB write.

### asset-detail-back
- Viewport: mobile. realData: no. mutates: no.
- On an asset detail page, click "Kembali".
- Expect: returns to `/assets`.

### asset-detail-not-found
- Viewport: desktop. realData: yes. mutates: no.
- Navigate to `/assets/DOES-NOT-EXIST-999`.
- Expect: the BFF search returns no matching row; "Aset DOES-NOT-EXIST-999 tidak
  ditemukan." message with a "Kembali" button back to the list.

---

## Master hub + list (`/master`, `/master/:entity`)

### master-hub-real-counts
- Viewport: desktop. realData: yes. mutates: no.
- Navigate to `/master`.
- Expect: "Master Data" heading; a card per entity (Asset Brand, Asset Color, Asset
  Size, Asset Status, Asset Management, Asset Location, Asset Type, Asset User) each
  showing a real "N item" count (from each entity's `/search` with empty keyword — e.g.
  Asset Brand ≈ 794); count skeletons show while loading; each card links to its sublist.

### master-open-brand-real-rows
- Viewport: desktop. realData: yes. mutates: no.
- From `/master`, open "Asset Brand" (`/master/brand`).
- Expect: header count ≈ 794; table with columns #, Nama, Jumlah Aset, Aksi; real brand
  rows with per-row asset counts; enabled rows show edit/disable/delete actions per their
  ACL flags; "Tambah" and "Master" (back) buttons present.

### master-entity-search-real
- Viewport: desktop. realData: yes. mutates: no.
- On `/master/brand`, type a real fragment into "Cari Asset Brand…".
- Expect: after debounce, `POST /api/master/brand/search {Keyword}` re-queries
  server-side; rows narrow to matches; empty state "Tidak ada data." when nothing matches.

### master-location-shows-code-column
- Viewport: desktop. realData: yes. mutates: no.
- Open "Asset Location" (`/master/location`) (and/or "Asset Type").
- Expect: an extra "Kode" column renders (these entities carry a code column); real code
  + name values shown.

### master-user-readonly
- Viewport: desktop. realData: yes. mutates: no.
- Open "Asset User" (`/master/user`).
- Expect: real users (name + NIK) render; because User mirrors HRIS it is read-only —
  **no "Tambah" button** and no edit action; the list still loads and searches.

### master-brand-create-verify-delete-roundtrip
- Viewport: desktop. realData: yes. **mutates: yes** (self-cleaning, allowed exception).
- On `/master/brand`: click "Tambah"; in the dialog type Nama `ZZ_IAT_TEST_<timestamp>`;
  click "Simpan" → assert success toast and the new row appears in the list (re-query).
  Then click that row's delete (trash) → confirm in the "Hapus Asset Brand?" dialog
  ("Hapus"). The screen disables-then-deletes; assert a success toast and that the row is
  gone on re-query.
- Cleanup: the delete IS the cleanup; if delete somehow fails, the test must delete the
  `ZZ_IAT_TEST_*` row via the API so no test data is left behind. Never touch any
  pre-existing (non-`ZZ_IAT_TEST`) record.

### master-add-validation-ui-only
- Viewport: desktop. realData: no. mutates: no.
- On `/master/brand`, click "Tambah"; leave Nama empty; click "Simpan".
- Expect: validation toast "Nama wajib diisi"; no request sent; close with "Batal".

### master-edit-dialog-prefill-cancel
- Viewport: desktop. realData: yes. mutates: no.
- On `/master/brand`, click the edit (pencil) icon on an editable row.
- Expect: the dialog opens **pre-filled** with that row's real name; close with "Batal"
  without saving (no update sent — leaves real data untouched).

### master-unknown-entity
- Viewport: desktop. realData: no. mutates: no.
- Navigate to `/master/not-an-entity`.
- Expect: `'not-an-entity' tidak ditemukan.` message with a "Kembali" link to `/master`.

### master-mobile-nav
- Viewport: mobile. realData: yes. mutates: no.
- Reach `/master` via the mobile bottom-nav "Master" tab, then open an entity.
- Expect: hub cards with real counts render and are tappable; the entity list loads.

---

## Request form (`/request`)

### request-form-real-lookups
- Viewport: desktop. realData: yes. mutates: no.
- Navigate to `/request`.
- Expect: "Request Form" heading; Jenis Request select (6 local types) + Company / User /
  Lokasi selects populated from real lookups (`GET /api/assets/lookups` — real companies,
  ~2000+ users, 67 locations); one item row; "Kirim" button. A "Memuat…" placeholder
  shows on the selects while lookups load.

### request-add-remove-item-ui-only
- Viewport: desktop. realData: no. mutates: no.
- On `/request`, click "Tambah Item" to add a second item, then delete it with the trash
  icon.
- Expect: item count grows to 2 then back to 1; when only one item remains, its delete
  button is disabled.

### request-fill-and-validate-ui-only
- Viewport: desktop. realData: yes. **mutates: yes** (UI-level only — NO submit).
- On `/request`, pick a real Company/User/Lokasi and fill item name/brand/qty. First
  clear the item name and click "Kirim" to assert validation, then refill.
- Expect: real dropdown options are selectable; empty item name triggers "Nama item wajib
  diisi"; with a valid item, "Kirim" shows the UI-only success toast ("submit ke backend
  dinonaktifkan untuk IAT") — **no `POST /api/requests` write is performed**.

### request-mobile-layout
- Viewport: mobile. realData: yes. mutates: no.
- On `/request` at 390px.
- Expect: form stacks single-column; item inputs usable; bottom-nav visible; real
  dropdowns still populate.

---

## Print QR (`/print-qr`)

### print-qr-real-list-select-preview
- Viewport: desktop. realData: yes. mutates: no.
- Navigate to `/print-qr`; the selectable list is real assets (`POST /api/assets/search`,
  PageSize 30). Check one or more assets.
- Expect: "Cetak (0)" disabled with nothing selected; checking assets enables "Cetak (n)"
  and renders a QR preview grid, each tile showing the real AssetID + type/model and a QR
  (svg) encoding that AssetID.

### print-qr-search-selectall-clear
- Viewport: desktop. realData: yes. mutates: no.
- On `/print-qr`, type a real fragment to narrow the list; click "Pilih semua"; then
  "Kosongkan".
- Expect: search re-queries and filters checkboxes; "Pilih semua" selects all currently
  visible real rows (selection persists as full rows even if the list changes);
  "Kosongkan" clears the selection and disables "Cetak".

### print-qr-empty-hint
- Viewport: desktop. realData: yes. mutates: no.
- On `/print-qr` with nothing selected.
- Expect: hint "Belum ada aset dipilih. Centang aset di atas untuk melihat pratinjau
  cetak." shown; no preview grid.

### print-qr-from-assets
- Viewport: desktop. realData: no. mutates: no.
- From `/assets`, click the "Print QR" action in the page header.
- Expect: navigates to `/print-qr`.

---

## Navigation & shell

### nav-desktop-sidebar
- Viewport: desktop. realData: yes. mutates: no.
- Logged in, use the left sidebar to visit Dashboard, Manage Asset, Request Form, Master
  Data, Print QR.
- Expect: each link routes correctly and loads real data; the active item is highlighted;
  the sidebar is hidden on mobile widths.

### nav-mobile-bottom
- Viewport: mobile. realData: yes. mutates: no.
- Logged in, use the bottom-nav to visit Dashboard, Asset, Request, Master, Akun.
- Expect: each of the 5 tabs routes correctly; bottom-nav fixed at the bottom; the desktop
  sidebar is not shown; screens render real data.

### nav-unknown-route-redirect
- Viewport: desktop. realData: no. mutates: no.
- Logged in, navigate to `/totally-unknown`.
- Expect: redirected to `/dashboard`.

---

## Account (`/account`)

### account-shows-real-identity
- Viewport: mobile. realData: yes. mutates: no.
- Navigate to `/account`.
- Expect: "Akun" heading; avatar initials; the **real** user name **STEVEN ALEXANDER**
  and NIK `2403077` (from the live session); "Keluar" button present.

---

## Resilience / error states

### error-dashboard-retry
- Viewport: desktop. realData: no. mutates: no.
- Simulate a failed dashboard fetch (e.g. offline / BFF down) on `/dashboard`.
- Expect: an error card "Gagal memuat dashboard" with a "Coba lagi" button that re-issues
  the request when connectivity returns.

### error-assets-retry
- Viewport: desktop. realData: no. mutates: no.
- Simulate a failed `POST /api/assets/search` on `/assets`.
- Expect: error card "Gagal memuat daftar aset" + "Coba lagi"; retry re-fetches.

### error-master-retry
- Viewport: desktop. realData: no. mutates: no.
- Simulate a failed master `/search` on `/master/brand`.
- Expect: error card "Gagal memuat data" + "Coba lagi"; retry re-fetches.
