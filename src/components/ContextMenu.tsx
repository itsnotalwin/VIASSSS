import React, { useEffect, useRef } from 'react';
import { ExternalLink, Heart, Copy, Info, Trash2 } from 'lucide-react';
import { ArchiveItem } from '../types';

interface ContextMenuProps {
  itemId: string | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
  items: ArchiveItem[];
  onFavoriteChange: (id: string, isFav: boolean) => void;
  onDeleteItem: (id: string) => Promise<any>;
  onOpenDetails: (id: string) => void;
  onToast: (msg: string) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  itemId,
  position,
  onClose,
  items,
  onFavoriteChange,
  onDeleteItem,
  onOpenDetails,
  onToast
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (itemId && position) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [itemId, position]);

  if (!itemId || !position) return null;

  const item = items.find(x => x.id === itemId);
  if (!item) return null;

  const handleOpenSource = () => {
    if (item.url && !item.url.startsWith('local://')) {
      window.open(item.url, '_blank');
    }
    onClose();
  };

  const handleFavoriteToggle = () => {
    onFavoriteChange(item.id, !item.favorite);
    onClose();
  };

  const handleCopyLink = () => {
    if (item.url) {
      navigator.clipboard.writeText(item.url);
      onToast('URL copied to clipboard.');
    }
    onClose();
  };

  const handleDetailsClick = () => {
    onOpenDetails(item.id);
    onClose();
  };

  const handleDeleteClick = async () => {
    if (confirm(`Are you sure you want to delete ${item.title || 'this item'}?`)) {
      await onDeleteItem(item.id);
      onToast('Deleted successfully.');
    }
    onClose();
  };

  return (
    <div 
      ref={menuRef}
      style={{
        left: `${Math.min(position.x, window.innerWidth - 190)}px`,
        top: `${Math.min(position.y, window.innerHeight - 200)}px`
      }}
      className="fixed bg-[#1e1e1e] border border-white/8 z-400 min-w-[180px] rounded-2xl shadow-2xl overflow-hidden py-1 animate-fade-in backdrop-blur-md"
    >
      <button 
        onClick={handleOpenSource}
        disabled={!item.url || item.url.startsWith('local://')}
        className="w-full flex items-center gap-3 px-4 py-2 text-xs font-semibold text-white/90 hover:bg-white/5 transition disabled:opacity-30 disabled:hover:bg-transparent text-left"
      >
        <ExternalLink className="w-3.5 h-3.5 text-white/45 shrink-0" />
        <span>Open Source URL</span>
      </button>

      <button 
        onClick={handleFavoriteToggle}
        className="w-full flex items-center gap-3 px-4 py-2 text-xs font-semibold text-white/90 hover:bg-white/5 transition text-left"
      >
        <Heart className={`w-3.5 h-3.5 shrink-0 ${item.favorite ? 'text-red-500 fill-red-500' : 'text-white/45'}`} />
        <span>{item.favorite ? 'Unfavorite' : 'Favorite'}</span>
      </button>

      <button 
        onClick={handleCopyLink}
        className="w-full flex items-center gap-3 px-4 py-2 text-xs font-semibold text-white/90 hover:bg-white/5 transition text-left"
      >
        <Copy className="w-3.5 h-3.5 text-white/45 shrink-0" />
        <span>Copy Source URL</span>
      </button>

      <button 
        onClick={handleDetailsClick}
        className="w-full flex items-center gap-3 px-4 py-2 text-xs font-semibold text-white/90 hover:bg-white/5 transition text-left"
      >
        <Info className="w-3.5 h-3.5 text-white/45 shrink-0" />
        <span>Inspect Details</span>
      </button>

      <div className="h-[1px] bg-white/5 my-1" />

      <button 
        onClick={handleDeleteClick}
        className="w-full flex items-center gap-3 px-4 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition text-left"
      >
        <Trash2 className="w-3.5 h-3.5 text-red-400/70 shrink-0" />
        <span>Delete Item</span>
      </button>
    </div>
  );
};
