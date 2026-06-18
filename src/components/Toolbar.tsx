import React from 'react';
import { FilterState } from '../types';

interface ToolbarProps {
  filter: FilterState;
  onFilterChange: (patch: Partial<FilterState>) => void;
  filteredCount: number;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  filter,
  onFilterChange,
  filteredCount
}) => {
  const tabs = [
    { type: 'all', label: 'All' },
    { type: 'image', label: 'Images' },
    { type: 'video', label: 'Video' },
    { type: 'pdf', label: 'PDF' },
    { type: 'link', label: 'Links' },
    { type: 'favorite', label: 'Favorites' }
  ];

  return (
    <div className="flex items-center gap-2 p-3 px-6 border-b border-[var(--border)] bg-[var(--app-bg)] overflow-x-auto shrink-0 select-none scrollbar-none">
      {tabs.map((tab) => {
        const isCurrent = filter.type === tab.type;
        return (
          <button
            key={tab.type}
            onClick={() => onFilterChange({ type: tab.type })}
            className={`
              text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full border transition shrink-0
              ${isCurrent 
                ? 'bg-[var(--text)] text-[var(--app-bg)] border-[var(--text)] shadow-[0_4px_12px_rgba(var(--text-rgb),0.1)]' 
                : 'bg-transparent text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--text)] hover:text-[var(--text)]'
              }
            `}
          >
            {tab.label}
          </button>
        );
      })}

      <div className="flex-1"></div>

      <div className="text-[10px] text-[var(--text-dim)] font-mono font-bold tracking-widest uppercase shrink-0">
        {filteredCount} item{filteredCount !== 1 ? 's' : ''}
      </div>
    </div>
  );
};
