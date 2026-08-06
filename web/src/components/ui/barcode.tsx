// Minimal Code128-B barcode renderer (SVG, no external dependency).
// Mirrors the legacy AssetEdit.vue <cs-barcode> (vue-barcode) header barcode.
// Only Code128-B (ASCII 32..126) is supported, which covers Asset IDs.

// The 107 Code128 symbol patterns (each is a width string of 6 bar/space widths).
const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312',
  '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222',
  '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131',
  '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321',
  '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121',
  '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321',
  '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224',
  '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114',
  '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112',
  '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113',
  '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412',
  '211214', '211232', '2331112',
]

const START_B = 104
const STOP = 106

/** Build the width sequence for the given Code128-B text. */
function encode(text: string): string {
  const codes: number[] = [START_B]
  let checksum = START_B
  for (let i = 0; i < text.length; i++) {
    const value = text.charCodeAt(i) - 32
    if (value < 0 || value > 94) continue // skip unsupported chars
    codes.push(value)
    checksum += value * (i + 1)
  }
  codes.push(checksum % 103)
  codes.push(STOP)
  return codes.map((c) => PATTERNS[c]).join('')
}

export interface BarcodeProps {
  value: string
  height?: number
  /** Width of a single narrow module, in px. */
  moduleWidth?: number
  className?: string
}

export function Barcode({ value, height = 44, moduleWidth = 1, className }: BarcodeProps) {
  const widths = encode(value)
  const bars: { x: number; w: number }[] = []
  let x = 0
  for (let i = 0; i < widths.length; i++) {
    const w = Number(widths[i]) * moduleWidth
    if (i % 2 === 0) bars.push({ x, w }) // even index = bar, odd = space
    x += w
  }
  const totalWidth = x
  return (
    <svg
      className={className}
      width={totalWidth}
      height={height}
      viewBox={`0 0 ${totalWidth} ${height}`}
      role="img"
      aria-label={`Barcode ${value}`}
    >
      <rect width={totalWidth} height={height} fill="#fff" />
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={height} fill="#000" />
      ))}
    </svg>
  )
}
