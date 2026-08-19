// Kapasitas sticker QR dalam SATU halaman A4 (grid 2 kolom) — sumber tunggal
// yang dipakai bersama oleh:
//   - PrintQrScreen  → batas render + export PDF (1 halaman, tak tumpah).
//   - AssetListScreen → batas jumlah aset yang boleh dipilih (tak bisa lebih).
// Ditarik dari dimensi sticker supaya kalau ukuran diubah, kapasitasnya ikut.

const A4_H = 297 // tinggi A4 (mm)
const A4_MARGIN = 12 // margin cetak (mm)
const A4_GAP = 6 // jarak antar-sticker (mm)
const CARD_H = 26 // tinggi 1 sticker (mm)
const COLS = 2 // kolom per baris

// Berapa baris sticker yang muat 1 halaman: n·CARD_H + (n-1)·GAP ≤ tinggi usable.
export const A4_ROWS = Math.floor((A4_H - A4_MARGIN * 2 + A4_GAP) / (CARD_H + A4_GAP))

/** Maksimal sticker QR dalam 1 halaman A4 (grid 2 kolom). Saat ini = 16. */
export const STICKERS_PER_A4 = A4_ROWS * COLS

/** Dimensi kertas A4 (mm) untuk layout PDF. */
export const A4 = { H: A4_H, MARGIN: A4_MARGIN, GAP: A4_GAP, CARD_H, COLS }
