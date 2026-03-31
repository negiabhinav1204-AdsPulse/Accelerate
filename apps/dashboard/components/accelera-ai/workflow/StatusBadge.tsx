'use client'

import React from 'react'
import type { WorkflowStatus } from './types'
import { formatDuration } from './utils'

export function StatusBadge({
  status,
  duration,
}: {
  status: WorkflowStatus
  duration?: number
}) {
  switch (status) {
    case 'running':
      return (
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
          Running
        </span>
      )
    case 'complete':
      return (
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
          Complete{duration != null ? ` · ${formatDuration(duration)}` : ''}
        </span>
      )
    case 'waiting_hitl':
      return (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          Waiting
        </span>
      )
    case 'failed':
      return (
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
          Failed
        </span>
      )
    case 'cancelled':
      return (
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          Cancelled
        </span>
      )
    default:
      return null
  }
}
