import type { ReactNode } from 'react'

const ray = (angle: number, from: number, to: number, cx = 12, cy = 12) => {
  const a = (angle * Math.PI) / 180
  return `M${cx + from * Math.cos(a)} ${cy + from * Math.sin(a)}L${cx + to * Math.cos(a)} ${cy + to * Math.sin(a)}`
}

/** Five-point star around (cx, cy). */
const star = (cx: number, cy: number, r: number) =>
  Array.from({ length: 10 }, (_, i) => {
    const a = ((i * 36 - 90) * Math.PI) / 180
    const d = i % 2 ? r * 0.42 : r
    return `${i ? 'L' : 'M'}${(cx + d * Math.cos(a)).toFixed(2)} ${(cy + d * Math.sin(a)).toFixed(2)}`
  }).join('') + 'Z'

/**
 * One picture per month, in color (24×24, flat fills, legible on light and dark):
 * January's birthday cake, February's balloons for our son's birthday, then the seasons —
 * spring flowers, summer sun, autumn leaves, a Halloween pumpkin, a New Year tree.
 */
const ICONS: ReactNode[] = [
  // Январь — торт с днём рождения
  <>
    <rect x="2.5" y="19.5" width="19" height="1.6" rx="0.8" fill="#b0bec5" />
    <rect x="4" y="12" width="16" height="7.5" rx="1.5" fill="#f48fb1" />
    <path
      d="M4 13.8a1.8 1.8 0 0 1 1.8-1.8h12.4a1.8 1.8 0 0 1 1.8 1.8v1.4c-.9.9-1.8.9-2.7 0s-1.8-.9-2.7 0-1.8.9-2.6 0-1.8-.9-2.7 0-1.8.9-2.6 0-1.8-.9-2.7 0Z"
      fill="#fff3e0"
    />
    <g fill="#7e57c2">
      <rect x="6.5" y="16.5" width="1.6" height="1" rx="0.5" />
      <rect x="11.2" y="17.3" width="1.6" height="1" rx="0.5" />
      <rect x="15.9" y="16.5" width="1.6" height="1" rx="0.5" />
    </g>
    <rect x="11" y="6.8" width="2" height="5.2" rx="0.6" fill="#64b5f6" />
    <path d="M12 2.3c1.3 1.5 1.9 2.6 1.9 3.3a1.9 1.9 0 0 1-3.8 0c0-.7.6-1.8 1.9-3.3Z" fill="#ffb300" />
  </>,
  // Февраль — шарики на день рождения сына
  <>
    <path d="M9 13.6c.4 3 2.4 4.6 3 8.4M15.6 11.6c-.6 3.6-3 5.6-3.6 10.4" stroke="#90a4ae" strokeWidth="1" fill="none" strokeLinecap="round" />
    <ellipse cx="15.6" cy="6.9" rx="4.1" ry="4.8" fill="#66bb6a" />
    <path d="M15.6 11.5l-1 1.3h2Z" fill="#66bb6a" />
    <ellipse cx="9" cy="8.4" rx="4.6" ry="5.4" fill="#42a5f5" />
    <path d="M9 13.6l-1.1 1.4h2.2Z" fill="#42a5f5" />
    <ellipse cx="7.3" cy="6.4" rx="1.1" ry="1.7" fill="#fff" opacity="0.55" transform="rotate(25 7.3 6.4)" />
    <ellipse cx="14.3" cy="5.2" rx="0.9" ry="1.4" fill="#fff" opacity="0.5" transform="rotate(25 14.3 5.2)" />
  </>,
  // Март — тюльпан
  <>
    <rect x="11.25" y="11" width="1.5" height="10.5" rx="0.75" fill="#43a047" />
    <path d="M12 19.5c-3.2 0-5.3-2-5.8-4.8 3 0 5.1 1.7 5.8 4.8Z" fill="#66bb6a" />
    <path d="M12 17.5c.7-3 2.8-4.6 5.8-4.6-.5 2.7-2.6 4.6-5.8 4.6Z" fill="#4caf50" />
    <path d="M6.8 4.5 9.4 7 12 3.4 14.6 7l2.6-2.5v4.6a5.2 5.2 0 0 1-10.4 0Z" fill="#ec407a" />
    <path d="M12 3.4 14.6 7 12 9.5 9.4 7Z" fill="#f06292" />
  </>,
  // Апрель — росток и капля
  <>
    <path d="M3.5 21.5a8.5 3.2 0 0 1 17 0Z" fill="#8d6e63" />
    <rect x="11.3" y="10.5" width="1.4" height="10" rx="0.7" fill="#66bb6a" />
    <path d="M12 13.5c-4 0-6.6-2.5-7.1-6.2 4 0 6.6 2.2 7.1 6.2Z" fill="#81c784" />
    <path d="M12 11.2c.5-4 3.1-6.6 7.1-7-.3 4-3 6.7-7.1 7Z" fill="#43a047" />
    <path d="M19 13.3c1 1.4 1.6 2.3 1.6 3a1.6 1.6 0 0 1-3.2 0c0-.7.6-1.6 1.6-3Z" fill="#4fc3f7" />
  </>,
  // Май — цветущая вишня
  <>
    <g fill="#f8bbd0">
      {[0, 72, 144, 216, 288].map((a) => (
        <circle key={a} cx="12" cy="7.6" r="3.6" transform={`rotate(${a} 12 12)`} />
      ))}
    </g>
    <circle cx="12" cy="12" r="3.3" fill="#f48fb1" />
    <g fill="#d81b60">
      {[36, 108, 180, 252, 324].map((a) => (
        <circle key={a} cx="12" cy="8.9" r="0.65" transform={`rotate(${a} 12 12)`} />
      ))}
    </g>
    <circle cx="12" cy="12" r="1.7" fill="#ffca28" />
  </>,
  // Июнь — солнце
  <>
    <g stroke="#ffb300" strokeWidth="2" strokeLinecap="round">
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <path key={a} d={ray(a, 7.3, 10)} />
      ))}
    </g>
    <circle cx="12" cy="12" r="5" fill="#ffc107" />
    <circle cx="10.3" cy="10.3" r="1.4" fill="#fff" opacity="0.45" />
  </>,
  // Июль — солнце над морем
  <>
    <g stroke="#ffa000" strokeWidth="1.8" strokeLinecap="round">
      {[180, 210, 240, 270, 300, 330, 0].map((a) => (
        <path key={a} d={ray(a, 6.6, 9, 12, 10.5)} />
      ))}
    </g>
    <path d="M7 14.2a5 5 0 1 1 10 0Z" fill="#ffb300" />
    <path
      d="M2 16.8c1.7 0 1.7-1.4 3.3-1.4s1.7 1.4 3.4 1.4 1.6-1.4 3.3-1.4 1.7 1.4 3.3 1.4 1.7-1.4 3.4-1.4 1.6 1.4 3.3 1.4"
      stroke="#29b6f6" strokeWidth="2" strokeLinecap="round" fill="none"
    />
    <path
      d="M2 20.6c1.7 0 1.7-1.4 3.3-1.4s1.7 1.4 3.4 1.4 1.6-1.4 3.3-1.4 1.7 1.4 3.3 1.4 1.7-1.4 3.4-1.4 1.6 1.4 3.3 1.4"
      stroke="#0288d1" strokeWidth="2" strokeLinecap="round" fill="none"
    />
  </>,
  // Август — подсолнух
  <>
    <g fill="#fbc02d">
      {Array.from({ length: 12 }, (_, i) => (
        <ellipse key={i} cx="12" cy="4.9" rx="1.9" ry="3.3" transform={`rotate(${i * 30} 12 12)`} />
      ))}
    </g>
    <circle cx="12" cy="12" r="4.4" fill="#6d4c41" />
    <g fill="#4e342e">
      <circle cx="10.6" cy="11" r="0.7" />
      <circle cx="13.3" cy="11.2" r="0.7" />
      <circle cx="12" cy="13.4" r="0.7" />
    </g>
  </>,
  // Сентябрь — листья
  <>
    <path d="M20 20C20 12.5 15.4 7.6 7 7.6c0 8 4.7 12.4 13 12.4Z" fill="#fdd835" />
    <path d="M20 20 11 11.3" stroke="#f9a825" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M4 20C4 10.8 9.2 4 19.5 4c0 10-6 16-15.5 16Z" fill="#fb8c00" />
    <path d="M4 20 14 10" stroke="#e65100" strokeWidth="1.3" strokeLinecap="round" />
  </>,
  // Октябрь — тыква-фонарь на Хэллоуин
  <>
    <path d="M11.2 8c0-2.2.6-3.9 2.8-5l.9 1.3c-1.4.9-1.8 2-1.8 3.7Z" fill="#558b2f" />
    <ellipse cx="8.4" cy="14.3" rx="5.2" ry="6.6" fill="#ef6c00" />
    <ellipse cx="15.6" cy="14.3" rx="5.2" ry="6.6" fill="#ef6c00" />
    <ellipse cx="12" cy="14.3" rx="4.3" ry="7" fill="#fb8c00" />
    <g fill="#ffe082">
      <path d="M6.9 13.2 9 10l2.1 3.2Z" />
      <path d="M12.9 13.2 15 10l2.1 3.2Z" />
      <path d="M6.6 15.6c1.6 3.4 9.2 3.4 10.8 0l-1.9.5-.9 1.1-1-1h-3.2l-1 1-.9-1.1Z" />
    </g>
  </>,
  // Ноябрь — дождь и последний лист
  <>
    <g fill="#90a4ae">
      <circle cx="7.8" cy="10.3" r="3.6" />
      <circle cx="12.8" cy="7.8" r="4.6" />
      <circle cx="17.2" cy="10.9" r="3" />
      <rect x="7.8" y="9.9" width="9.4" height="4" />
    </g>
    <g stroke="#4fc3f7" strokeWidth="1.6" strokeLinecap="round">
      <path d="M7.5 16.5 6.6 19M11.3 16.5l-1.2 3.4M8.9 20.9l-.4 1" />
    </g>
    <path d="M14.2 22.2c0-3.3 2.2-5.4 6-5.9 0 3.7-2.2 5.9-6 5.9Z" fill="#d84315" />
    <path d="M14.2 22.2 18.1 18.4" stroke="#8d2f0c" strokeWidth="0.9" strokeLinecap="round" />
  </>,
  // Декабрь — новогодняя ёлка
  <>
    <rect x="10.6" y="19.6" width="2.8" height="2.9" rx="0.5" fill="#795548" />
    <path d="M12 4.2 16.8 10h-2.1l4 5h-2.4l3.5 4.9H4.2L7.7 15H5.3l4-5H7.2Z" fill="#43a047" />
    <circle cx="10.3" cy="12.4" r="0.95" fill="#e53935" />
    <circle cx="13.9" cy="15.8" r="0.95" fill="#ffca28" />
    <circle cx="9.1" cy="17.6" r="0.95" fill="#ffca28" />
    <circle cx="15.8" cy="18.3" r="0.95" fill="#e53935" />
    <circle cx="13.2" cy="9.2" r="0.85" fill="#29b6f6" />
    <path d={star(12, 3.6, 2.7)} fill="#ffca28" />
  </>,
]

export function MonthIcon({ month }: { month: number }) {
  return (
    <svg className="month-icon" viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[month]}
    </svg>
  )
}
