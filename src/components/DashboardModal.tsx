import React from 'react';
import { X, TrendingUp, Heart, FolderHeart, Eye, Award, Clock } from 'lucide-react';
import { ArchiveItem } from '../types';
import { reltime } from '../lib/archive';
import { Favicon } from './Favicon';

interface DashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: ArchiveItem[];
  collections: string[];
}

const TYPE_COLORS: Record<string, string> = {
  link: '#ffffff',     
  image: '#cccccc',    
  video: '#999999',    
  pdf: '#666666',      
  document: '#444444', 
  html: '#222222'      
};

export const DashboardModal: React.FC<DashboardModalProps> = ({
  isOpen,
  onClose,
  items,
  collections
}) => {
  if (!isOpen) return null;

  const total = items.length;
  const favs = items.filter(x => x.favorite).length;

  // Track Type Distribution
  const types: Record<string, number> = {};
  items.forEach(x => {
    types[x.type] = (types[x.type] || 0) + 1;
  });

  // Track Max Opens Item
  let maxOpenItem: ArchiveItem | null = null;
  items.forEach(x => {
    if (!maxOpenItem || (x.openCount || 0) > (maxOpenItem.openCount || 0)) {
      maxOpenItem = x;
    }
  });

  // Track Top Domain
  const domCounts: Record<string, number> = {};
  items.forEach(x => {
    if (x.domain && x.domain !== 'local upload' && x.domain !== '') {
      domCounts[x.domain] = (domCounts[x.domain] || 0) + 1;
    }
  });
  const topDomEntry = Object.entries(domCounts).sort((a, b) => b[1] - a[1])[0];

  // Recently archived logs
  const recent = [...items].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);

  // Layout stats collections progress bars
  const colStats = collections.map(col => ({
    col,
    cnt: items.filter(x => (x.collections || []).includes(col)).length
  })).filter(x => x.cnt > 0).sort((a, b) => b.cnt - a.cnt);

  return (
    <div className="fixed inset-0 bg-black/60 z-1000 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div 
        className="fixed inset-0"
        onClick={onClose}
      />
      
      <div className="bg-[var(--app-bg)] border border-[var(--border)] w-full max-w-2xl max-h-[82vh] overflow-y-auto rounded-3xl shadow-2xl relative z-10 flex flex-col">
        {/* Header bar */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-[var(--border)] sticky top-0 bg-[var(--app-bg)]/90 backdrop-blur-md z-20 shrink-0">
          <h2 className="text-base font-bold text-[var(--text)] tracking-tight flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[var(--text)]" />
            <span>Dashboard Metrics</span>
          </h2>
          <button 
            onClick={onClose}
            className="text-[var(--text-dim)] hover:text-[var(--text)] p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 flex flex-col gap-6 overflow-y-auto">
          {/* Bento boxes grid metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 select-none">
            <div className="bg-[var(--text)]/5 border border-[var(--border)] p-4 rounded-2xl flex flex-col justify-between">
              <span className="text-[10px] font-bold text-[var(--text-dim)] tracking-wider uppercase">Total Items</span>
              <span className="text-3xl font-extrabold text-[var(--text)] mt-1 tracking-tight font-display">{total}</span>
            </div>
            
            <div className="bg-[var(--text)]/5 border border-[var(--border)] p-4 rounded-2xl flex flex-col justify-between">
              <span className="text-[10px] font-bold text-[var(--text-dim)] tracking-wider uppercase">Favorites</span>
              <span className="text-3xl font-extrabold text-[var(--text)] mt-1 tracking-tight flex items-center gap-1.5 font-display">
                <Heart className="w-6 h-6 text-[var(--text)] fill-[var(--text)] shrink-0" />
                <span>{favs}</span>
              </span>
            </div>
            
            <div className="bg-[var(--text)]/5 border border-[var(--border)] p-4 rounded-2xl flex flex-col justify-between">
              <span className="text-[10px] font-bold text-[var(--text-dim)] tracking-wider uppercase">Collections</span>
              <span className="text-3xl font-extrabold text-[var(--text)] mt-1 tracking-tight font-display">{collections.length}</span>
            </div>

            <div className="bg-[var(--text)]/5 border border-[var(--border)] p-4 rounded-2xl flex flex-col justify-between">
              <span className="text-[10px] font-bold text-[var(--text-dim)] tracking-wider uppercase">Max Opens</span>
              <div>
                <span className="text-2xl font-extrabold text-[var(--text)] tracking-tight flex items-center gap-1 font-display">
                  <Eye className="w-5 h-5 text-[var(--text-dim)]" />
                  <span>{maxOpenItem ? (maxOpenItem as ArchiveItem).openCount || 0 : 0}</span>
                </span>
                {maxOpenItem && (
                  <span className="text-[9px] text-[var(--text-dim)] truncate block max-w-full italic mt-0.5">
                    {(maxOpenItem as ArchiveItem).title}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Top Domain Indicator badge */}
          {topDomEntry && (
            <div className="p-3 bg-[var(--text)]/5 border border-[var(--border)] rounded-xl flex items-center gap-2.5 select-text text-sm">
              <Favicon domain={topDomEntry[0]} className="w-4 h-4 rounded" />
              <span className="text-[var(--text-muted)] font-semibold tracking-wide text-xs">{topDomEntry[0]}</span>
              <span className="text-[10px] text-[var(--app-bg)] bg-[var(--text)] font-black px-2 py-0.5 rounded ml-auto uppercase tracking-wide">
                Top Domain ({topDomEntry[1]} saved)
              </span>
            </div>
          )}

          {/* Type Distribution segment blocks */}
          <div className="flex flex-col gap-2 select-none">
            <span className="text-[10px] font-bold tracking-widest text-[var(--text-dim)] uppercase">Format Distribution</span>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-[var(--text)]/5 border border-[var(--border)]">
              {Object.entries(types).map(([type, cnt]) => {
                const fraction = total ? (cnt / total) * 100 : 0;
                if (fraction === 0) return null;
                return (
                  <div
                    key={type}
                    style={{ width: `${fraction}%`, backgroundColor: TYPE_COLORS[type] || '#333' }}
                    className="h-full"
                    title={`${type}: ${cnt} items (${fraction.toFixed(1)}%)`}
                  />
                );
              })}
            </div>
            {/* Legend grids */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-4 mt-1.5">
              {Object.entries(types).map(([type, cnt]) => (
                <div key={type} className="flex items-center gap-2 text-xs">
                  <div 
                    className="w-2.5 h-2.5 rounded-full shrink-0 border border-[var(--border)]" 
                    style={{ backgroundColor: TYPE_COLORS[type] || '#333' }}
                  />
                  <span className="capitalize text-[var(--text-muted)] font-semibold">{type}</span>
                  <span className="text-[var(--text-dim)] font-medium font-mono text-[11px]">({cnt})</span>
                </div>
              ))}
            </div>
          </div>

          {/* Collections representation bars */}
          {colStats.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold tracking-widest text-[var(--text-dim)] uppercase mb-1">Collections coverage</span>
              <div className="flex flex-col gap-2.5">
                {colStats.map(({ col, cnt }) => {
                  const pct = total ? Math.round((cnt / total) * 100) : 0;
                  return (
                    <div key={col} className="flex flex-col gap-1.5 text-xs text-[var(--text-muted)]">
                      <div className="flex justify-between items-center font-semibold">
                        <span>{col}</span>
                        <span className="font-mono text-[var(--text-dim)]/50">{cnt} items ({pct}%)</span>
                      </div>
                      <div className="w-full h-1 bg-[var(--text)]/5 rounded-full overflow-hidden">
                        <div 
                          style={{ width: `${pct}%` }} 
                          className="h-full bg-[var(--text)] rounded-full" 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Timeline of recent items saves */}
          {recent.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold tracking-widest text-[var(--text-dim)] uppercase mb-1">Recent Saves logs</span>
              <div className="flex flex-col gap-0 border border-[var(--border)] rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
                {recent.map((x) => (
                  <div key={x.id} className="flex items-center justify-between p-3 px-4 bg-[var(--text)]/2">
                    <div className="flex items-center gap-3 overflow-hidden mr-2">
                      <span className="text-[var(--text)] text-xs font-mono select-none">◈</span>
                      <span className="text-xs font-bold text-[var(--text)] truncate max-w-[340px] select-text">
                        {x.title || x.domain || 'Untitled'}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-[var(--text-dim)] shrink-0 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[var(--text-dim)]/50 shrink-0" />
                      <span>{reltime(x.createdAt)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer selector bar */}
        <div className="p-4 px-6 border-t border-[var(--border)] flex justify-end shrink-0 select-none">
          <button
            onClick={onClose}
            className="h-9 px-5 bg-[var(--text)]/5 hover:bg-[var(--text)]/10 text-[var(--text)] text-xs font-semibold rounded-xl border border-[var(--border)] transition"
          >
            Close Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
