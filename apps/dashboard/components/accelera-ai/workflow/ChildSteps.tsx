'use client'

import React from 'react'
import type { Step } from './types'
import { WorkflowStep } from './WorkflowStep'

/** Nested sequential sub-steps */
export function ChildSteps({ steps }: { steps: Step[] }) {
  return (
    <div className="ml-5 mt-0.5">
      {steps.map((step, i) => (
        <WorkflowStep
          key={step.id}
          step={step}
          isLast={i === steps.length - 1}
          isSubstep
        />
      ))}
    </div>
  )
}
