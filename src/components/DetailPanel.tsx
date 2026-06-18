import React, { useState, useEffect, useRef } from 'react';
import { X, ExternalLink, Heart, Copy, Trash2, Tag, Check, Download } from 'lucide-react';
import { ArchiveItem } from '../types';
import { reltime, favicon, getProxyImageUrl } from '../lib/archive';
import { idbStorage } from '../lib/idb';

interface DetailPanelProps {
  itemId: string | null;
  onClose: () => void;
  getItem: (id: string) => ArchiveItem | undefined;
  onUpdateItem: (id: string, patch: Partial<ArchiveItem>) => Promise<any>;
  onDeleteItem: (id: string) => Promise<any>;
  collections: string[];
  onFavoriteChange: (id: string, isFav: boolean) => void;
  onToast: (msg: string) => void;
}

export const DetailPanel: React.FC<DetailPanelProps> = ({
  itemId,
  onClose,
  getItem,
  onUpdateItem,
  onDeleteItem,
  collections,
  onFavoriteChange,
  onToast
}) => {
  const item = itemId ? getItem(itemId) : undefined;
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [textContent, setTextContent] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [itemCols, setItemCols] = useState<string[]>([]);
  const [mediaBlobUrl, setMediaBlobUrl] = useState<string | null>(null);

  // Track state sync with item prop changes
  useEffect(() => {
    if (item) {
      setTitle(item.title || '');
      setNotes(item.notes || '');
      setTextContent(item.textContent || '');
      setTags(item.tags || []);
      setItemCols(item.collections || []);
      
      // Load local blobs if PDF or local video is loaded
      let active = true;
      if (item.isLocalFile) {
        idbStorage.get(item.id).then((blob) => {
          if (blob && active) {
            const url = URL.createObjectURL(blob);
            setMediaBlobUrl(url);
          }
        });
      } else {
        setMediaBlobUrl(null);
      }

      return () => {
        active = false;
      };
    } else {
      setMediaBlobUrl(null);
    }
  }, [item, itemId]);

  // Cleanup blob URLs to prevent memory leak
  useEffect(() => {
    return () => {
      if (mediaBlobUrl) {
        URL.revokeObjectURL(mediaBlobUrl);
      }
    };
  }, [mediaBlobUrl]);

  if (!item) return null;

  const handleTitleBlur = () => {
    const trimmed = title.trim();
    onUpdateItem(item.id, { title: trimmed || 'Untitled' });
  };

  const handleNotesBlur = () => {
    onUpdateItem(item.id, { notes });
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const trimmed = tagInput.trim().replace(/,+$/, '');
      if (trimmed && !tags.includes(trimmed)) {
        const newTags = [...tags, trimmed];
        setTags(newTags);
        onUpdateItem(item.id, { tags: newTags });
      }
      setTagInput('');
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      const newTags = tags.slice(0, -1);
      setTags(newTags);
      onUpdateItem(item.id, { tags: newTags });
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const newTags = tags.filter(t => t !== tagToRemove);
    setTags(newTags);
    onUpdateItem(item.id, { tags: newTags });
  };

  const handleToggleCol = (colName: string) => {
    const newCols = itemCols.includes(colName)
      ? itemCols.filter(c => c !== colName)
      : [...itemCols, colName];
    setItemCols(newCols);
    onUpdateItem(item.id, { collections: newCols });
  };

  const handleCopyUrl = () => {
    if (item.url) {
      navigator.clipboard.writeText(item.url).then(() => {
        onToast('Copied URL to Clipboard!');
      });
    }
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this archive item?')) {
      await onDeleteItem(item.id);
      onClose();
      onToast('Item deleted successfully.');
    }
  };

  const isYT = item.type === 'video' && item.url.includes('youtube.com') || item.url.includes('youtu.be');
  const isInstagram = !!item.url && /(?:instagram\.com|instagr\.am)\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/i.test(item.url);
  const igMatch = item.url ? item.url.match(/(?:instagram\.com|instagr\.am)\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/i) : null;
  const igShortcode = igMatch ? igMatch[1] : null;

  return (
    <aside 
      className={`
        fixed right-0 top-0 bottom-0 w-full sm:w-[400px] bg-[var(--app-bg)] border-l border-[var(--border)] z-[1060]
        transition-transform duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] flex flex-col overflow-y-auto
        h-full transform ${itemId ? 'translate-x-0' : 'translate-x-full'}
      `}
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingRight: 'env(safe-area-inset-right)'
      }}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between p-4 px-5 border-b border-[var(--border)] shrink-0 bg-[var(--surface)]/80 backdrop-blur-md sticky top-0 z-10 select-none">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-bold tracking-widest text-[var(--text-dim)] uppercase">Item Details</span>
          <span className="text-[10px] font-mono text-[var(--text-muted)] select-text">id: {item.id}</span>
        </div>
        <button 
          onClick={onClose}
          className="text-[#0A84FF] hover:opacity-80 text-sm font-semibold p-1"
        >
          Done
        </button>
      </div>

      {/* Picture Frame Media Container */}
      <div className="flex-shrink-0 bg-[var(--surface-higher)] border-b border-[var(--border)] relative overflow-hidden flex items-center justify-center min-h-[180px] max-h-[350px]">
        {item.isLocalFile && mediaBlobUrl ? (
          item.type === 'pdf' ? (
            <iframe 
              src={mediaBlobUrl} 
              title={item.title}
              className="w-full h-[220px] bg-white border-none"
            />
          ) : item.type === 'video' ? (
            <video 
              src={mediaBlobUrl} 
              controls 
              playsInline
              className="max-h-[240px] w-full block object-contain"
            />
          ) : (
            <img 
              src={mediaBlobUrl} 
              alt={item.title} 
              className="max-h-[240px] w-full block object-contain select-none"
            />
          )
        ) : isInstagram && igShortcode ? (
          <div className="w-full h-[320px] bg-[var(--app-bg)]">
            <iframe 
              src={`https://www.instagram.com/p/${igShortcode}/embed/`} 
              title={item.title}
              allowFullScreen
              scrolling="no"
              className="w-full h-full border-none"
            />
          </div>
        ) : item.thumbnail ? (
          <img 
            src={getProxyImageUrl(item.thumbnail)} 
            alt={item.title} 
            referrerPolicy="no-referrer"
            className="max-h-[240px] w-full block object-contain select-none shadow"
          />
        ) : (
          <div className="py-12 text-[var(--text-dim)] flex items-center justify-center">
            <span className="text-sm font-semibold uppercase tracking-widest">No visual preview matches</span>
          </div>
        )}
      </div>

      {/* Settings Form Body */}
      <div className="p-5 flex flex-col gap-6 flex-1 select-none">
        
        {/* Title Input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold tracking-widest text-[var(--text-dim)] uppercase">Title</label>
          <input 
            type="text" 
            value={title || ''}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            placeholder="Untitled document..."
            className="w-full bg-transparent border-b border-transparent text-[var(--text)] font-semibold text-xl tracking-tight leading-snug p-0 pb-1 focus:outline-none focus:border-[#0A84FF] transition"
          />
        </div>

        {item.type === 'note' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold tracking-widest text-yellow-500 uppercase">Sticky Content</label>
            <textarea 
              placeholder="Jot down quick contextual thoughts..."
              value={textContent || ''}
              onChange={(e) => setTextContent(e.target.value)}
              onBlur={() => {
                onUpdateItem(item.id, { textContent: textContent });
              }}
              className="w-full bg-yellow-100 dark:bg-[#1f1e15] text-yellow-900 dark:text-yellow-100 border border-yellow-200 dark:border-yellow-900/50 text-sm rounded-xl p-3 min-h-[160px] focus:outline-none focus:border-yellow-500 transition resize-y font-medium leading-relaxed"
            />
          </div>
        )}

        {/* URL segment */}
        {item.url && !item.url.startsWith('local://') && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold tracking-widest text-[var(--text-dim)] uppercase">URL Source</label>
            <a 
              href={item.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-[#0A84FF] hover:text-[#409CFF] flex items-center gap-1.5 break-all leading-normal transition"
            >
              <span className="underline">{item.url}</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </a>
          </div>
        )}

        {/* Description segment */}
        {item.description && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold tracking-widest text-[var(--text-dim)] uppercase">Description</label>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed font-sans select-text">
              {item.description}
            </p>
          </div>
        )}

        {/* Notes Segment */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold tracking-widest text-[var(--text-dim)] uppercase">Notes</label>
          <textarea 
            placeholder="Add structured observations, contextual summaries, metadata details..."
            value={notes || ''}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            className="w-full bg-[var(--surface-higher)] border border-[var(--border)] text-[var(--text)] text-sm rounded-xl p-3 h-24 focus:outline-none focus:border-[#0A84FF] transition resize-y font-sans leading-relaxed"
          />
        </div>

        {/* Tags Segment */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold tracking-widest text-[var(--text-dim)] uppercase">Tags</label>
          <div 
            onClick={() => document.getElementById('tags-inp-box')?.focus()}
            className="bg-[var(--surface-higher)] border border-[var(--border)] rounded-xl p-2.5 min-h-11 flex flex-wrap gap-1.5 cursor-text focus-within:border-[#0A84FF] transition"
          >
            {tags.map((tag, idx) => (
              <span key={idx} className="flex items-center gap-1 bg-[var(--text)]/10 text-[var(--text)] rounded px-2 py-0.5 text-xs font-semibold">
                <span>{tag}</span>
                <button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveTag(tag);
                  }}
                  className="text-[var(--text-dim)] hover:text-red-400 p-0.5 ml-0.5 transition"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <input 
              id="tags-inp-box"
              type="text" 
              placeholder="Tag..."
              value={tagInput || ''}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              className="bg-transparent text-[var(--text)] border-none outline-none text-sm font-sans flex-1 min-w-[70px] p-0"
            />
          </div>
        </div>

        {/* Collections Segment */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold tracking-widest text-[var(--text-dim)] uppercase">Collections</label>
          <div className="flex flex-wrap gap-1.5">
            {collections.map((col) => {
              const inside = itemCols.includes(col);
              return (
                <button
                  key={col}
                  onClick={() => handleToggleCol(col)}
                  className={`
                    px-3 py-1 rounded-full text-xs font-semibold border transition
                    ${inside 
                      ? 'bg-[#0A84FF] text-white border-[#0A84FF]' 
                      : 'bg-transparent text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--text)]/15 hover:text-[var(--text)]'
                    }
                  `}
                >
                  {col}
                </button>
              );
            })}
          </div>
        </div>

        {/* Meta Segment */}
        <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-4">
          <label className="text-[10px] font-bold tracking-widest text-[var(--text-dim)] uppercase mb-1">Metadata Indicators</label>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-[var(--text-dim)] uppercase font-semibold">Format</span>
              <span className="text-sm text-[var(--text)]/80 font-medium capitalize">{item.type}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-[var(--text-dim)] uppercase font-semibold">Site Source</span>
              <span className="text-sm text-[var(--text)]/80 font-medium truncate" title={item.domain || 'Local Upload'}>
                {item.domain || 'local upload'}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-[var(--text-dim)] uppercase font-semibold">Archived</span>
              <span className="text-sm text-[var(--text)]/80 font-medium">{reltime(item.createdAt)}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-[var(--text-dim)] uppercase font-semibold">Times Open</span>
              <span className="text-sm text-[var(--text)]/80 font-medium">{item.openCount || 0}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Absolute actions triggers block */}
      <div className="p-4 bg-[var(--surface)]/80 backdrop-blur-md border-t border-[var(--border)] sticky bottom-0 z-10 flex flex-col sm:flex-row gap-2 select-none shrink-0">
        <button
          onClick={() => {
            if (item.url && !item.url.startsWith('local://')) {
              window.open(item.url, '_blank');
              onUpdateItem(item.id, { openCount: (item.openCount || 0) + 1 });
            } else if (item.isLocalFile && mediaBlobUrl) {
              window.open(mediaBlobUrl, '_blank');
            }
          }}
          className="flex-1 h-10 bg-[var(--text)]/5 hover:bg-[var(--text)]/10 text-[var(--text)] font-semibold rounded-xl text-xs transition border border-[var(--border)] flex items-center justify-center gap-1.5"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Open Link</span>
        </button>

        <button
          onClick={() => onFavoriteChange(item.id, !item.favorite)}
          className="flex-1 h-10 bg-[var(--text)]/5 hover:bg-[var(--text)]/10 text-[var(--text)] font-semibold rounded-xl text-xs transition border border-[var(--border)] flex items-center justify-center gap-1.5"
        >
          <Heart className={`w-3.5 h-3.5 ${item.favorite ? 'text-red-500 fill-red-500' : ''}`} />
          <span>{item.favorite ? 'Unfavorite' : 'Favorite'}</span>
        </button>

        <button
          onClick={handleCopyUrl}
          className="flex-1 h-10 bg-[var(--text)]/5 hover:bg-[var(--text)]/10 text-[var(--text)] font-semibold rounded-xl text-xs transition border border-[var(--border)] flex items-center justify-center gap-1.5"
        >
          <Copy className="w-3.5 h-3.5" />
          <span>Copy URL</span>
        </button>

        <button
          onClick={handleDelete}
          className="flex-1 h-10 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold rounded-xl text-xs transition border border-red-500/10 flex items-center justify-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete</span>
        </button>
      </div>
    </aside>
  );
};
