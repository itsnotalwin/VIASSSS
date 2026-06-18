import React, { useState } from 'react';
import { 
  Grid, ImageIcon, Video, FileText, Link, Heart, Folder, Tag, 
  SortDesc, SortAsc, Eye, Type, Globe, Plus, X, Search, BarChart2, Download, Settings, Sun, Moon 
} from 'lucide-react';
import { ArchiveItem, FilterState, Colony } from '../types';
import { Favicon } from './Favicon';
import { Sparkles, Loader2 } from 'lucide-react';

interface SidebarProps {
  items: ArchiveItem[];
  collections: string[];
  colonies: Colony[];
  isClustering: boolean;
  onAutoCluster: () => void;
  isTagging: boolean;
  onAutoTag: () => void;
  filter: FilterState;
  onFilterChange: (patch: Partial<FilterState>) => void;
  onAddCollection: (name: string) => void;
  onDeleteCollection: (name: string) => void;
  gridCols: string;
  onGridColsChange: (cols: string) => void;
  onOpenDashboard: () => void;
  onOpenImportExport: () => void;
  onOpenSettings: () => void;
  isOpen: boolean;
  onClose: () => void;
  view: 'grid' | 'canvas';
  onViewChange: (view: 'grid' | 'canvas') => void;
  darkMode: boolean;
  onToggleTheme: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  items,
  collections,
  filter,
  onFilterChange,
  onAddCollection,
  onDeleteCollection,
  gridCols,
  onGridColsChange,
  onOpenDashboard,
  onOpenImportExport,
  onOpenSettings,
  isOpen,
  onClose,
  view,
  onViewChange,
  darkMode,
  onToggleTheme,
  colonies,
  isClustering,
  onAutoCluster,
  isTagging,
  onAutoTag
}) => {
  const [newColName, setNewColName] = useState('');
  const [showAddCol, setShowAddCol] = useState(false);

  const getCount = (type: string) => {
    if (type === 'all') return items.length;
    if (type === 'favorite') return items.filter(x => x.favorite).length;
    return items.filter(x => x.type === type).length;
  };

  const getColCount = (col: string) => {
    return items.filter(x => (x.collections || []).includes(col)).length;
  };

  const domainCounts: Record<string, number> = {};
  items.forEach(x => {
    if (x.domain && x.domain !== 'local upload') {
      domainCounts[x.domain] = (domainCounts[x.domain] || 0) + 1;
    }
  });

  const sortedDomains = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const tagCounts: Record<string, number> = {};
  items.forEach(x => {
    (x.tags || []).forEach(t => {
      if (t) {
        const trimmed = t.trim().toLowerCase();
        tagCounts[trimmed] = (tagCounts[trimmed] || 0) + 1;
      }
    });
  });

  const sortedTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  const handleAddColSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newColName.trim();
    if (!trimmed) return;
    onAddCollection(trimmed);
    setNewColName('');
    setShowAddCol(false);
  };

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-140 backdrop-blur-xs md:hidden"
          onClick={onClose}
        />
      )}

      <aside 
        className={`
          fixed md:sticky top-0 bottom-0 left-0 w-[280px] md:w-[260px] bg-[var(--app-bg)] border-r border-[var(--border)]
          overflow-y-auto z-[150] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
          md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          h-full flex flex-col justify-between
        `}
        style={{
          paddingTop: 'calc(1rem + env(safe-area-inset-top))',
          paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
          paddingLeft: 'env(safe-area-inset-left)'
        }}
      >
        <div className="flex flex-col gap-6 pt-4">
          {/* Mobile search & view switches */}
          <div className="px-4 flex flex-col gap-3 md:hidden">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] w-4 h-4" />
              <input 
                type="text" 
                placeholder="Search archive..." 
                value={filter.search || ''}
                onChange={(e) => onFilterChange({ search: e.target.value })}
                className="w-full h-10 bg-[var(--text)]/5 border border-[var(--border)] text-[var(--text)] pl-9 pr-4 rounded-xl text-sm focus:outline-none focus:border-[var(--text)] transition"
              />
            </div>
            
            <div className="flex bg-[var(--text)]/5 p-0.5 rounded-lg border border-[var(--border)]">
              <button 
                onClick={() => { onViewChange('grid'); onClose(); }}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition ${view === 'grid' ? 'bg-[var(--text)]/10 text-[var(--text)] shadow' : 'text-[var(--text-muted)]'}`}
              >
                Grid
              </button>
              <button 
                onClick={() => { onViewChange('canvas'); onClose(); }}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition ${view === 'canvas' ? 'bg-[var(--text)]/10 text-[var(--text)] shadow' : 'text-[var(--text-muted)]'}`}
              >
                Spatial Board
              </button>
            </div>

            <button 
              onClick={() => { onOpenDashboard(); onClose(); }}
              className="w-full py-2.5 rounded-xl bg-[var(--text)]/5 hover:bg-[var(--text)]/10 border border-[var(--border)] text-[var(--text)] font-medium text-xs transition"
            >
              Dashboard
            </button>
            <button 
              onClick={() => { onOpenImportExport(); onClose(); }}
              className="w-full py-2.5 rounded-xl bg-[var(--text)]/5 hover:bg-[var(--text)]/10 border border-[var(--border)] text-[var(--text)] font-medium text-xs transition"
            >
              Export / Import
            </button>
            <button 
              onClick={() => { onOpenSettings(); onClose(); }}
              className="w-full py-2.5 rounded-xl bg-[var(--text)]/5 hover:bg-[var(--text)]/10 border border-[var(--border)] text-[var(--text)] font-medium text-xs transition"
            >
              Settings
            </button>
          </div>

          {/* Grid Layout Config (only in grid view) */}
          {view === 'grid' && (
            <div className="flex flex-col gap-1.5">
              <div className="px-4 flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-widest text-[var(--text-dim)] uppercase">Grid Columns</span>
              </div>
              <div className="px-4 grid grid-cols-5 gap-1">
                {(['auto', '1', '2', '3', '4'] as string[]).map((cols) => (
                  <button 
                    key={cols}
                    onClick={() => onGridColsChange(cols)}
                    className={`
                      py-1.5 text-[10px] uppercase tracking-tighter rounded-xl transition font-black border
                      ${gridCols === cols 
                        ? 'bg-[var(--text)] text-[var(--app-bg)] border-[var(--text)] shadow-[0_0_15px_rgba(var(--text-rgb),0.2)]' 
                        : 'bg-[var(--text)]/5 text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--text)] hover:bg-[var(--text)]/10'
                      }
                    `}
                  >
                    {cols === 'auto' ? 'Auto' : cols}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Library Section */}
          <div className="flex flex-col gap-1">
            <div className="px-4">
              <span className="text-[10px] font-bold tracking-widest text-[var(--text-dim)] uppercase">Library</span>
            </div>
            <div className="flex flex-col">
              {[
                { type: 'all', label: 'All Items', icon: Grid },
                { type: 'image', label: 'Images', icon: ImageIcon },
                { type: 'video', label: 'Videos', icon: Video },
                { type: 'pdf', label: 'PDFs', icon: FileText },
                { type: 'link', label: 'Links', icon: Link },
                { type: 'favorite', label: 'Favorites', icon: Heart }
              ].map(({ type, label, icon: Icon }) => {
                const isActive = filter.type === type && filter.collection === null && filter.domain === null;
                return (
                  <button
                    key={type}
                    onClick={() => {
                      onFilterChange({ type, collection: null, domain: null });
                      onClose();
                    }}
                    className={`
                      flex items-center justify-between px-4 py-2 text-sm text-left transition
                      ${isActive ? 'bg-[var(--text)]/5 text-[var(--text)] font-extrabold' : 'text-[var(--text-muted)] hover:bg-[var(--text)]/5 hover:text-[var(--text)]'}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-[var(--text)]' : 'text-[var(--text-dim)]'}`} />
                      <span>{label}</span>
                    </div>
                    <span className={`text-xs ${isActive ? 'text-[var(--text)]' : 'text-[var(--text-dim)]'}`}>
                      {getCount(type)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Websites Section */}
          {sortedDomains.length > 0 && (
            <div className="flex flex-col gap-1">
              <div className="px-4">
                <span className="text-[10px] font-bold tracking-widest text-[var(--text-dim)] uppercase">Websites</span>
              </div>
              <div className="flex flex-col max-h-[160px] overflow-y-auto">
                {sortedDomains.map(([domain, count]) => {
                  const isActive = filter.domain === domain;
                  return (
                    <button
                      key={domain}
                      onClick={() => {
                        onFilterChange({ 
                          domain: isActive ? null : domain, 
                          collection: null,
                          type: 'all' // Reset asset type filter so we view all links from this website
                        });
                        onClose();
                      }}
                      className={`
                      flex items-center justify-between px-4 py-1.5 text-xs text-left transition
                      ${isActive ? 'bg-[var(--text)]/5 text-[var(--text)] font-bold' : 'text-[var(--text)]/80 hover:bg-[var(--text)]/5'}
                    `}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <Favicon domain={domain} className="w-4 h-4 rounded-sm" />
                      <span className="truncate">{domain}</span>
                    </div>
                    <span className={`text-[10px] font-medium ml-2 ${isActive ? 'text-[var(--text)]' : 'text-[var(--text-dim)]'}`}>
                      {count}
                    </span>
                  </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sorting configuration */}
          <div className="flex flex-col gap-1">
            <div className="px-4">
              <span className="text-[10px] font-bold tracking-widest text-[var(--text-dim)] uppercase">Sort By</span>
            </div>
            <div className="flex flex-col">
              {[
                { sort: 'newest', label: 'Newest First', icon: SortDesc },
                { sort: 'oldest', label: 'Oldest First', icon: SortAsc },
                { sort: 'opens', label: 'Most Opened', icon: Eye },
                { sort: 'alpha', label: 'Alphabetical', icon: Type }
              ].map(({ sort, label, icon: Icon }) => {
                const isActive = filter.sort === sort;
                return (
                  <button
                    key={sort}
                    onClick={() => {
                      onFilterChange({ sort: sort as any });
                      onClose();
                    }}
                    className={`
                      flex items-center gap-3 px-4 py-2 text-sm text-left transition
                      ${isActive ? 'bg-[var(--text)]/5 text-[var(--text)] font-bold' : 'text-[var(--text)]/80 hover:bg-[var(--text)]/5'}
                    `}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[var(--text)]' : 'text-[var(--text-dim)]'}`} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Colonies Section */}
          <div className="flex flex-col gap-1">
            <div className="px-4 flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-widest text-[var(--text-dim)] uppercase">Colonies</span>
            </div>
            <div className="flex flex-col">
              {colonies.length === 0 ? (
                <div className="px-4 py-3 text-[10px] text-[var(--text-dim)] italic leading-relaxed">
                  No colonies formed yet. Run Auto-Cluster to group items.
                </div>
              ) : (
                colonies.map((colony) => {
                  const isActive = filter.collection === colony.id;
                  return (
                    <button
                      key={colony.id}
                      onClick={() => {
                        onFilterChange({ collection: colony.id, domain: null });
                        onClose();
                      }}
                      className={`
                        flex items-center justify-between px-4 py-2 text-sm text-left transition
                        ${isActive ? 'bg-[var(--text)]/5 text-[var(--text)] font-bold' : 'text-[var(--text)]/60 hover:bg-[var(--text)]/5'}
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <Folder className={`w-4 h-4 ${isActive ? 'text-[var(--text)]' : 'text-[var(--text-dim)]'}`} />
                        <span>{colony.name}</span>
                      </div>
                      <span className="text-[10px] text-[var(--text-dim)] font-mono">{colony.itemIds.length}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Tags Archive Section */}
          <div className="flex flex-col gap-1.5">
            <div className="px-4 flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-widest text-[var(--text-dim)] uppercase">Tags Archive</span>
            </div>
            <div className="flex flex-wrap gap-1 px-4 py-1.5 max-h-[140px] overflow-y-auto">
              {sortedTags.length === 0 ? (
                <div className="text-[10px] text-[var(--text-dim)] italic leading-relaxed py-1 font-mono">
                  No tags indexed. Run Auto-Tag to enrich your board.
                </div>
              ) : (
                sortedTags.map(([tag, count]) => {
                  const isActive = filter.search?.toLowerCase() === tag;
                  return (
                    <button
                      key={tag}
                      onClick={() => {
                        onFilterChange({ 
                          search: isActive ? '' : tag,
                          domain: null,
                          collection: null,
                          type: 'all'
                        });
                        onClose();
                      }}
                      className={`
                        text-[10px] px-2 py-0.5 rounded-full transition-all flex items-center gap-1 border font-medium
                        ${isActive 
                          ? 'bg-[var(--text)] text-[var(--app-bg)] border-[var(--text)] shadow-[0_0_10px_rgba(var(--text-rgb),0.2)] font-black' 
                          : 'bg-[var(--text)]/5 text-[var(--text-muted)] border-[var(--border)] hover:bg-[var(--text)]/10 hover:text-[var(--text)]'
                        }
                      `}
                    >
                      <span>#{tag}</span>
                      <span className={`text-[8px] font-mono ${isActive ? 'text-[var(--app-bg)]/60' : 'text-[var(--text-dim)]'}`}>{count}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Collections Section */}
          <div className="flex flex-col gap-1">
            <div className="px-4 flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-widest text-[var(--text-dim)] uppercase">Collections</span>
              <button 
                onClick={() => setShowAddCol(!showAddCol)}
                className="text-[var(--text-dim)] hover:text-[var(--text)] p-1 rounded transition"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {showAddCol && (
              <form onSubmit={handleAddColSubmit} className="mx-4 mb-2 flex gap-1.5">
                <input 
                  type="text" 
                  placeholder="Collection name..." 
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  className="flex-1 bg-[var(--text)]/5 border border-[var(--border)] rounded-lg px-2.5 py-1 text-xs text-[var(--text)] focus:outline-none focus:border-[#0A84FF]"
                  autoFocus
                />
                <button 
                  type="submit"
                  className="bg-[var(--text)] text-[var(--app-bg)] hover:opacity-80 px-2.5 rounded-lg text-xs font-black uppercase transition shrink-0"
                >
                  Add
                </button>
              </form>
            )}

            <div className="flex flex-col">
              <button
                onClick={() => {
                  onFilterChange({ collection: null, domain: null });
                  onClose();
                }}
                className={`
                  flex items-center justify-between px-4 py-2 text-sm text-left transition
                  ${filter.collection === null && filter.domain === null ? 'bg-[var(--text)]/5 text-[var(--text)] font-bold' : 'text-[var(--text)]/80 hover:bg-[var(--text)]/5'}
                `}
              >
                <div className="flex items-center gap-3">
                  <Folder className="w-4 h-4 text-[var(--text-dim)]" />
                  <span>All Collections</span>
                </div>
                <span className="text-xs text-[var(--text-dim)]">{items.length}</span>
              </button>

              {collections.map((col) => {
                const isActive = filter.collection === col;
                return (
                  <div
                    key={col}
                    className={`
                      group flex items-center justify-between px-4 py-1.5 text-sm text-left transition hover:bg-[var(--text)]/5
                      ${isActive ? 'bg-[var(--text)]/5 text-[var(--text)] font-bold' : 'text-[var(--text)]/80'}
                    `}
                  >
                    <button
                      onClick={() => {
                        onFilterChange({ collection: col, domain: null });
                        onClose();
                      }}
                      className="flex-1 flex items-center gap-3 text-left overflow-hidden mr-2"
                    >
                      <Tag className={`w-4 h-4 shrink-0 ${isActive ? 'text-[var(--text)]' : 'text-[var(--text-dim)]'}`} />
                      <span className="truncate">{col}</span>
                    </button>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${isActive ? 'text-[var(--text)]' : 'text-[var(--text-dim)]'}`}>
                        {getColCount(col)}
                      </span>
                      <button 
                        onClick={() => onDeleteCollection(col)}
                        className="text-[var(--text-dim)] hover:text-red-500 hover:bg-[var(--text)]/5 p-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap"
                        title={`Delete collection ${col}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer info & persistent credits */}
        <div 
          className="px-4 py-4 border-t border-[var(--border)] flex flex-col gap-2 items-center md:items-start select-none"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)' }}
        >
          <div className="text-[10px] font-mono text-[var(--text-dim)] text-center md:text-left w-full mt-1">VIAS.OS Archive Ecosystem</div>
          <div className="text-[9px] font-mono text-[var(--text-muted)]/20 text-center md:text-left w-full">v1.2.0 · Offline Sync · Local Storage</div>
        </div>
      </aside>
    </>
  );
};
