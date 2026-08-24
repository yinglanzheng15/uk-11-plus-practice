/**
 * Reusable SVG building blocks for Non-Verbal Reasoning figures.
 *
 * Every NVR question before this was hand-drawn: coordinates worked out by
 * hand for each new shape, rotation, mirror and layout (see ROADMAP.md §6).
 * That does not scale and is easy to get subtly wrong. These are ordinary
 * pure functions that return the same inline SVG markup the app already
 * renders as-is via `question.figure` / `question.optionFigures` (see
 * QuestionCard.tsx) — nothing about how a question is authored or served
 * changes, only how the SVG strings inside it get built.
 *
 * Every single-shape icon lives in a 100×100 viewBox, matching the
 * hand-drawn figures already in non-verbal-reasoning.json, so a generated
 * shape sits at the same visual scale as an existing one.
 */

const SHAPE_ATTRS =
  "fill='none' stroke='currentColor' stroke-width='4' stroke-linejoin='round' stroke-linecap='round'"

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Corner points of a regular polygon, apex pointing up by default (the same
 * convention every hand-drawn polygon in the bank already follows).
 */
export function polygonPoints(sides: number, radius = 34, rotationDeg = -90): string {
  if (sides < 3) throw new Error('a polygon needs at least 3 sides')
  const points: string[] = []
  for (let i = 0; i < sides; i += 1) {
    const angle = ((rotationDeg + (360 / sides) * i) * Math.PI) / 180
    const x = round1(50 + radius * Math.cos(angle))
    const y = round1(50 + radius * Math.sin(angle))
    points.push(`${x},${y}`)
  }
  return points.join(' ')
}

/** One filled dot — the unit every "how many dots" figure in the bank is built from. */
export function dot(cx: number, cy: number, r = 8): string {
  return `<circle cx='${round1(cx)}' cy='${round1(cy)}' r='${r}' fill='currentColor' stroke='none'/>`
}

/** `n` dots evenly spaced along one horizontal row. */
export function dotRow(n: number, y = 68, r = 4.2): string {
  if (n <= 0) return ''
  if (n === 1) return dot(50, y, r)
  const x0 = 22
  const x1 = 78
  const parts: string[] = []
  for (let i = 0; i < n; i += 1) parts.push(dot(x0 + (i * (x1 - x0)) / (n - 1), y, r))
  return parts.join('')
}

/**
 * The guts of a single regular polygon (sides ≥ 3) or, with `sides` omitted,
 * a circle — no `<svg>` wrapper. Use this (not `shapeIcon`) inside
 * `sequenceStrip` / `analogyStrip` / `gridStrip`: those already wrap each
 * cell in its own `<svg>`, and nesting another full `shapeIcon` inside a
 * cell nests `<svg>` inside `<svg>`, which renders broken in practice —
 * `shapeIcon` is for a standalone `figure` or `optionFigures` entry only.
 */
export function shapeMarkup(opts: {
  sides?: number
  radius?: number
  rotationDeg?: number
  shaded?: boolean
  mirror?: boolean
  extra?: string
}): string {
  const { sides, radius = 34, rotationDeg = -90, shaded = false, mirror = false, extra = '' } = opts
  const fill = shaded ? " fill='currentColor' fill-opacity='0.28'" : ''
  const body = sides
    ? `<polygon points='${polygonPoints(sides, radius, rotationDeg)}'${fill}/>`
    : `<circle cx='50' cy='50' r='${radius}'${fill}/>`
  return mirror ? `<g transform='scale(-1,1) translate(-100,0)'>${body}${extra}</g>` : `${body}${extra}`
}

/** A single regular polygon (sides ≥ 3) or, with `sides` omitted, a circle, as a standalone 100×100 figure. */
export function shapeIcon(opts: Parameters<typeof shapeMarkup>[0]): string {
  return svg(shapeMarkup(opts))
}

/** Two shapes layered in one figure — the target for "which contains this shape" questions. */
export function overlayIcon(back: { sides?: number; radius?: number; shaded?: boolean }, front: {
  sides?: number
  radius?: number
  shaded?: boolean
}): string {
  const layer = (o: typeof back, opacity: number) => {
    const fill = o.shaded ? ` fill='currentColor' fill-opacity='${opacity}'` : ''
    return o.sides
      ? `<polygon points='${polygonPoints(o.sides, o.radius ?? 34)}'${fill}/>`
      : `<circle cx='50' cy='50' r='${o.radius ?? 34}'${fill}/>`
  }
  return svg(`${layer(back, 0.18)}${layer(front, 0.4)}`)
}

