import React, { useState, useRef, useEffect } from 'react'

const REACTION_OPTIONS = ['👍', '❤️', '😂', '🔥', '😮', '😢', '👏']

interface MessageReactionsProps {
  messageId: string
  reactions: Record<string, string[]>
  currentUserId: string | null
  onReact: (messageId: string, emoji: string, hasReacted: boolean) => void
}

export function MessageReactions({
  messageId,
  reactions,
  currentUserId,
  onReact,
}: MessageReactionsProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!pickerOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [pickerOpen])

  const handleReactClick = (emoji: string) => {
    if (!currentUserId) return
    const hasReacted = Boolean(reactions?.[emoji]?.includes(currentUserId))
    onReact(messageId, emoji, hasReacted)
  }

  const chips = Object.entries(reactions || {}).filter(([, users]) => (users?.length || 0) > 0)

  return (
    <div className="mt-1 flex items-center gap-1 flex-wrap text-xs text-white/80">
      {chips.map(([emoji, users]) => {
        const hasReacted = !!currentUserId && users.includes(currentUserId)
        return (
          <button
            key={`${messageId}-${emoji}`}
            onClick={() => handleReactClick(emoji)}
            className={`px-2 py-1 rounded-full border flex items-center gap-1 transition text-sm ${
              hasReacted
                ? 'bg-purple-600/30 border-purple-400 text-purple-200'
                : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
            }`}
          >
            <span>{emoji}</span>
            <span>{users.length}</span>
          </button>
        )
      })}
      <div className="relative" ref={pickerRef}>
        <button
          onClick={() => setPickerOpen((prev) => !prev)}
          className="px-2 py-1 rounded-full border border-dashed border-white/20 text-white/70 hover:text-white/100 hover:border-white/40 text-sm"
        >
          +
        </button>
        {pickerOpen && (
          <div className="absolute z-50 mt-2 p-2 rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl backdrop-blur flex flex-wrap gap-1 w-40">
            {REACTION_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  handleReactClick(emoji)
                  setPickerOpen(false)
                }}
                className="text-xl px-2 py-1 rounded-xl hover:bg-white/10 focus:bg-white/20 focus:outline-none"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
