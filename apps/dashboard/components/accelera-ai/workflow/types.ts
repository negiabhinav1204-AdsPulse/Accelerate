/**
 * Workflow types — ported from the official platform UI.
 * Adapted for TypeScript strict mode (no implicit any).
 */

// ── Status Types ──────────────────────────────────────────────────────

export type WorkflowStatus =
  | 'pending'
  | 'running'
  | 'complete'
  | 'failed'
  | 'waiting_hitl'
  | 'cancelled'

export type StepStatus =
  | 'pending'
  | 'running'
  | 'complete'
  | 'failed'
  | 'waiting_hitl'
  | 'skipped'

// ── Action (for error recovery) ───────────────────────────────────────

export interface WorkflowAction {
  id: string
  label: string
  variant: 'primary' | 'default' | 'danger'
}

// ── HITL Config (matches backend HITLRequest shape) ───────────────────

export interface HITLActionConfig {
  action: string
  label: string
  style?: string
}

export interface HITLConfig {
  hitl_id: string
  type: string
  title: string
  description?: string
  payload?: Record<string, unknown>
  actions: HITLActionConfig[]
  status?: string
  resolved_action?: string
  workflow_step?: string
}

// ── Step Artifact (structured insight data, rendered in sidebar) ──────

export interface Artifact {
  type: string
  title: string
  data: Record<string, unknown>
}

// ── Step Block (UI output attached to a step) ─────────────────────────

export interface StepBlock {
  type: string
  data?: Record<string, unknown>
  content?: string
  display?: string
  inlineTrigger?: Record<string, unknown>
}

// ── Step ──────────────────────────────────────────────────────────────

export interface Step {
  id: string
  name: string
  status: StepStatus
  result?: string           // one-line summary shown when complete
  progressText?: string     // shown while running
  startedAt?: number        // epoch ms
  completedAt?: number
  error?: {
    message: string
    detail?: string
    actions?: WorkflowAction[]
  }
  hitl?: HITLConfig
  blocks?: StepBlock[]
  artifacts?: Artifact[]
  children?: Step[]         // nested sequential sub-steps
  parallel?: Step[]         // concurrent group
}

// ── Workflow ──────────────────────────────────────────────────────────

export interface Workflow {
  id: string
  title: string
  status: WorkflowStatus
  steps: Step[]
  startedAt?: number
  completedAt?: number
  activityType?: string
  runId?: string
  seq?: number
}

// ── Minimize State ────────────────────────────────────────────────────

export type MinimizeState = 'expanded' | 'minimized' | 'user-expanded'
