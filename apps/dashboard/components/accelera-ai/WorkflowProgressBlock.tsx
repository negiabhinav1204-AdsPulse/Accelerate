'use client'

import React, { useMemo, useCallback } from 'react'
import { WorkflowCard } from './workflow/WorkflowCard'
import { StepArtifactPanel } from './workflow/StepArtifactPanel'
import { mapActivityToWorkflow } from './workflow/utils'
import { usePanel } from './PanelContext'
import type { Step } from './workflow/types'

/**
 * Bridge between the block registry and WorkflowCard.
 *
 * Receives `data` prop (ACTIVITY_SNAPSHOT payload from agentic service).
 * Parses the workflow steps from the snapshot and renders WorkflowCard.
 * Steps with artifacts get a "View details" link that opens StepArtifactPanel
 * in the sidebar.
 */
export function WorkflowProgressBlock({ data }: { data: unknown }) {
  const raw = data as Record<string, unknown> | undefined
  const { openSidebar, closePanel } = usePanel()

  const workflow = useMemo(
    () => (raw?.steps ? mapActivityToWorkflow(raw) : null),
    [raw],
  )

  const handleStepSelect = useCallback(
    (step: Step) => {
      openSidebar(<StepArtifactPanel step={step} onClose={closePanel} />)
    },
    [openSidebar, closePanel],
  )

  if (!workflow) return null

  return (
    <WorkflowCard
      workflow={workflow}
      defaultMinimized={workflow.status === 'complete' || workflow.status === 'failed'}
      onStepSelect={handleStepSelect}
    />
  )
}
