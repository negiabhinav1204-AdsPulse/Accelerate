'use client'

import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import { usePanel } from './PanelContext'

/**
 * Modal panel — centered dialog overlay.
 * Renders modalContent from PanelContext.
 * Place this outside the message list.
 */
export function ModalPanel() {
  const { modalContent, closeModal } = usePanel()
  const isOpen = modalContent !== null

  // Escape key closes modal (Dialog handles this natively, but we sync state)
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, closeModal])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) closeModal() }}>
      <DialogContent className="max-w-2xl max-h-[80vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="flex flex-row items-center justify-between border-b px-5 py-3 shrink-0">
          <DialogTitle className="text-sm font-semibold text-foreground">
            Details
          </DialogTitle>
          <button
            type="button"
            onClick={closeModal}
            aria-label="Close modal"
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {modalContent}
        </div>
      </DialogContent>
    </Dialog>
  )
}
