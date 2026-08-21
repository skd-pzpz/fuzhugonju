"use client"

import { useCallback, useRef, useState, type KeyboardEvent, type ChangeEvent } from "react"
import { X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface TagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  disabled?: boolean
  suggestions?: string[]
}

function TagInput({
  value,
  onChange,
  placeholder = "输入标签...",
  disabled = false,
  suggestions = [],
}: TagInputProps) {
  const [inputValue, setInputValue] = useState("")
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredSuggestions = suggestions.filter(
    (s) =>
      s.toLowerCase().includes(inputValue.toLowerCase()) &&
      !value.includes(s),
  )

  const addTag = useCallback(
    (tag: string) => {
      const trimmed = tag.trim()
      if (trimmed && !value.includes(trimmed)) {
        onChange([...value, trimmed])
      }
      setInputValue("")
    },
    [value, onChange],
  )

  const removeTag = useCallback(
    (index: number) => {
      onChange(value.filter((_, i) => i !== index))
    },
    [value, onChange],
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" || e.key === " " || e.key === ",") {
        e.preventDefault()
        addTag(inputValue)
      } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
        removeTag(value.length - 1)
      }
    },
    [inputValue, value, addTag, removeTag],
  )

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      // Handle paste with commas
      if (val.includes(",")) {
        const parts = val.split(",")
        parts.forEach((part) => {
          const trimmed = part.trim()
          if (trimmed) {
            addTag(trimmed)
          }
        })
      } else {
        setInputValue(val)
      }
    },
    [addTag],
  )

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      addTag(suggestion)
      inputRef.current?.focus()
    },
    [addTag],
  )

  const handleContainerClick = useCallback(() => {
    inputRef.current?.focus()
  }, [])

  const showSuggestions =
    suggestions.length > 0 && inputValue && filteredSuggestions.length > 0

  return (
    <div className="relative">
      <div
        className={cn(
          "flex min-h-8 flex-wrap items-center gap-1 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none",
          isFocused && "border-ring ring-3 ring-ring/50",
          disabled &&
            "pointer-events-none cursor-not-allowed bg-input/50 opacity-50 dark:bg-input/80",
        )}
        onClick={handleContainerClick}
      >
        {value.map((tag, index) => (
          <Badge
            key={`${tag}-${index}`}
            variant="secondary"
            className="h-6 gap-1 rounded-md px-2 py-0 text-xs"
          >
            {tag}
            <button
              type="button"
              className="-mr-0.5 inline-flex items-center justify-center rounded-sm p-0.5 hover:bg-muted-foreground/20 transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                removeTag(index)
              }}
              disabled={disabled}
              aria-label={`移除标签 ${tag}`}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={value.length === 0 ? placeholder : ""}
          disabled={disabled}
          className="min-w-[60px] flex-1 border-none bg-transparent py-0.5 text-sm outline-none placeholder:text-muted-foreground disabled:pointer-events-none"
        />
      </div>
      {showSuggestions && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover p-1 shadow-md">
          {filteredSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="w-full rounded-md px-2.5 py-1.5 text-left text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              onMouseDown={(e) => {
                e.preventDefault()
                handleSuggestionClick(suggestion)
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export { TagInput }