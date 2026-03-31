'use client'

import React, { useMemo } from 'react'
import { WorkflowCard } from './workflow/WorkflowCard'
import { mapActivityToWorkflow } from './workflow/utils'

/**
 * Bridge between the block registry and WorkflowCard.
 *
 * Receives `data` prop (ACTIVITY_SNAPSHOT payload from agentic service).
 * Parses the workflow steps from the snapshot and renders WorkflowCard.
 */
export function WorkflowProgressBlock({ data }: { data: unknown }) {
  const raw = data as Record<string, unknown> | undefined

  const workflow = useMemo(
    () => (raw?.steps ? mapActivityToWorkflow(raw) : null),
    [raw],
  )

  if (!workflow) return null

  return (
    <WorkflowCard
      workflow={workflow}
      defaultMinimized={workflow.status === 'complete' || workflow.status === 'failed'}
    />
  )
}
