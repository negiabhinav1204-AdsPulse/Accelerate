'use client'

import React, { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@workspace/ui/components/sheet'
import { usePanel } from './PanelContext'

/**
 * Sidebar panel — 480px wide slide-in from the right.
 * Renders panelContent from PanelContext.
 * Place this outside the message list, as a sibling to the chat column.
 */
export function SidebarPanel() {
  const { panelContent, panelTitle, closePanel } = usePanel()
  const isOpen = panelContent !== null

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) closePanel() }}>
      <SheetContent
        side="right"
        className="w-[480px] max-w-full p-0 flex flex-col"
      >
        <SheetHeader className="flex flex-row items-center justify-between border-b px-5 py-3 shrink-0">
          <SheetTitle className="text-sm font-semibold text-foreground">
            {panelTitle}
          </SheetTitle>
          <button
            type="button"
            onClick={closePanel}
            aria-label="Close panel"
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </SheetHeader>
        {/* p-0: each panel component manages its own padding and scroll */}
        <div className="flex-1 overflow-y-auto">
          {panelContent}
        </div>
      </SheetContent>
    </Sheet>
  )
}
