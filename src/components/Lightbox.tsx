import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Info, Play, Loader2 } from 'lucide-react';
import { ArchiveItem } from '../types';
import { ytId, getProxyImageUrl } from '../lib/archive';
import { idbStorage } from '../lib/idb';

interface LightboxProps {
  itemId: string | null;
  onClose: () => void;
  filteredItems: ArchiveItem[];
  onOpenInfo: (id: string) => void;
}

export const Lightbox: React.FC<LightboxProps> = ({
  itemId,
  onClose,
  filteredItems,
  onOpenInfo
}) => {
  const [index, setIndex] = useState(-1);
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);
  const [isMediaLoading, setIsMediaLoading] = useState(false);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // Filter items that actually have media files to slide through
  const mediaItems = filteredItems.filter(x => 
    x.thumbnail || 
    (x.type === 'video' && ytId(x.url)) || 
    x.type === 'image' || 
    x.type === 'video'
  );

  useEffect(() => {
    if (itemId) {
      const idx = mediaItems.findIndex(x => x.id === itemId);
      setIndex(idx);
    } else {
      setIndex(-1);
    }
  }, [itemId, mediaItems.length]);

  // Handle local video blobs and cleanup
  useEffect(() => {
    let active = true;
    let urlToRevoke: string | null = null;

    if (index >= 0 && index < mediaItems.length) {
      const currentItem = mediaItems[index];
      if (currentItem.isLocalFile && currentItem.type === 'video') {
         setIsMediaLoading(true);
         idbStorage.get(currentItem.id).then((blob) => {
           if (blob && active) {
              const url = URL.createObjectURL(blob);
              setLocalVideoUrl(url);
              urlToRevoke = url;
           }
           setIsMediaLoading(false);
         }).catch(() => {
           setIsMediaLoading(false);
         });
      } else {
        setLocalVideoUrl(null);
      }
    } else {
      setLocalVideoUrl(null);
    }

    return () => {
      active = false;
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
    };
  }, [index, mediaItems.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (index === -1) return;
      if (e.key === 'ArrowRight') handleNext();
      else if (e.key === 'ArrowLeft') handlePrev();
      else if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [index, mediaItems.length]);

  if (index === -1 || mediaItems.length === 0) return null;

  const currentItem = mediaItems[index];

  const handleNext = () => {
    if (index < mediaItems.length - 1) {
      setIndex(index + 1);
    }
  };

  const handlePrev = () => {
    if (index > 0) {
      setIndex(index - 1);
    }
  };

  // Touch Swipe gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const deltaX = touchStartX.current - touchEndX.current;
    const threshold = 70; // min swipe distance in px
    if (deltaX > threshold) {
      handleNext();
    } else if (deltaX < -threshold) {
      handlePrev();
    }
  };

  const isYoutubeVideo = currentItem.type === 'video' && !!ytId(currentItem.url || '');
  const ytVideoId = ytId(currentItem.url || '');
  
  const isTikTok = currentItem.type === 'video' && !!currentItem.url && /tiktok\.com/i.test(currentItem.url);
  const tiktokMatch = currentItem.url ? currentItem.url.match(/tiktok\.com\/@.+\/video\/(\d+)/i) : null;
  const tiktokVideoId = tiktokMatch ? tiktokMatch[1] : null;

  const isVimeo = currentItem.type === 'video' && !!currentItem.url && /vimeo\.com/i.test(currentItem.url);
  const vimeoMatch = currentItem.url ? currentItem.url.match(/vimeo\.com\/(\d+)/i) : null;
  const vimeoVideoId = vimeoMatch ? vimeoMatch[1] : null;

  const isInstagram = !!currentItem.url && /(?:instagram\.com|instagr\.am)\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/i.test(currentItem.url);
  const igMatch = currentItem.url ? currentItem.url.match(/(?:instagram\.com|instagr\.am)\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/i) : null;
  const igShortcode = igMatch ? igMatch[1] : null;

  const isDirectVideo = currentItem.type === 'video' && !isYoutubeVideo && !isTikTok && !isVimeo;

  return (
    <div 
      className="fixed inset-0 z-[2000] bg-black/95 backdrop-blur-md flex flex-col justify-between select-none animate-fade-in"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)'
      }}
    >
      {/* Lightbox Header Bar */}
      <div className="flex justify-between items-center p-4 px-6 z-10 select-none">
        <button 
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/15 text-white rounded-full transition"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="text-sm font-semibold text-white/50">
          {index + 1} / {mediaItems.length}
        </div>

        <button 
          onClick={() => {
            onOpenInfo(currentItem.id);
            onClose();
          }}
          className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/15 text-white rounded-full transition"
          title="Inspect Item details"
        >
          <Info className="w-5 h-5" />
        </button>
      </div>

      {/* Main viewport Container */}
      <div 
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="flex-1 flex items-center justify-center p-4 relative overflow-hidden"
      >
        {isMediaLoading ? (
          <Loader2 className="w-10 h-10 text-[#0A84FF] animate-spin" />
        ) : isYoutubeVideo && ytVideoId ? (
          <div className="w-full max-w-4xl aspect-video rounded-2xl overflow-hidden shadow-2xl border border-white/5 select-text">
            <iframe 
              src={`https://www.youtube.com/embed/${ytVideoId}?autoplay=1&rel=0`} 
              title={currentItem.title}
              allowFullScreen
              className="w-full h-full border-none"
            />
          </div>
        ) : isInstagram && igShortcode ? (
          <div className="w-full max-w-[450px] h-[550px] shadow-2xl rounded-2xl overflow-hidden border border-white/10 bg-[#0a0a0a]">
            <iframe 
              src={`https://www.instagram.com/p/${igShortcode}/embed/`} 
              title={currentItem.title}
              allowFullScreen
              scrolling="no"
              className="w-full h-full border-none"
            />
          </div>
        ) : isTikTok && tiktokVideoId ? (
          <div className="w-full max-w-[340px] h-[600px] shadow-2xl rounded-2xl overflow-hidden border border-white/10 bg-[#0a0a0a]">
            <iframe 
              src={`https://www.tiktok.com/embed/v2/${tiktokVideoId}`} 
              title={currentItem.title}
              allowFullScreen
              className="w-full h-full border-none"
            />
          </div>
        ) : isVimeo && vimeoVideoId ? (
          <div className="w-full max-w-4xl aspect-video rounded-2xl overflow-hidden shadow-2xl border border-white/5 bg-black select-text">
            <iframe 
              src={`https://player.vimeo.com/video/${vimeoVideoId}?autoplay=1`} 
              title={currentItem.title}
              allowFullScreen
              className="w-full h-full border-none"
            />
          </div>
        ) : currentItem.type === 'video' && localVideoUrl && isDirectVideo ? (
          <div className="w-full max-w-4xl aspect-video rounded-2xl overflow-hidden shadow-2xl bg-black border border-white/5">
            <video 
              src={localVideoUrl} 
              controls 
              autoPlay 
              playsInline 
              className="w-full h-full object-contain"
            />
          </div>
        ) : currentItem.type === 'video' && currentItem.url && !currentItem.url.startsWith('local://') && isDirectVideo ? (
          <div className="w-full max-w-4xl aspect-video rounded-2xl overflow-hidden shadow-2xl bg-black border border-white/5">
            <video 
              src={currentItem.url} 
              controls 
              autoPlay 
              playsInline 
              className="w-full h-full object-contain"
            />
          </div>
        ) : currentItem.thumbnail || currentItem.url ? (
          <img 
            src={getProxyImageUrl(currentItem.thumbnail || currentItem.url)} 
            alt={currentItem.title}
            referrerPolicy="no-referrer"
            className="max-w-full max-h-[80vh] object-contain rounded-xl select-none"
            draggable={false}
          />
        ) : (
          <div className="text-white/30 text-sm font-semibold select-none">No media display available</div>
        )}

        {/* Previous Action Trigger (paddles left) */}
        {index > 0 && (
          <button 
            onClick={handlePrev}
            className="absolute left-6 w-12 h-12 hidden md:flex items-center justify-center bg-black/45 hover:bg-black/70 border border-white/5 text-white rounded-full backdrop-blur transition"
          >
            <ChevronLeft className="w-6 h-6 mr-0.5" />
          </button>
        )}

        {/* Next Action Trigger (paddles right) */}
        {index < mediaItems.length - 1 && (
          <button 
            onClick={handleNext}
            className="absolute right-6 w-12 h-12 hidden md:flex items-center justify-center bg-black/45 hover:bg-black/70 border border-white/5 text-white rounded-full backdrop-blur transition"
          >
            <ChevronRight className="w-6 h-6 ml-0.5" />
          </button>
        )}
      </div>

      {/* Media Details Footer */}
      <div className="p-4 px-6 text-center select-none bg-[#050505]/40 backdrop-blur shrink-0 max-w-2xl mx-auto mb-2 text-white overflow-hidden">
        <h4 className="text-sm font-bold truncate tracking-wide max-w-full">
          {currentItem.title || currentItem.domain || 'Untitled'}
        </h4>
        <p className="text-[11px] text-white/50 truncate mt-0.5">
          {currentItem.domain || currentItem.type}
        </p>
      </div>
    </div>
  );
};
