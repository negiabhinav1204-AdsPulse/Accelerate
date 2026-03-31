'use client'

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react'
import { ChevronUp } from 'lucide-react'
import { cn } from '@workspace/ui/lib/utils'
import type { Workflow, Step, MinimizeState } from './types'
import { StatusBadge } from './StatusBadge'
import { ElapsedTimer } from './ElapsedTimer'
import { WorkflowStep } from './WorkflowStep'
import { getStepCountText, formatDuration } from './utils'

/**
 * Root workflow card component.
 *
 * Minimize rules (in priority order):
 *   1. User clicks minimize/expand button → always respected, locks out auto behavior
 *   2. forceMinimize prop (standalone HITL form active) → minimize/restore
 *   3. Terminal status transition (complete/failed/waiting_hitl) → expand once
 *   4. defaultMinimized prop (page reload) → initial state only
 *   NO auto-minimize timer — card stays expanded while running.
 */
export function WorkflowCard({
  workflow,
  defaultMinimized = false,
  forceMinimize = false,
  onStepSelect,
  selectedStepId,
}: {
  workflow: Workflow
  defaultMinimized?: boolean
  forceMinimize?: boolean
  onStepSelect?: (step: Step) => void
  selectedStepId?: string
}) {
  const [minimizeState, setMinimizeState] = useState<MinimizeState>(
    defaultMinimized ? 'minimized' : 'expanded',
  )
  const hasUserInteracted = useRef(false)
  const expandedRef = useRef<HTMLDivElement>(null)

  // External forceMinimize (e.g. standalone HITL form is active)
  const prevForceMinimize = useRef(forceMinimize)
  useEffect(() => {
    if (hasUserInteracted.current) return
    if (forceMinimize && !prevForceMinimize.current) {
      setMinimizeState('minimized')
    } else if (!forceMinimize && prevForceMinimize.current) {
      setMinimizeState('expanded')
    }
    prevForceMinimize.current = forceMinimize
  }, [forceMinimize])

  const isMinimized = minimizeState === 'minimized'

  // Auto-expand on terminal status transition (once)
  const prevStatusRef = useRef(workflow.status)
  useEffect(() => {
    const prevStatus = prevStatusRef.current
    prevStatusRef.current = workflow.status

    if (hasUserInteracted.current) return

    if (
      prevStatus === 'running' &&
      (workflow.status === 'waiting_hitl' ||
        workflow.status === 'complete' ||
        workflow.status === 'failed')
    ) {
      setMinimizeState('expanded')
    }
  }, [workflow.status])

  // Scroll expanded card into view
  const prevMinimized = useRef(isMinimized)
  useEffect(() => {
    if (prevMinimized.current && !isMinimized && expandedRef.current) {
      requestAnimationFrame(() => {
        expandedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    }
    prevMinimized.current = isMinimized
  }, [isMinimized])

  const handleExpand = useCallback(() => {
    hasUserInteracted.current = true
    setMinimizeState('user-expanded')
  }, [])

  const handleMinimize = useCallback(() => {
    hasUserInteracted.current = true
    setMinimizeState('minimized')
  }, [])

  // Calculate total duration
  let totalDuration: number | undefined
  if (workflow.completedAt && workflow.startedAt) {
    totalDuration = Math.round((workflow.completedAt - workflow.startedAt) / 1000)
  }

  if (isMinimized) {
    return (
      <div
        onClick={handleExpand}
        className="flex items-center gap-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors max-w-lg"
      >
        <span className="text-[13px] font-medium text-gray-700 dark:text-gray-300 flex-1 truncate">
          {workflow.title}
        </span>
        <StatusBadge status={workflow.status} duration={totalDuration} />
        <span className="text-[12px] text-gray-400 dark:text-gray-500">
          {getStepCountText(workflow)}
        </span>
        <ChevronUp className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 rotate-180" />
      </div>
    )
  }

  return (
    <div
      ref={expandedRef}
      className={cn(
        'max-w-lg rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden',
      )}
    >
      {/* Header */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 truncate flex-1">
            {workflow.title}
          </span>

          {workflow.status === 'running' && workflow.startedAt && (
            <ElapsedTimer startTime={workflow.startedAt} />
          )}

          <StatusBadge status={workflow.status} duration={totalDuration} />
        </div>
      </div>

      {/* Steps */}
      <div className="border-t border-gray-100 dark:border-gray-800 px-5 py-3 space-y-1">
        {workflow.steps.map((step, i) => (
          <WorkflowStep
            key={step.id}
            step={step}
            isLast={i === workflow.steps.length - 1}
            isSelected={step.id === selectedStepId}
            onSelect={onStepSelect}
          />
        ))}
      </div>

      {/* Minimize footer */}
      <div
        onClick={handleMinimize}
        className="border-t border-gray-100 dark:border-gray-800 px-5 py-2.5 flex items-center justify-between cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <span className="text-[13px] text-gray-400 dark:text-gray-500 font-medium">
          Collapse
        </span>
        <ChevronUp className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
      </div>
    </div>
  )
}
