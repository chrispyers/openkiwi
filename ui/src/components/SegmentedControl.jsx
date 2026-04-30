import React from 'react';

/**
 * SegmentedControl — a pill-style toggle between two or more options.
 *
 * Props:
 *   options  — array of { value, label }
 *   value    — currently selected value
 *   onChange — (value) => void
 *   label    — optional label shown above the control
 */
export default function SegmentedControl({ options, value, onChange, label }) {
    return (
        <div className="w-full">
            {label && (
                <label className="block mb-1 uppercase tracking-wider text-xs font-bold text-primary">
                    {label}
                </label>
            )}
            <div className="flex rounded-2xl border-2 border-neutral-100 dark:border-neutral-700 hover:border-neutral-200 dark:hover:border-neutral-600 p-0.5 gap-0.5 transition-colors" style={{ backgroundColor: 'var(--select-bg)' }}>
                {options.map(opt => {
                    const isActive = opt.value === value;
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => onChange(opt.value)}
                            className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                                isActive
                                    ? 'bg-accent-primary text-[var(--button-on-accent)] shadow-sm'
                                    : 'text-secondary hover:text-primary'
                            }`}
                        >
                            {opt.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
