'use client'

import React from 'react'
import type { Step } from './types'
import { StepIcon } from './StepIcon'
import { ElapsedTimer } from './ElapsedTimer'
import { ChildSteps } from './ChildSteps'
import { ParallelGroup } from './ParallelGroup'

/**
 * Per-step renderer — single-line layout:
 *   icon | name | summary (inline, muted) | "View" link | duration
 *
 * "View" link opens artifact sidebar. Only shown for steps with artifacts.
 */
export function WorkflowStep({
  step,
  isLast = false,
  isParallelChild = false,
  isSubstep = false,
  isSelected = false,
  onSelect,
}: {
  step: Step
  isLast?: boolean
  isParallelChild?: boolean
  isSubstep?: boolean
  isSelected?: boolean
  onSelect?: (step: Step) => void
}) {
  const isComplete = step.status === 'complete'
  const isRunning = step.status === 'running'
  const isPending = step.status === 'pending'
  const isFailed = step.status === 'failed'
  const isSkipped = step.status === 'skipped'
  const isWaitingHitl = step.status === 'waiting_hitl'
  const hasArtifacts = (step.artifacts?.length ?? 0) > 0
  const hasChildren = (step.children?.length ?? 0) > 0

  // Summary text — inline after name
  const summaryText =
    isComplete && step.result
      ? step.result.replace(/\b([0-9a-f]{12,})\b/gi, (m) => m.slice(0, 8) + '…')
      : isRunning && step.progressText
        ? step.progressText
        : null

  // Parallel group — delegate
  if (step.parallel && step.parallel.length > 0) {
    return (
      <div className="relative">
        <div className="flex items-center gap-2 py-0.5">
          <StepIcon status={step.status} />
          <span
            className={`text-[13px] font-medium ${
              isRunning
                ? 'text-gray-800 dark:text-gray-200'
                : isComplete
                  ? 'text-gray-500 dark:text-gray-400'
                  : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            {step.name}
          </span>
        </div>
        <ParallelGroup steps={step.parallel} isLast={isLast} />
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Vertical connector */}
      {!isLast && !isParallelChild && !isSubstep && (
        <div className="absolute left-[9px] top-5 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
      )}

      {/* Single-line step row */}
      <div
        className={`
          flex items-center gap-2 min-w-0
          ${isSubstep ? 'py-px' : 'py-1'}
          ${isPending || isSkipped ? 'opacity-40' : 'opacity-100'}
        `}
      >
        <StepIcon status={step.status} />

        {/* Name */}
        <span
          className={`${isSubstep ? 'text-[12px] text-gray-500 dark:text-gray-400' : 'text-[13px] font-medium'} shrink-0 ${
            isRunning || isWaitingHitl
              ? 'text-gray-800 dark:text-gray-200'
              : isComplete
                ? isSubstep
                  ? 'text-gray-500 dark:text-gray-400'
                  : 'text-gray-700 dark:text-gray-300'
                : isFailed
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-400 dark:text-gray-500'
          }`}
        >
          {step.name}
        </span>

        {/* Inline summary */}
        {summaryText && (
          <span
            className={`${isSubstep ? 'text-[11px]' : 'text-[12px] truncate min-w-0'} ${
              isRunning ? 'text-blue-400 dark:text-blue-300' : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            {summaryText}
          </span>
        )}

        {/* "View" link — only for steps with artifacts */}
        {hasArtifacts && onSelect && (
          <button
            onClick={() => onSelect(step)}
            className="text-[12px] text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 shrink-0"
          >
            View details
          </button>
        )}

        <span className="flex-1" />

        {/* Duration */}
        {isComplete && step.startedAt && step.completedAt && !isSubstep && (
          <span className="text-[12px] text-gray-400 dark:text-gray-500 shrink-0">
            {Math.round((step.completedAt - step.startedAt) / 1000)}s
          </span>
        )}
        {(isRunning || isWaitingHitl) && step.startedAt && !isSubstep && (
          <span className="shrink-0">
            <ElapsedTimer startTime={step.startedAt} />
          </span>
        )}
      </div>

      {/* Error message */}
      {isFailed && step.error && (
        <div className="ml-7 mt-1 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2">
          <p className="text-[12px] text-red-700 dark:text-red-400 font-medium">{step.error.message}</p>
          {step.error.detail && (
            <p className="text-[11px] text-red-500 dark:text-red-500 mt-0.5">{step.error.detail}</p>
          )}
        </div>
      )}

      {/* Children (substeps) — shown while running or waiting */}
      {hasChildren && (isRunning || isWaitingHitl) && step.children && (
        <ChildSteps steps={step.children} />
      )}
    </div>
  )
}
