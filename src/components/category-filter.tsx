"use client";
import { categories, categoryLabel, featuredCategories } from "@/lib/taxonomy";
export function CategoryFilter({
  value,
  onChange,
  allValue = "All",
  allLabel = "All companies",
  variant = "",
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  allValue?: string;
  allLabel?: string;
  variant?: string;
  disabled?: boolean;
}) {
  return (
    <div
      className={`category-filter ${variant}`}
      role="group"
      aria-label="Filter companies"
    >
      <div className="category-tabs category-quick">
        {[allValue, ...featuredCategories].map((category) => (
          <button
            type="button"
            key={category}
            disabled={disabled}
            aria-pressed={value === category}
            className={value === category ? "active" : ""}
            onClick={() => onChange(category)}
          >
            {category === allValue ? allLabel : categoryLabel(category)}
          </button>
        ))}
      </div>
      <select
        className="category-picker"
        aria-label="All categories"
        title={value === allValue ? "Explore all 30 categories" : value}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value={allValue}>All categories</option>
        {[...categories]
          .sort((a, b) =>
            a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b),
          )
          .map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
      </select>
    </div>
  );
}
