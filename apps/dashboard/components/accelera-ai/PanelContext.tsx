'use client'

import {
  createContext,
  useContext,
  useCallback,
  useState,
  type ReactNode,
} from 'react'

// ── Types ─────────────────────────────────────────────────────────────

interface PanelState {
  /** Open a slide-in sidebar panel with arbitrary React content */
  openSidebar: (content: ReactNode, title?: string) => void
  /** Open a modal overlay with arbitrary React content */
  openModal: (content: ReactNode) => void
  /** Close the sidebar panel */
  closePanel: () => void
  /** Close the modal overlay */
  closeModal: () => void
  /** Current sidebar content (null = closed) */
  panelContent: ReactNode | null
  /** Current modal content (null = closed) */
  modalContent: ReactNode | null
  /** Title for the sidebar panel header */
  panelTitle: string
}

// ── Context ───────────────────────────────────────────────────────────

const PanelContext = createContext<PanelState | null>(null)

export function usePanel(): PanelState {
  const ctx = useContext(PanelContext)
  if (!ctx) throw new Error('usePanel must be used within PanelProvider')
  return ctx
}

// ── Provider ──────────────────────────────────────────────────────────

export function PanelProvider({ children }: { children: ReactNode }) {
  const [panelContent, setPanelContent] = useState<ReactNode | null>(null)
  const [modalContent, setModalContent] = useState<ReactNode | null>(null)
  const [panelTitle, setPanelTitle] = useState('Details')

  const openSidebar = useCallback((content: ReactNode, title = 'Details') => {
    setPanelContent(content)
    setPanelTitle(title)
  }, [])

  const openModal = useCallback((content: ReactNode) => {
    setModalContent(content)
  }, [])

  const closePanel = useCallback(() => {
    setPanelContent(null)
  }, [])

  const closeModal = useCallback(() => {
    setModalContent(null)
  }, [])

  return (
    <PanelContext.Provider
      value={{ openSidebar, openModal, closePanel, closeModal, panelContent, modalContent, panelTitle }}
    >
      {children}
    </PanelContext.Provider>
  )
}