/**
 * The guts of a simple pennant on a pole — deliberately asymmetric (no line
 * of symmetry), so its mirror image is never the same as any rotation of
 * itself. Corner-shaded squares and plain arrows both fail this — rotating
 * them by some multiple of 90° reproduces their own mirror image, which
 * makes them useless for testing reflection specifically. This is the one
 * shape in the library built for that. No `<svg>` wrapper — see
 * `shapeMarkup` above for why that matters inside a strip or grid cell.
 */
export function flagMarkup(opts: { side?: 'left' | 'right'; rotationDeg?: number } = {}): string {
  const { side = 'right', rotationDeg = 0 } = opts
  const pole = "<line x1='35' y1='15' x2='35' y2='85'/>"
  const pennant =
    side === 'right'
      ? "<polygon points='35,15 65,25 35,35' fill='currentColor' fill-opacity='0.28'/>"
      : "<polygon points='35,15 5,25 35,35' fill='currentColor' fill-opacity='0.28'/>"
  return rotationDeg
    ? `<g transform='rotate(${rotationDeg} 50 50)'>${pole}${pennant}</g>`
    : `${pole}${pennant}`
}

/** A pennant on a pole, as a standalone 100×100 figure. */
export function flagIcon(opts?: Parameters<typeof flagMarkup>[0]): string {
  return svg(flagMarkup(opts))
}

/** The guts of an arrow rotated clockwise by `rotationDeg` from pointing up. No `<svg>` wrapper — see `shapeMarkup` above. */
export function arrowMarkup(rotationDeg = 0): string {
  return (
    `<g transform='rotate(${rotationDeg} 50 50)'>` +
    "<line x1='50' y1='82' x2='50' y2='26'/><polyline points='34,44 50,26 66,44'/>" +
    '</g>'
  )
}

/** An arrow, as a standalone 100×100 figure — the shape every Sequences rotation question already uses. */
export function arrowIcon(rotationDeg = 0): string {
  return svg(arrowMarkup(rotationDeg))
}

function svg(inner: string): string {
  return `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg' ${SHAPE_ATTRS}>${inner}</svg>`
}

/**
 * One cell of a strip or grid: `inner` markup scaled into a `size`×`size`
 * box at (x, y). `inner` must be bare markup (`<polygon>`, `<g>`, …) — pass
 * `shapeMarkup`/`flagMarkup`/`arrowMarkup`, not `shapeIcon`/`flagIcon`/
 * `arrowIcon`. Those wrap their own `<svg>`, and nesting one inside this
 * cell's `<svg>` renders broken (browsers do not scale a doubly-nested SVG
 * the way this needs).
 */
function cell(x: number, y: number, size: number, inner: string): string {
  return `<svg x='${x}' y='${y}' width='${size}' height='${size}' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg' ${SHAPE_ATTRS}>${inner}</svg>`
}

function arrowGlyphAt(x: number, y = 60): string {
  return `<text x='${x}' y='${y}' font-size='40' text-anchor='middle' fill='currentColor' stroke='none'>&#8594;</text>`
}

function placeholder(x: number, y: number, size: number): string {
  return (
    `<rect x='${x}' y='${y}' width='${size}' height='${size}' rx='8' stroke-dasharray='6 6' stroke-width='3' fill='none' stroke='currentColor'/>` +
    `<text x='${x + size / 2}' y='${y + size * 0.69}' font-size='${size * 0.575}' text-anchor='middle' fill='currentColor' stroke='none'>?</text>`
  )
}

/**
 * A horizontal strip showing each of `cells` in turn, ending in a dashed
 * placeholder — the layout every Sequences question uses. Each cell must be
 * bare markup, e.g. from `shapeMarkup`/`flagMarkup`/`arrowMarkup` — see
 * `cell` above for why the `*Icon` functions do not work here.
 */
export function sequenceStrip(cells: string[]): string {
  const width = (cells.length + 1) * 100 + 20
  const parts = cells.map((inner, i) => cell(i * 100, 8, 80, inner))
  parts.push(placeholder(cells.length * 100 + 20, 8, 80))
  return `<svg viewBox='0 0 ${width} 96' xmlns='http://www.w3.org/2000/svg' fill='none' stroke='currentColor' stroke-width='4'>${parts.join('')}</svg>`
}

