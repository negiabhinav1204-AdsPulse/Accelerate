'use client'

import { useEffect, useState } from 'react'
import { formatDuration } from './utils'

/** Hook: returns seconds elapsed since startTime, updating every 1s */
export function useElapsed(startTime: number | undefined): number {
  const [elapsed, setElapsed] = useState(() =>
    startTime ? Math.max(0, Math.round((Date.now() - startTime) / 1000)) : 0,
  )

  useEffect(() => {
    if (!startTime) return
    const calc = () => Math.max(0, Math.round((Date.now() - startTime) / 1000))
    setElapsed(calc())
    const id = setInterval(() => setElapsed(calc()), 1000)
    return () => clearInterval(id)
  }, [startTime])

  return elapsed
}

/** Live-updating timer display */
export function ElapsedTimer({ startTime }: { startTime: number }) {
  const elapsed = useElapsed(startTime)
  return (
    <span className="text-[11px] text-blue-400 dark:text-blue-300 font-mono tabular-nums">
      {formatDuration(elapsed)}
    </span>
  )
}

/** Static duration display for completed steps */
export function DurationBadge({ seconds }: { seconds: number }) {
  return (
    <span className="text-[11px] text-gray-300 dark:text-gray-500 font-mono tabular-nums">
      {formatDuration(seconds)}
    </span>
  )
}
