import type { Step, Workflow, StepStatus, WorkflowStatus } from './types'

// ── Duration Formatting ───────────────────────────────────────────────

/** Format seconds into human-readable duration: "8s" or "1m 12s" */
export function formatDuration(seconds: number): string {
  if (seconds < 0) return '0s'
  const s = Math.round(seconds)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`
}

// ── Step Counting ─────────────────────────────────────────────────────

interface StepCounts {
  total: number
  completed: number
}

function countSteps(steps: Step[]): StepCounts {
  let total = 0
  let completed = 0
  for (const step of steps) {
    if (step.parallel) {
      for (const child of step.parallel) {
        total++
        if (child.status === 'complete' || child.status === 'skipped') completed++
      }
    } else {
      total++
      if (step.status === 'complete' || step.status === 'skipped') completed++
    }
  }
  return { total, completed }
}

export function getWorkflowProgress(workflow: Workflow): number {
  const { total, completed } = countSteps(workflow.steps)
  return total === 0 ? 0 : Math.round((completed / total) * 100)
}

export function getStepCountText(workflow: Workflow): string {
  const { total, completed } = countSteps(workflow.steps)
  return `${completed}/${total} steps`
}

// ── Backend → Spec Status Mapping ────────────────────────────────────

export function mapStepStatus(backendStatus: string): StepStatus {
  switch (backendStatus) {
    case 'active': return 'running'
    case 'done': return 'complete'
    case 'completed': return 'complete'
    case 'review': return 'waiting_hitl'
    case 'error': return 'failed'
    case 'cancelled': return 'skipped'
    case 'pending': return 'pending'
    default: return 'pending'
  }
}

export function mapWorkflowStatus(backendStatus: string): WorkflowStatus {
  switch (backendStatus) {
    case 'active': return 'running'
    case 'completed': return 'complete'
    case 'done': return 'complete'
    case 'error': return 'failed'
    case 'cancelled': return 'cancelled'
    default: return 'running'
  }
}

// ── Backend → Spec Step Mapping ───────────────────────────────────────

interface BackendStep {
  name?: string
  label?: string
  status?: string
  summary?: string
  started_at?: number | null
  completed_at?: number | null
  substeps?: BackendStep[]
  children?: BackendStep[]
  blocks?: Array<Record<string, unknown>>
  artifacts?: Array<Record<string, unknown>>
  hitl?: Record<string, unknown>
  hidden?: boolean
}

export function mapBackendStep(raw: BackendStep, pathPrefix: string): Step {
  const status = mapStepStatus(String(raw.status ?? 'pending'))

  const step: Step = {
    id: pathPrefix,
    name: String(raw.label ?? raw.name ?? ''),
    status,
    result: (status === 'complete' && raw.summary) ? raw.summary : undefined,
    progressText: (status === 'running' && raw.summary) ? raw.summary : undefined,
    startedAt: raw.started_at ?? undefined,
    completedAt: raw.completed_at ?? undefined,
  }

  if (Array.isArray(raw.artifacts) && raw.artifacts.length > 0) {
    step.artifacts = raw.artifacts.map((a) => ({
      type: String(a['type'] ?? ''),
      title: String(a['title'] ?? ''),
      data: (a['data'] ?? {}) as Record<string, unknown>,
    }))
  }

  if (Array.isArray(raw.blocks) && raw.blocks.length > 0) {
    step.blocks = raw.blocks.map((b) => ({
      type: String(b['type'] ?? ''),
      data: (b['data'] ?? {}) as Record<string, unknown>,
      content: b['content'] as string | undefined,
      display: b['display'] as string | undefined,
      inlineTrigger: b['inlineTrigger'] as Record<string, unknown> | undefined,
    }))
  }

  if (raw.hitl) {
    step.hitl = raw.hitl as unknown as Step['hitl']
  }

  if (Array.isArray(raw.substeps) && raw.substeps.length > 0) {
    step.children = raw.substeps.map((sub, i) =>
      mapBackendStep(sub, `${pathPrefix}/substeps/${i}`)
    )
  }

  if (Array.isArray(raw.children) && raw.children.length > 0) {
    step.parallel = raw.children.map((child, i) =>
      mapBackendStep(child, `${pathPrefix}/children/${i}`)
    )
  }

  return step
}

function applySkippedStatus(steps: Step[]): void {
  let foundError = false
  for (const step of steps) {
    if (foundError && step.status === 'pending') step.status = 'skipped'
    if (step.status === 'failed') foundError = true
  }
}

// ── Full Workflow Mapping ─────────────────────────────────────────────

interface BackendWorkflowProgress {
  title?: string
  status?: string
  started_at?: number | null
  completed_at?: number | null
  steps?: BackendStep[]
}

export function mapActivityToWorkflow(
  progress: BackendWorkflowProgress | Record<string, unknown>,
  opts?: { id?: string; titleFallback?: string },
): Workflow {
  const p = progress as BackendWorkflowProgress
  const steps = (p.steps ?? [])
    .filter((step) => !step.hidden)
    .map((step, i) => mapBackendStep(step, `/steps/${i}`))
  applySkippedStatus(steps)

  return {
    id: opts?.id ?? `wf-${p.title ?? ''}`,
    title: String(p.title ?? opts?.titleFallback ?? ''),
    status: mapWorkflowStatus(String(p.status ?? 'active')),
    steps,
    startedAt: p.started_at ?? undefined,
    completedAt: p.completed_at ?? undefined,
  }
}
