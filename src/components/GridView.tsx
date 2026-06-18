import React from 'react';
import { Card } from './Card';
import { ArchiveItem } from '../types';
import { Archive } from 'lucide-react'; // Let's use clean Lucide icon for empty archive

interface GridViewProps {
  items: ArchiveItem[];
  onFavoriteChange: (id: string, isFav: boolean) => void;
  onItemClick: (id: string, event: React.MouseEvent) => void;
  onZoomClick: (id: string, event: React.MouseEvent) => void;
  gridCols: string;
}

export const GridView: React.FC<GridViewProps> = ({
  items,
  onFavoriteChange,
  onItemClick,
  onZoomClick,
  gridCols
}) => {
  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none pointer-events-none mt-20 md:mt-32">
        <div className="w-16 h-16 flex items-center justify-center bg-[var(--text)]/5 rounded-3xl mb-4">
          <Archive className="w-8 h-8 text-[var(--text-dim)]" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-[var(--text)] mb-2">
          VIAS.OS is empty
        </h2>
        <p className="text-sm text-[var(--text-muted)] max-w-[320px] leading-relaxed">
          Paste a URL in the toolbar above to save your first item.<br />
          Drag & drop files anywhere to upload instantly.
        </p>
      </div>
    );
  }

  // Determine standard class or custom style for columns layout
  const getColumnsClass = () => {
    if (gridCols === 'auto') {
      return 'columns-1 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5';
    }
    switch (gridCols) {
      case '1': return 'columns-1';
      case '2': return 'columns-2';
      case '3': return 'columns-3';
      case '4': return 'columns-4';
      default: return 'columns-2 sm:columns-3 md:columns-4';
    }
  };

  return (
    <div 
      className="flex-1 overflow-y-auto p-4 md:p-6 bg-[var(--app-bg)]"
      style={{
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)',
        paddingLeft: 'max(env(safe-area-inset-left), 1rem)',
        paddingRight: 'max(env(safe-area-inset-right), 1rem)'
      }}
    >
      <div 
        className={`${getColumnsClass()} gap-4`}
        style={gridCols !== 'auto' ? { columns: Number(gridCols) } : undefined}
      >
        {items.map((item) => (
          <Card
            key={item.id}
            item={item}
            onFavoriteChange={onFavoriteChange}
            onClick={onItemClick}
            onZoomClick={onZoomClick}
          />
        ))}
      </div>
    </div>
  );
};