/**
 * "first → second, third → ?" — the layout every Figure pairs question
 * uses. `firstAfter` is shown in full; the pair starting from `secondBefore`
 * ends in a placeholder for the child to complete.
 */
export function analogyStrip(firstBefore: string, firstAfter: string, secondBefore: string): string {
  const parts = [
    cell(0, 8, 80, firstBefore),
    arrowGlyphAt(100),
    cell(120, 8, 80, firstAfter),
    cell(250, 8, 80, secondBefore),
    arrowGlyphAt(350),
    placeholder(372, 8, 80),
  ]
  return `<svg viewBox='0 0 500 96' xmlns='http://www.w3.org/2000/svg' fill='none' stroke='currentColor' stroke-width='4'>${parts.join('')}</svg>`
}

/**
 * A `rows`×`cols` grid of `cells`, with the cell at `missingIndex` replaced
 * by a dashed placeholder — for matrix / grid-completion questions. Each
 * cell must be bare markup (see `sequenceStrip` above).
 */
export function gridStrip(
  cells: string[],
  rows: number,
  cols: number,
  missingIndex: number,
): string {
  const size = 90
  const gap = 10
  const width = cols * size + (cols - 1) * gap
  const height = rows * size + (rows - 1) * gap
  const parts = cells.map((inner, i) => {
    const x = (i % cols) * (size + gap)
    const y = Math.floor(i / cols) * (size + gap)
    return i === missingIndex ? placeholder(x, y, size) : cell(x, y, size, inner)
  })
  return `<svg viewBox='0 0 ${width} ${height}' xmlns='http://www.w3.org/2000/svg' fill='none' stroke='currentColor' stroke-width='4'>${parts.join('')}</svg>`
}

const NET_SQUARE = 22
const NET_ATTRS = "fill='none' stroke='currentColor' stroke-width='3'"

function netSquares(cells: [number, number][], shaded: Set<number> = new Set()): string {
  const parts = cells.map(([col, row], i) => {
    const fill = shaded.has(i) ? " fill='currentColor' fill-opacity='0.28'" : ''
    return `<rect x='${4 + col * NET_SQUARE}' y='${4 + row * NET_SQUARE}' width='${NET_SQUARE}' height='${NET_SQUARE}'${fill}/>`
  })
  return parts.join('')
}

/**
 * A cross-shaped six-square net — one of the eleven arrangements that
 * actually folds into a cube without overlap. `shadedIndex` marks one face,
 * numbered along the arm (0 = the lone side square) then the crossbar
 * left-to-right, then the last arm — useful for a "which face ends up
 * opposite the shaded one" style question later; unused questions can omit it.
 */
export function cubeNetSvg(shadedIndex?: number): string {
  const cells: [number, number][] = [
    [0, 1],
    [1, 0],
    [1, 1],
    [2, 1],
    [3, 1],
    [1, 2],
  ]
  const shaded = shadedIndex === undefined ? new Set<number>() : new Set([shadedIndex])
  return `<svg viewBox='0 0 100 90' xmlns='http://www.w3.org/2000/svg' ${NET_ATTRS}>${netSquares(cells, shaded)}</svg>`
}

/**
 * A six-or-seven-square arrangement that does *not* fold into a cube —
 * plausible distractors for "which of these is a real net" questions.
 * `row` and `block` are both the right square count (six) but too "thick" or
 * too straight to fold without overlapping; `extraSquare` is simply the
 * wrong count.
 */
export function invalidNetSvg(variant: 'row' | 'block' | 'extra-square' | 'missing-square'): string {
  const layouts: Record<typeof variant, [number, number][]> = {
    row: [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
      [5, 0],
    ],
    block: [
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    'extra-square': [
      [0, 1],
      [1, 0],
      [1, 1],
      [2, 1],
      [3, 1],
      [1, 2],
      [3, 2],
    ],
    'missing-square': [
      [0, 1],
      [1, 0],
      [1, 1],
      [2, 1],
      [1, 2],
    ],
  }
  return `<svg viewBox='0 0 130 90' xmlns='http://www.w3.org/2000/svg' ${NET_ATTRS}>${netSquares(layouts[variant])}</svg>`
}
