'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { QueryFilter, QueryPlan } from '@/lib/gemini/query'
import type { FilterMod } from '@/actions/chat'
import { parseFilterInput, formatChipLabel } from './filter-chips.logic'

type Props = {
  plan: QueryPlan
  disabled: boolean
  onModify: (modifications: FilterMod[]) => void
}

export function FilterChips({ plan, disabled, onModify }: Props) {
  const [addingFilter, setAddingFilter] = useState(false)
  const [addInput, setAddInput] = useState('')
  const addInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (addingFilter) addInputRef.current?.focus()
  }, [addingFilter])

  const removeFilter = useCallback((index: number) => {
    onModify([{ type: 'remove', index }])
  }, [onModify])

  const commitAdd = useCallback(() => {
    const mod = parseFilterInput(addInput)
    if (!mod) {
      setAddingFilter(false)
      setAddInput('')
      return
    }

    onModify([mod])
    setAddingFilter(false)
    setAddInput('')
  }, [addInput, onModify])

  const handleAddKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); commitAdd() }
    if (e.key === 'Escape') { setAddingFilter(false); setAddInput('') }
  }, [commitAdd])

  // Commit the add-input on blur only when focus moves outside the chip row entirely.
  // If focus moves to a chip's × button (a sibling interactive element), skip the commit
  // so both the add and the remove can fire independently without one blocking the other.
  const handleAddBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    const relatedTarget = e.relatedTarget as HTMLElement | null
    if (relatedTarget && e.currentTarget.closest('[data-filter-chips]')?.contains(relatedTarget)) {
      setAddingFilter(false)
      setAddInput('')
      return
    }
    commitAdd()
  }, [commitAdd])

  return (
    <div data-filter-chips className="flex flex-wrap items-center gap-1.5 mt-2 animate-bloom">
      {plan.filters.map((filter, i) => (
        <FilterChip
          key={i}
          filter={filter}
          disabled={disabled}
          onRemove={() => removeFilter(i)}
        />
      ))}

      {addingFilter ? (
        <input
          ref={addInputRef}
          value={addInput}
          onChange={e => setAddInput(e.target.value)}
          onKeyDown={handleAddKeyDown}
          onBlur={handleAddBlur}
          placeholder="field: value"
          className="text-base font-mono bg-primary-50 border border-primary-200 rounded-lg px-3 py-1 outline-none w-40 animate-bloom"
        />
      ) : (
        <button
          onClick={() => setAddingFilter(true)}
          disabled={disabled}
          className="text-base font-mono border border-dashed border-primary-200 rounded-lg px-3 py-1 animate-swiss hover:bg-primary-50 hover:border-primary-400 disabled:opacity-50"
          aria-label="Add filter"
        >
          +
        </button>
      )}
    </div>
  )
}

function FilterChip({
  filter,
  disabled,
  onRemove,
}: {
  filter: QueryFilter
  disabled: boolean
  onRemove: () => void
}) {
  const label = formatChipLabel(filter)

  return (
    <span className="group inline-flex items-center gap-1 text-base font-mono bg-primary-100 rounded-lg px-3 py-1 animate-bloom">
      {label}
      <button
        onClick={onRemove}
        disabled={disabled}
        className="opacity-0 group-hover:opacity-100 animate-swiss ml-0.5 text-primary-400 hover:text-primary-900 disabled:cursor-not-allowed"
        aria-label={`Remove filter: ${label}`}
      >
        ×
      </button>
    </span>
  )
}

// formatChipLabel lives in ./filter-chips.logic.ts
