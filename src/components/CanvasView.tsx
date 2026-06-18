import React, { useState, useRef, useEffect } from 'react';
import { Card } from './Card';
import { ArchiveItem, CanvasPosition, CanvasFrame } from '../types';
import { Plus, Minus, RotateCcw, BoxSelect, Trash2 } from 'lucide-react';

interface CanvasViewProps {
  items: ArchiveItem[];
  canvasPositions: Record<string, CanvasPosition>;
  canvasFrames: Record<string, CanvasFrame>;
  onConfigUpdate: (pos: Record<string, CanvasPosition>, frames: Record<string, CanvasFrame>) => void;
  onFavoriteChange: (id: string, isFav: boolean) => void;
  onItemClick: (id: string, event: React.MouseEvent) => void;
  onZoomClick: (id: string, event: React.MouseEvent) => void;
}

export const CanvasView: React.FC<CanvasViewProps> = ({
  items,
  canvasPositions,
  canvasFrames,
  onConfigUpdate,
  onFavoriteChange,
  onItemClick,
  onZoomClick
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  
  // Drag states
  const [dragItem, setDragItem] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [dragFrame, setDragFrame] = useState<{ id: string; offsetX: number; offsetY: number; startPos: CanvasPosition; childItems: string[] } | null>(null);
  const [resizeFrame, setResizeFrame] = useState<{ id: string; startW: number; startH: number; startX: number; startY: number } | null>(null);
  
  // Local volatile positions during drag for smooth updates
  const [localPos, setLocalPos] = useState<Record<string, CanvasPosition>>({});
  const [localFrames, setLocalFrames] = useState<Record<string, CanvasFrame>>({});

  const panStartRef = useRef({ x: 0, y: 0 });
  const mouseStartRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);

  // Sync incoming props to local state
  useEffect(() => {
    setLocalPos(canvasPositions || {});
    setLocalFrames(canvasFrames || {});
  }, [canvasPositions, canvasFrames]);

  // Layout default positions on mount or items change if they don't exist yet
  useEffect(() => {
    let changed = false;
    const CW = 220; // Card width
    const CH = 260; // Card estimate height
    const COLS = 6;
    const SX = 40;
    const SY = 40;

    const newPositions = { ...canvasPositions };

    items.forEach((item, index) => {
      if (!newPositions[item.id]) {
        const col = index % COLS;
        const row = Math.floor(index / COLS);
        const x = SX + col * (CW + 20);
        const y = SY + row * (CH + 20);
        newPositions[item.id] = { x, y };
        changed = true;
      }
    });

    if (changed) {
      onConfigUpdate(newPositions, canvasFrames);
    }
  }, [items, canvasPositions, canvasFrames, onConfigUpdate]);

  const getItemsInFrame = (frame: CanvasFrame, positions: Record<string, CanvasPosition>) => {
    const CW = 220;
    const CH = 180;
    const contained: string[] = [];
    
    items.forEach(item => {
      const pos = positions[item.id];
      if (!pos) return;
      const midX = pos.x + CW/2;
      const midY = pos.y + CH/2;
      
      if (midX >= frame.x && midX <= frame.x + frame.w && midY >= frame.y && midY <= frame.y + frame.h) {
        contained.push(item.id);
      }
    });
    
    return contained;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const cardEl = target.closest('.c-card');
    const resizeHandle = target.closest('.frame-resize-handle');
    const frameEl = target.closest('.c-frame');
    
    // Prevent dragging when interacting with interactive card elements
    if (target.closest('[data-fav]') || target.closest('.card-img-wrap')) return;

    if (cardEl) {
      e.preventDefault();
      const id = (cardEl as HTMLElement).dataset.id!;
      const rect = cardEl.getBoundingClientRect();
      
      setDragItem({
        id,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top
      });
      hasDraggedRef.current = false;
      mouseStartRef.current = { x: e.clientX, y: e.clientY };
      return;
    } 
    
    if (resizeHandle && frameEl) {
      e.preventDefault();
      e.stopPropagation();
      const id = (frameEl as HTMLElement).dataset.id!;
      const frame = localFrames[id];
      setResizeFrame({
        id,
        startW: frame.w,
        startH: frame.h,
        startX: e.clientX,
        startY: e.clientY
      });
      hasDraggedRef.current = false;
      return;
    }

    if (frameEl && !resizeHandle) {
      // Dragging a frame header or body
      if (target.tagName.toLowerCase() === 'input' || target.tagName.toLowerCase() === 'button') return;
      
      e.preventDefault();
      const id = (frameEl as HTMLElement).dataset.id!;
      const frame = localFrames[id];
      const rect = frameEl.getBoundingClientRect();
      const childItems = getItemsInFrame(frame, localPos);
      
      setDragFrame({
        id,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        startPos: { x: frame.x, y: frame.y },
        childItems
      });
      hasDraggedRef.current = false;
      mouseStartRef.current = { x: e.clientX, y: e.clientY };
      return;
    }
    
    // Pan background
    setIsPanning(true);
    panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragItem) {
      const distance = Math.hypot(e.clientX - mouseStartRef.current.x, e.clientY - mouseStartRef.current.y);
      if (distance > 4) hasDraggedRef.current = true;
      
      if (hasDraggedRef.current) {
        const worldEl = document.getElementById('canvas-world');
        if (worldEl) {
          const wr = worldEl.getBoundingClientRect();
          const x = (e.clientX - wr.left - dragItem.offsetX) / scale;
          const y = (e.clientY - wr.top - dragItem.offsetY) / scale;
          setLocalPos(prev => ({ ...prev, [dragItem.id]: { x, y } }));
        }
      }
    } else if (resizeFrame) {
      const distance = Math.hypot(e.clientX - resizeFrame.startX, e.clientY - resizeFrame.startY);
      if (distance > 4) hasDraggedRef.current = true;
      
      if (hasDraggedRef.current) {
        const dx = (e.clientX - resizeFrame.startX) / scale;
        const dy = (e.clientY - resizeFrame.startY) / scale;
        
        setLocalFrames(prev => ({
          ...prev,
          [resizeFrame.id]: {
            ...prev[resizeFrame.id],
            w: Math.max(260, resizeFrame.startW + dx),
            h: Math.max(200, resizeFrame.startH + dy)
          }
        }));
      }
    } else if (dragFrame) {
      const distance = Math.hypot(e.clientX - mouseStartRef.current.x, e.clientY - mouseStartRef.current.y);
      if (distance > 4) hasDraggedRef.current = true;
      
      if (hasDraggedRef.current) {
        const worldEl = document.getElementById('canvas-world');
        if (worldEl) {
          const wr = worldEl.getBoundingClientRect();
          const x = (e.clientX - wr.left - dragFrame.offsetX) / scale;
          const y = (e.clientY - wr.top - dragFrame.offsetY) / scale;
          
          const dx = x - dragFrame.startPos.x;
          const dy = y - dragFrame.startPos.y;
          
          setLocalFrames(prev => ({ ...prev, [dragFrame.id]: { ...prev[dragFrame.id], x, y } }));
          
          // Move children synchronously
          const nextPos = { ...localPos };
          dragFrame.childItems.forEach(childId => {
            const initialPos = canvasPositions[childId];
            if (initialPos) {
              nextPos[childId] = { x: initialPos.x + dx, y: initialPos.y + dy };
            }
          });
          setLocalPos(nextPos);
        }
      }
    } else if (isPanning) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y
      });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (dragItem) {
      if (!hasDraggedRef.current) onItemClick(dragItem.id, e);
      else onConfigUpdate(localPos, localFrames);
      setDragItem(null);
    }
    if (resizeFrame) {
      if (hasDraggedRef.current) onConfigUpdate(localPos, localFrames);
      setResizeFrame(null);
    }
    if (dragFrame) {
      if (hasDraggedRef.current) onConfigUpdate(localPos, localFrames);
      setDragFrame(null);
    }
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    const newScale = Math.max(0.05, Math.min(5, scale * factor));
    
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      setPan(prev => ({
        x: mouseX - (mouseX - prev.x) * (newScale / scale),
        y: mouseY - (mouseY - prev.y) * (newScale / scale)
      }));
      setScale(newScale);
    }
  };

  // Touch logic map implementation
  const touchStartRef = useRef<CanvasPosition | null>(null);
  const initialTouchDistanceRef = useRef(0);
  const initialTouchScaleRef = useRef(1);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[1]?.clientY || e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      touchStartRef.current = null;
      initialTouchDistanceRef.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialTouchScaleRef.current = scale;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const cardEl = (e.target as HTMLElement).closest('.c-card');
    if (cardEl) return;

    if (e.touches.length === 1 && touchStartRef.current) {
      const dx = e.touches[0].clientX - touchStartRef.current.x;
      const dy = e.touches[0].clientY - touchStartRef.current.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2 && initialTouchDistanceRef.current) {
      const currentDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const newScale = Math.max(0.1, Math.min(4, initialTouchScaleRef.current * (currentDistance / initialTouchDistanceRef.current)));
      setScale(newScale);
    }
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
    initialTouchDistanceRef.current = 0;
  };

  const handleZoomIn = () => {
    if (containerRef.current) {
      const cx = containerRef.current.offsetWidth / 2;
      const cy = containerRef.current.offsetHeight / 2;
      const newScale = Math.min(5, scale * 1.25);
      setPan(prev => ({
        x: cx - (cx - prev.x) * (newScale / scale),
        y: cy - (cy - prev.y) * (newScale / scale)
      }));
      setScale(newScale);
    }
  };

  const handleZoomOut = () => {
    if (containerRef.current) {
      const cx = containerRef.current.offsetWidth / 2;
      const cy = containerRef.current.offsetHeight / 2;
      const newScale = Math.max(0.05, scale * 0.8);
      setPan(prev => ({
        x: cx - (cx - prev.x) * (newScale / scale),
        y: cy - (cy - prev.y) * (newScale / scale)
      }));
      setScale(newScale);
    }
  };

  const handleReset = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  const handleAddFrame = () => {
    const id = 'frame-' + Date.now();
    // Create frame in the center of the viewport
    const cx = ((containerRef.current?.offsetWidth || 800) / 2 - pan.x) / scale;
    const cy = ((containerRef.current?.offsetHeight || 600) / 2 - pan.y) / scale;
    
    onConfigUpdate(localPos, {
      ...localFrames,
      [id]: {
        id,
        title: 'New Container',
        x: cx - 250,
        y: cy - 200,
        w: 500,
        h: 400,
        color: '#1e1e1e'
      }
    });
  };
  
  const handleDeleteFrame = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const next = { ...localFrames };
    delete next[id];
    onConfigUpdate(localPos, next);
  };
  
  const handleFrameTitleChange = (id: string, title: string) => {
    setLocalFrames(prev => ({ ...prev, [id]: { ...prev[id], title } }));
  };

  const handleFrameTitleBlur = () => {
    onConfigUpdate(localPos, localFrames);
  };

  return (
    <div 
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`
        w-full h-full overflow-hidden absolute inset-0 select-none bg-[var(--app-bg)]
        ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}
      `}
    >
      <div 
        className="absolute inset-0 bg-[var(--app-bg)]"
        style={{
          backgroundImage: 'radial-gradient(var(--text-dim) 1.5px, transparent 1.5px)',
          backgroundSize: '24px 24px',
          backgroundPosition: `${pan.x}px ${pan.y}px`,
          opacity: 0.6
        }}
      />

      <div 
        id="canvas-world"
        className="absolute origin-top-left will-change-transform"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
      >
        {/* Render Frames (Background Level) */}
        {(Object.values(localFrames) as CanvasFrame[]).map((frame: CanvasFrame) => (
          <div
            key={frame.id}
            data-id={frame.id}
            className="c-frame absolute rounded-2xl border border-[var(--border)] bg-[var(--surface-higher)]/60 backdrop-blur-md shadow-sm transition-colors group"
            style={{ left: frame.x, top: frame.y, width: frame.w, height: frame.h, zIndex: 1 }}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--text)]/5 rounded-t-2xl cursor-grab active:cursor-grabbing">
              <input 
                type="text"
                value={frame.title}
                onChange={e => handleFrameTitleChange(frame.id, e.target.value)}
                onBlur={handleFrameTitleBlur}
                className="bg-transparent border-none text-[var(--text)]/90 font-bold uppercase tracking-widest text-xs focus:outline-none focus:text-[#0A84FF] w-full"
                placeholder="Name Container..."
              />
              <button 
                onClick={(e) => handleDeleteFrame(e, frame.id)}
                className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-dim)] hover:text-red-500 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            
            <div className="absolute bottom-0 right-0 w-6 h-6 frame-resize-handle cursor-se-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow bg-[var(--text)]/5 rounded-tl-xl rounded-br-2xl">
              <div className="w-2 h-2 bg-[var(--text-dim)] rounded-full" />
            </div>
          </div>
        ))}

        {/* Render Cards (Foreground Level) */}
        {items.map((item) => {
          const pos = localPos[item.id] || { x: 0, y: 0 };
          return (
            <div
              key={item.id}
              data-id={item.id}
              className="c-card absolute"
              style={{
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                zIndex: dragItem?.id === item.id ? 999 : 10
              }}
            >
              <Card
                item={item}
                onFavoriteChange={onFavoriteChange}
                onClick={onItemClick}
                onZoomClick={onZoomClick}
                isCanvas={true}
              />
            </div>
          );
        })}
      </div>

      <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-50">
        <button 
          onClick={handleAddFrame}
          title="Add Nested Container Frame"
          className="w-11 h-11 bg-[var(--surface-higher)] border border-[var(--border)] text-[var(--text)] flex items-center justify-center rounded-2xl hover:bg-[var(--surface)] hover:scale-105 transition shadow-lg shrink-0 mb-4 text-[#0A84FF]"
        >
          <BoxSelect className="w-5 h-5" />
        </button>

        <button 
          onClick={handleZoomIn}
          className="w-11 h-11 bg-[var(--surface-higher)] border border-[var(--border)] text-[var(--text)] flex items-center justify-center rounded-2xl hover:bg-[var(--surface)] hover:scale-105 transition shadow-lg shrink-0"
        >
          <Plus className="w-5 h-5" />
        </button>
        <div className="text-xs font-bold text-[var(--text-dim)] text-center select-none py-0.5">
          {Math.round(scale * 100)}%
        </div>
        <button 
          onClick={handleZoomOut}
          className="w-11 h-11 bg-[var(--surface-higher)] border border-[var(--border)] text-[var(--text)] flex items-center justify-center rounded-2xl hover:bg-[var(--surface)] hover:scale-105 transition shadow-lg shrink-0"
        >
          <Minus className="w-5 h-5" />
        </button>
        <button 
          onClick={handleReset}
          title="Reset Zoom & Pan"
          className="w-11 h-11 bg-[var(--surface-higher)] border border-[var(--border)] text-[var(--text)] flex items-center justify-center rounded-2xl hover:bg-[var(--surface)] hover:scale-105 transition shadow-lg shrink-0"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
