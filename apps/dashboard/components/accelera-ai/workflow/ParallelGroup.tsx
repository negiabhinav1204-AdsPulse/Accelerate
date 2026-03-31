'use client'

import React from 'react'
import type { Step } from './types'
import { WorkflowStep } from './WorkflowStep'

/** Concurrent task container with blue left border */
export function ParallelGroup({
  steps,
  isLast,
}: {
  steps: Step[]
  isLast?: boolean
}) {
  const completed = steps.filter((s) => s.status === 'complete').length
  const total = steps.length

  return (
    <div className="ml-2.5 border-l-2 border-blue-200 bg-blue-50/30 rounded-r-lg pl-3 py-2 dark:border-blue-700 dark:bg-blue-900/10">
      <div className="text-[11px] font-medium text-blue-500 dark:text-blue-400 mb-2">
        Running in parallel — {completed}/{total} complete
      </div>
      <div className="space-y-1.5">
        {steps.map((step, i) => (
          <WorkflowStep
            key={step.id}
            step={step}
            isLast={i === steps.length - 1}
            isParallelChild
          />
        ))}
      </div>
    </div>
  )
}
