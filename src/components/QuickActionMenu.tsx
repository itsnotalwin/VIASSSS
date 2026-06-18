import React, { useEffect, useRef } from 'react';
import { ExternalLink, Info, X, Heart, Trash2, Youtube } from 'lucide-react';
import { ArchiveItem } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { ytId, getProxyImageUrl } from '../lib/archive';

interface QuickActionMenuProps {
  itemId: string | null;
  onClose: () => void;
  item: ArchiveItem | undefined;
  onOpenDetails: (id: string) => void;
  onOpenLightbox: (id: string) => void;
  onOpenSource: (url: string) => void;
  onToggleFavorite?: (id: string, isFav: boolean) => void;
  onDelete?: (id: string) => void;
}

export const QuickActionMenu: React.FC<QuickActionMenuProps> = ({
  itemId,
  onClose,
  item,
  onOpenDetails,
  onOpenLightbox,
  onOpenSource,
  onToggleFavorite,
  onDelete
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (itemId) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [itemId]);

  return (
    <AnimatePresence>
      {itemId && item && (
        <div className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-[8px] cursor-pointer"
          />

          {/* Action Sheet */}
          <motion.div 
            ref={menuRef}
            initial={{ y: "100%", opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: "100%", opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 30, stiffness: 400 }}
            className="relative w-full max-w-sm bg-[#161616]/90 border border-white/10 rounded-[38px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] overflow-hidden mb-safe backdrop-blur-2xl"
          >
            {/* Header Preview */}
            <div className="relative h-64 w-full bg-[#0a0a0a] overflow-hidden group">
              {item.type === 'video' && item.url && ytId(item.url) ? (
                <div className="w-full h-full">
                  <iframe
                      src={`https://www.youtube.com/embed/${ytId(item.url)}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0`}
                      title={item.title}
                      className="w-full h-full pointer-events-none"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  />
                  <div className="absolute inset-0 z-10 bg-transparent" />
                </div>
              ) : item.thumbnail ? (
                <img 
                  src={getProxyImageUrl(item.thumbnail)} 
                  className="w-full h-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-110"
                  alt={item.title}
                  referrerPolicy="no-referrer"
                />
              ) : item.type === 'note' ? (
                <div className="w-full h-full p-8 flex flex-col justify-center bg-gradient-to-br from-white/10 via-[#161616] to-white/5">
                  <p className="text-white/80 line-clamp-4 text-lg font-medium italic leading-relaxed">"{item.textContent}"</p>
                </div>
              ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-black">
                      <div className="relative">
                          <div className="absolute inset-0 bg-white/10 blur-xl rounded-full" />
                          <span className="relative text-4xl font-black text-white/10 select-none tracking-tighter">
                              {item.title.substring(0, 2).toUpperCase()}
                          </span>
                      </div>
                  </div>
              )}
              
              <div className="absolute inset-0 bg-gradient-to-t from-[#161616] via-[#161616]/20 to-transparent" />
              
              <div className="absolute bottom-6 left-8 right-8">
                  <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] bg-white/5 border border-white/10 px-2.5 py-1 rounded-full backdrop-blur-md">
                          {item.type}
                      </span>
                      {item.favorite && (
                          <div className="w-6 h-6 flex items-center justify-center bg-white/10 rounded-full border border-white/20">
                              <Heart className="w-3 h-3 text-white fill-white" />
                          </div>
                      )}
                  </div>
                  <h2 className="text-2xl font-bold text-white tracking-tight leading-tight line-clamp-2 font-display">{item.title}</h2>
              </div>

              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="absolute top-6 right-6 w-11 h-11 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-xl rounded-full text-white/70 hover:text-white border border-white/10 active:scale-90 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

          {/* Action Grid */}
          <div className="p-3 grid grid-cols-1 gap-1.5 max-h-[50vh] overflow-y-auto no-scrollbar">
            <button 
              onClick={() => {
                onOpenDetails(item.id);
                onClose();
              }}
              className="flex items-center gap-4 px-6 py-4 text-sm font-bold text-white/90 active:bg-white/10 active:scale-[0.98] rounded-3xl transition-all text-left group bg-white/[0.03] border border-white/5"
            >
              <div className="w-11 h-11 flex items-center justify-center bg-white/10 rounded-2xl group-active:scale-95 transition-transform border border-white/10">
                <Info className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span>View Details</span>
                <span className="text-[11px] text-white/30 font-medium leading-tight">Metadata, tags, and stats</span>
              </div>
            </button>

            {onToggleFavorite && (
                <button 
                    onClick={() => {
                        onToggleFavorite(item.id, !item.favorite);
                    }}
                    className="flex items-center gap-4 px-6 py-4 text-sm font-bold text-white/90 active:bg-white/10 active:scale-[0.98] rounded-3xl transition-all text-left group bg-white/[0.03] border border-white/5"
                >
                    <div className={`w-11 h-11 flex items-center justify-center ${item.favorite ? 'bg-white/30 border-white/40' : 'bg-white/5 border-white/10'} border rounded-2xl group-active:scale-95 transition-transform`}>
                        <Heart className={`w-5 h-5 ${item.favorite ? 'text-white fill-white' : 'text-white/40'}`} />
                    </div>
                    <div className="flex flex-col">
                        <span>{item.favorite ? 'Unfavorite' : 'Add to Favorites'}</span>
                        <span className="text-[11px] text-white/30 font-medium leading-tight">Save to your curated list</span>
                    </div>
                </button>
            )}

            {item.url && !item.url.startsWith('local://') && (
              <>
                <button 
                  onClick={() => {
                    onOpenSource(item.url!);
                    onClose();
                  }}
                  className="flex items-center gap-4 px-6 py-4 text-sm font-bold text-white/90 active:bg-white/10 active:scale-[0.98] rounded-3xl transition-all text-left group bg-white/[0.03] border border-white/5"
                >
                  <div className="w-11 h-11 flex items-center justify-center bg-white/10 rounded-2xl group-active:scale-95 transition-transform border border-white/10">
                    <ExternalLink className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span>Visit Source</span>
                    <span className="text-[11px] text-white/30 font-medium leading-tight truncate">{item.url}</span>
                  </div>
                </button>
              </>
            )}

            {onDelete && (
                <button 
                    onClick={() => {
                        onDelete(item.id);
                        onClose();
                    }}
                    className="flex items-center gap-4 px-6 py-4 text-sm font-bold text-white active:bg-white/10 active:scale-[0.98] rounded-3xl transition-all text-left group mt-4 bg-white/[0.05] border border-white/10"
                >
                    <div className="w-11 h-11 flex items-center justify-center bg-white/10 rounded-2xl group-active:scale-95 transition-transform border border-white/20">
                        <Trash2 className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                        <span>Delete Item</span>
                        <span className="text-[11px] text-white/30 font-medium leading-tight">Remove from archive permanently</span>
                    </div>
                </button>
            )}
          </div>
          <div className="h-4 bg-transparent" />
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);
};
