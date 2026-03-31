'use client'

import React from 'react'
import { Check, AlertCircle, Minus, Pause } from 'lucide-react'
import type { StepStatus } from './types'

const sizeClasses = {
  sm: 'h-5 w-5',
  lg: 'h-6 w-6',
} as const

const iconSizes = {
  sm: 'h-3 w-3',
  lg: 'h-3.5 w-3.5',
} as const

export function StepIcon({
  status,
  size = 'sm',
}: {
  status: StepStatus
  size?: 'sm' | 'lg'
}) {
  const s = sizeClasses[size]
  const iconS = iconSizes[size]

  switch (status) {
    case 'complete':
      return (
        <div className={`flex ${s} shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40`}>
          <Check className={`${iconS} text-emerald-600 dark:text-emerald-400`} strokeWidth={3} />
        </div>
      )
    case 'running':
      return (
        <div className={`${s} shrink-0 rounded-full border-2 border-blue-200 border-t-blue-500 animate-spin dark:border-blue-700 dark:border-t-blue-400`} />
      )
    case 'failed':
      return (
        <div className={`flex ${s} shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40`}>
          <AlertCircle className={`${iconS} text-red-600 dark:text-red-400`} strokeWidth={3} />
        </div>
      )
    case 'waiting_hitl':
      return (
        <div className={`flex ${s} shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40`}>
          <Pause className={`${iconS} text-amber-600 dark:text-amber-400`} strokeWidth={3} />
        </div>
      )
    case 'skipped':
      return (
        <div className={`flex ${s} shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800`}>
          <Minus className={`${iconS} text-gray-400 dark:text-gray-500`} strokeWidth={3} />
        </div>
      )
    default: // pending
      return (
        <div className={`${s} shrink-0 rounded-full border-2 border-gray-200 dark:border-gray-600`} />
      )
  }
}
