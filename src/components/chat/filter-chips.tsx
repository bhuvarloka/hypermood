"use client";

import type { QueryFilter, QueryPlan } from "@/lib/gemini/query";
import type { FilterMod } from "@/actions/chat";
import { formatChipLabel } from "./filter-chips.logic";

type Props = {
  plan: QueryPlan;
  disabled: boolean;
  onModify: (modifications: FilterMod[]) => void;
};

export function FilterChips({ plan, disabled, onModify }: Props) {
  if (plan.filters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 animate-bloom">
      {plan.filters.map((filter, i) => (
        <FilterChip
          key={i}
          filter={filter}
          disabled={disabled}
          onRemove={() => onModify([{ type: "remove", index: i }])}
        />
      ))}
    </div>
  );
}

function FilterChip({
  filter,
  disabled,
  onRemove,
}: {
  filter: QueryFilter;
  disabled: boolean;
  onRemove: () => void;
}) {
  const label = formatChipLabel(filter);

  return (
    <span className="group inline-flex items-center gap-1.5 text-sm bg-white rounded-full px-3 py-1 animate-bloom border-primary-950 border-2">
      {label}
      <button
        onClick={onRemove}
        disabled={disabled}
        className="animate-swiss disabled:cursor-not-allowed leading-none"
        aria-label={`Remove: ${label}`}
      >
        ×
      </button>
    </span>
  );
}
