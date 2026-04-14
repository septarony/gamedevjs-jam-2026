import { memo } from 'react'

const CX = 100
const CY = 106
const R = 78
const NEEDLE_LEN = 65
const SEMI_CIRC = Math.PI * R // ≈ 245
const TICKS = [0, 25, 50, 75, 100]
const ZONES_NORMAL = [
  { start: 0, end: 0.6, color: '#2d6e2d' },
  { start: 0.6, end: 0.8, color: '#b88a10' },
  { start: 0.8, end: 1.0, color: '#9e2510' },
]
const ZONES_INVERT = [
  { start: 0, end: 0.2, color: '#9e2510' },
  { start: 0.2, end: 0.4, color: '#b88a10' },
  { start: 0.4, end: 1.0, color: '#2d6e2d' },
]

/**
 * SteamGauge — analog dial with green / yellow / red zones and a shaking needle.
 *
 * Props:
 *   value  — 0–100  (current reading)
 *   label  — string (caption below the dial)
 *   invert — bool   (flip zones: danger at LOW values, e.g. Stability)
 */
function SteamGauge({ value, label, invert = false }) {
  const clamped = Math.min(100, Math.max(0, value))

  const isDanger = invert ? clamped <= 12 : clamped >= 90
  const isWarning = invert
    ? clamped > 12 && clamped <= 30
    : clamped >= 70 && clamped < 90

  // Needle: −90° at 0 %, 0° at 50 %, +90° at 100 %
  const needleRot = (clamped / 100) * 180 - 90

  // Arc zones (fraction of SEMI_CIRC)
  const zones = invert ? ZONES_INVERT : ZONES_NORMAL

  // SVG arc path: left → top → right (counter-clockwise in screen = sweep 1)
  const arcPath = `M ${CX - R},${CY} A ${R},${R} 0 0,1 ${CX + R},${CY}`

  const valueColor = isDanger ? '#ff7060' : isWarning ? '#f0c040' : '#efe1cc'

  return (
    <div className={`gauge-wrap${isDanger ? ' gauge-danger' : ''}`}>
      <svg
        viewBox="0 0 200 130"
        width="100%"
        role="img"
        aria-label={`${label}: ${clamped}%`}
      >
        {/* ── Outer decorative ring ── */}
        <path
          d={`M ${CX - R - 12},${CY} A ${R + 12},${R + 12} 0 0,1 ${CX + R + 12},${CY}`}
          fill="none"
          stroke="rgba(182,109,59,0.5)"
          strokeWidth={2}
          strokeLinecap="round"
        />

        {/* ── Background track ── */}
        <path
          d={arcPath}
          fill="none"
          stroke="#161412"
          strokeWidth={20}
          strokeLinecap="butt"
        />

        {/* ── Coloured zone arcs ── */}
        {zones.map(({ start, end, color }) => {
          const segLen = (end - start) * SEMI_CIRC
          return (
            <path
              key={start}
              d={arcPath}
              fill="none"
              stroke={color}
              strokeWidth={18}
              strokeLinecap="butt"
              strokeDasharray={`${segLen} 1000`}
              strokeDashoffset={-start * SEMI_CIRC}
            />
          )
        })}

        {/* ── Tick marks at 0 / 25 / 50 / 75 / 100 % ── */}
        {TICKS.map((tick) => {
          const rad = ((180 + tick * 1.8) * Math.PI) / 180
          const isMajor = tick % 50 === 0
          return (
            <line
              key={tick}
              x1={CX + (R - 11) * Math.cos(rad)}
              y1={CY + (R - 11) * Math.sin(rad)}
              x2={CX + (R + 6) * Math.cos(rad)}
              y2={CY + (R + 6) * Math.sin(rad)}
              stroke="rgba(239,225,204,0.65)"
              strokeWidth={isMajor ? 2.5 : 1.5}
            />
          )
        })}

        {/* ── Needle: outer group handles base rotation ── */}
        <g
          style={{
            transform: `rotate(${needleRot}deg)`,
            transformOrigin: `${CX}px ${CY}px`,
            transition: isDanger ? 'none' : 'transform 0.4s ease-out',
          }}
        >
          {/* Inner group adds vibration when in danger */}
          <g
            className={isDanger ? 'gauge-needle-shake' : undefined}
            style={{ transformOrigin: `${CX}px ${CY}px` }}
          >
            <line
              x1={CX}
              y1={CY + 9}
              x2={CX}
              y2={CY - NEEDLE_LEN}
              stroke="#f0d49a"
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          </g>

          {/* Pivot hub — stays centred, does not shake */}
          <circle cx={CX} cy={CY} r={7} fill="#b66d3b" />
          <circle cx={CX} cy={CY} r={3.5} fill="#e8c87a" />
        </g>

        {/* ── Numeric readout ── */}
        <text
          x={CX}
          y={CY + 22}
          textAnchor="middle"
          fill={valueColor}
          fontSize="15"
          fontWeight="bold"
          fontFamily="Cambria, 'Palatino Linotype', serif"
        >
          {clamped}%
        </text>
      </svg>

      <p className="gauge-label">{label}</p>
    </div>
  )
}

export default memo(SteamGauge)
