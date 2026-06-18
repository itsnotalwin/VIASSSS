import React, { useState, useRef, useEffect } from 'react';
import { Heart, Play, FileText, Video as VideoIcon, ImageIcon, Link as LinkIcon, FileCode, Check } from 'lucide-react';
import { ArchiveItem } from '../types';
import { ytId, ytThumb, getProxyImageUrl } from '../lib/archive';
import { idbStorage } from '../lib/idb';

interface CardProps {
  item: ArchiveItem;
  onFavoriteChange: (id: string, isFav: boolean) => void;
  onClick: (id: string, event: React.MouseEvent) => void;
  onZoomClick: (id: string, event: React.MouseEvent) => void;
  isCanvas?: boolean;
}

export const Card: React.FC<CardProps> = ({
  item,
  onFavoriteChange,
  onClick,
  onZoomClick,
  isCanvas = false
}) => {
  const [imageError, setImageError] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isYT = item.type === 'video' && !!ytId(item.url || '');
  const isTikTok = item.url ? /tiktok\.com/i.test(item.url) : false;
  const isVimeo = item.url ? /vimeo\.com/i.test(item.url) : false;
  const isDirectVideo = item.type === 'video' && !isYT && !isTikTok && !isVimeo;
  const isNote = item.type === 'note';

  // Retrieve local file URLs if needed
  useEffect(() => {
    let active = true;
    let urlToRevoke: string | null = null;
    if (isDirectVideo) {
      if (item.isLocalFile) {
        idbStorage.get(item.id).then((blob) => {
          if (blob && active) {
            const tempUrl = URL.createObjectURL(blob);
            setVideoUrl(tempUrl);
            urlToRevoke = tempUrl;
          }
        });
      } else if (item.thumbnail && item.thumbnail.startsWith('data:video')) {
        setVideoUrl(item.thumbnail);
      } else if (item.url && !item.url.startsWith('local://')) {
        setVideoUrl(item.url);
      }
    }
    return () => {
      active = false;
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
    };
  }, [item.id, isDirectVideo, item.isLocalFile, item.thumbnail, item.url]);

  const handleMouseEnter = () => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  const cardId = `card-${item.id}`;

  if (isNote) {
    return (
      <div 
        id={cardId}
        className={`
          break-inside-avoid mb-4 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] rounded-2xl cursor-pointer
          shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-all duration-300 ease-out active:scale-[0.99]
          hover:-translate-y-1 hover:shadow-[0_12px_24px_rgba(0,0,0,0.2)] hover:border-[var(--text)]/20 p-5
          flex flex-col gap-3 select-none relative overflow-hidden group
          ${isCanvas ? 'w-[220px] absolute' : 'w-full'}
        `}
        onClick={(e) => {
          if (!isCanvas && onClick) onClick(item.id, e);
        }}
      >
        <div className="absolute top-0 left-0 w-full h-[3px] bg-[var(--text)] opacity-20 group-hover:opacity-100 transition-opacity" />
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-sm tracking-tight line-clamp-1 opacity-90 font-display">{item.title}</h3>
          <button 
            type="button"
            className="p-1 hover:bg-[var(--text)]/10 rounded-lg transition shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onFavoriteChange(item.id, !item.favorite);
            }}
          >
            <Heart className={`w-3.5 h-3.5 transition-colors ${item.favorite ? 'text-[var(--text)] fill-[var(--text)]' : 'text-[var(--text-dim)]'}`} />
          </button>
        </div>
        <div className="text-xs leading-relaxed whitespace-pre-wrap font-medium opacity-60 break-words line-clamp-6 font-mono">
          {item.textContent}
        </div>
      </div>
    );
  }
  const getFallbackIcon = () => {
    switch (item.type) {
      case 'image':
        return <ImageIcon className="w-8 h-8 text-[var(--text-dim)]" />;
      case 'video':
        return <VideoIcon className="w-8 h-8 text-[var(--text-dim)]" />;
      case 'pdf':
        return <FileText className="w-8 h-8 text-[var(--text-dim)]" />;
      case 'document':
        return <FileCode className="w-8 h-8 text-[var(--text-dim)]" />;
      default:
        return <LinkIcon className="w-8 h-8 text-[var(--text-dim)]" />;
    }
  };

  const igMatch = item.url ? item.url.match(/(?:instagram\.com|instagr\.am)\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/i) : null;
  const isInstagramUrlObj = !!igMatch;
  const igShortcodeValue = igMatch ? igMatch[1] : null;

  const displayThumbnail = isInstagramUrlObj && igShortcodeValue
    ? `https://www.instagram.com/p/${igShortcodeValue}/media/?size=l`
    : item.thumbnail;

  const hasThumbnail = displayThumbnail && typeof displayThumbnail === 'string' && displayThumbnail.length > 10;

  return (
    <div 
      id={cardId}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`
        break-inside-avoid mb-4 bg-[var(--surface-higher)] border border-[var(--border)] rounded-2xl cursor-pointer
        transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)]
        flex flex-col overflow-hidden select-none active:scale-[0.99]
        hover:-translate-y-1 hover:border-[var(--text)]/15
        ${isCanvas ? 'w-[220px] shadow-lg absolute' : 'w-full shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_24px_rgba(0,0,0,0.15)]'}
      `}
      onClick={(e) => {
        if (!isCanvas && onClick) onClick(item.id, e);
      }}
    >
      {/* Media Wrap */}
      <div 
        className="width-full overflow-hidden bg-[var(--surface)] relative flex items-center justify-center cursor-zoom-in group border-b border-[var(--border)]"
        onClick={(e) => {
          e.stopPropagation();
          onZoomClick(item.id, e);
        }}
        style={{ minHeight: isCanvas ? '110px' : '140px' }}
      >
        {isDirectVideo && videoUrl ? (
          <video 
            ref={videoRef}
            src={videoUrl} 
            muted 
            loop 
            playsInline 
            draggable={false}
            className="w-full h-auto block object-contain aspect-video"
          />
        ) : hasThumbnail && !imageError ? (
          <img 
            src={getProxyImageUrl(displayThumbnail)} 
            alt={item.title} 
            loading="lazy"
            draggable={false}
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
            className="w-full h-auto block object-contain"
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-10 gap-3 w-full bg-gradient-to-br from-[var(--surface-higher)] to-[var(--surface)] relative overflow-hidden">
            <div className="absolute inset-0 bg-[var(--text)]/[0.02] active:bg-[var(--text)]/[0.05] transition-colors" />
            <div className="relative">
                <div className="absolute inset-0 bg-[var(--text)]/5 blur-2xl rounded-full scale-150" />
                <span className="relative w-16 h-16 flex items-center justify-center bg-[var(--text)]/[0.03] border border-[var(--text)]/10 rounded-2xl backdrop-blur-sm shadow-xl">
                {getFallbackIcon()}
                </span>
            </div>
            <div className="flex flex-col items-center gap-1 relative">
                <span className="text-[10px] text-[var(--text-dim)] font-black tracking-[0.2em] uppercase">
                {item.type}
                </span>
                <span className="text-[9px] text-[var(--text-muted)]/40 font-medium truncate max-w-[150px] font-mono">
                {item.fileName || item.domain || 'no preview'}
                </span>
            </div>
          </div>
        )}

        {isYT && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/15 group-hover:bg-black/30 transition duration-300">
            <div className="w-10 h-10 flex items-center justify-center bg-black/55 text-white blur-backdrop rounded-full transition group-hover:scale-110">
              <Play className="w-4 h-4 fill-white text-white ml-0.5" />
            </div>
          </div>
        )}
      </div>

      {/* Content Body */}
      <div className="p-3.5 flex flex-col gap-2 bg-[var(--surface)] border-t border-[var(--border)]">
        <div className="flex items-start justify-between gap-1.5">
          <h3 className="flex-1 text-[13px] md:text-sm font-bold text-[var(--text)]/90 leading-tight line-clamp-2 select-none tracking-tight font-display">
            {item.title || item.domain || 'Untitled'}
          </h3>
          <button 
            type="button"
            className="p-1 text-[var(--text-dim)] hover:text-[var(--text)] rounded-lg transition hover:bg-[var(--text)]/5 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onFavoriteChange(item.id, !item.favorite);
            }}
          >
            <Heart 
              className={`w-3.5 h-3.5 transition-colors ${item.favorite ? 'text-[var(--text)] fill-[var(--text)]' : 'text-[var(--text-dim)]'}`} 
            />
          </button>
        </div>

        {/* Badges and tags info */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] font-black tracking-[0.1em] uppercase text-[var(--text-muted)] bg-[var(--text)]/5 border border-[var(--border)] px-2 py-0.5 rounded-md shrink-0">
            {item.type}
          </span>
          {item.colonyId && (
            <span className="text-[9px] font-black tracking-[0.15em] uppercase text-[var(--app-bg)] bg-[var(--text)] px-2 py-0.5 rounded-md shrink-0">
              {item.colonyId}
            </span>
          )}
        </div>

        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {item.tags.slice(0, 3).map((tag, idx) => (
              <span key={idx} className="text-[9px] font-bold text-[var(--text-muted)] tracking-tight">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
