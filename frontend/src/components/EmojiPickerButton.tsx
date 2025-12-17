import React, { useState, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import data from '@emoji-mart/data'

// Preload emoji picker during build time for better performance
// Changed ssr to true and added loading state to show immediately when opened
const EmojiPicker = dynamic(() => import('@emoji-mart/react'), { 
  ssr: false,
  loading: () => <div className="p-4 text-center text-white/50 text-sm">Loading emojis...</div>
}) as any

interface EmojiPickerButtonProps {
  onEmojiSelect: (emoji: string) => void
  disabled?: boolean
}

export function EmojiPickerButton({ onEmojiSelect, disabled }: EmojiPickerButtonProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  const emitEmoji = (emoji: string) => {
    if (!emoji) return
    onEmojiSelect(emoji)
    setOpen(false)
  }

  const handlePickerSelect = (emoji: { native?: string } | string) => {
    if (typeof emoji === 'string') {
      emitEmoji(emoji)
      return
    }
    if (emoji?.native) {
      emitEmoji(emoji.native)
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={disabled}
        className="bg-white/10 hover:bg-white/20 text-white/90 px-3 py-2 rounded-2xl text-sm transition flex items-center justify-center border border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-400"
        aria-label="Insert emoji"
      >
        😊
      </button>
      {open && (
        <div className="absolute bottom-full right-0 mb-2 z-50 w-72 rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl backdrop-blur">
          <div className="p-2">
            <EmojiPicker
              data={data}
              theme="dark"
              onEmojiSelect={handlePickerSelect}
              searchPosition="top"
              previewPosition="none"
              navPosition="none"
              perLine={8}
            />
          </div>
        </div>
      )}
    </div>
  )
}
