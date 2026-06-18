import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './lib/firebase';
import { idbStorage } from './lib/idb';
import { StartupScreen } from './components/StartupScreen';
import { ArchiveItem, CanvasPosition, FilterState, CanvasFrame, Colony } from './types';
import { 
  fetchMeta, compressImage, 
  detectType, domainOf, ytId, 
  isStaticHost
} from './lib/archive';

// Import Modular Components
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { GridView } from './components/GridView';
import { CanvasView } from './components/CanvasView';
import { DetailPanel } from './components/DetailPanel';
import { DashboardModal } from './components/DashboardModal';
import { ImportExportModal } from './components/ImportExportModal';
import { SettingsModal } from './components/SettingsModal';
import { Lightbox } from './components/Lightbox';
import { ContextMenu } from './components/ContextMenu';
import { QuickActionMenu } from './components/QuickActionMenu';

import { Loader, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  // Sync Data states
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [collections, setCollections] = useState<string[]>(['AI', 'Research', 'Design', 'Inspiration', 'Work']);
  const [canvasPositions, setCanvasPositions] = useState<Record<string, CanvasPosition>>({});
  const [canvasFrames, setCanvasFrames] = useState<Record<string, CanvasFrame>>({});
  
  // UI States
  const [view, setView] = useState<'grid' | 'canvas'>('grid');
  const [gridCols, setGridCols] = useState('auto');
  const [captureInput, setCaptureInput] = useState('');
  const [isIngesting, setIsIngesting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Theme State
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('atlas_theme');
    if (saved) return saved === 'dark';
    return true; // Default to dark mode for the deep dark slate aesthetic
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      localStorage.setItem('atlas_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      localStorage.setItem('atlas_theme', 'light');
    }
  }, [darkMode]);

  // Modals / Overlays States
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [importExportOpen, setImportExportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showSplash, setShowSplash] = useState(false); // Using StartupScreen instead
  const [isStartupComplete, setIsStartupComplete] = useState(false);
  const [colonies, setColonies] = useState<Colony[]>([]);

  // Load colonies from local storage
  useEffect(() => {
    const savedColonies = localStorage.getItem('vias_colonies');
    if (savedColonies) setColonies(JSON.parse(savedColonies));
  }, []);

  // Focus & Contexts
  const [activeDetailId, setActiveDetailId] = useState<string | null>(null);
  const [activeLightboxId, setActiveLightboxId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ itemId: string; x: number; y: number } | null>(null);
  const [quickActionMenu, setQuickActionMenu] = useState<{ itemId: string; x: number; y: number } | null>(null);

  // Filter State
  const [filter, setFilter] = useState<FilterState>({
    type: 'all',
    collection: null,
    domain: null,
    sort: 'newest',
    search: ''
  });

  const handleFilterChange = useCallback((patch: Partial<FilterState>) => {
    setFilter(prev => ({
      ...prev,
      ...patch
    }));
  }, []);

  // Floating notifications toasts
  const [toasts, setToasts] = useState<Array<{ id: number; msg: string }>>([]);

  const addToast = useCallback((msg: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 2500);
  }, []);

  // Sync to database handles
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const handleSaveConfig = useCallback(async (
    newCols?: string[], 
    newPos?: Record<string, CanvasPosition>,
    newFrames?: Record<string, CanvasFrame>
  ) => {
    const targetCols = newCols || collections;
    const targetPos = newPos || canvasPositions;
    const targetFrames = newFrames || canvasFrames;
    
    // Always persist to local immediately
    localStorage.setItem('atlas_cols', JSON.stringify(targetCols));
    localStorage.setItem('atlas_cpos', JSON.stringify(targetPos));
    localStorage.setItem('atlas_cframes', JSON.stringify(targetFrames));

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    
    // Debounce Firestore writes to prevent overwhelming the quotas and rate limits
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await setDoc(doc(db, 'shared_config', 'main'), {
          collections: targetCols,
          canvasPositions: targetPos,
          canvasFrames: targetFrames
        }, { merge: true });
      } catch (e) {
        console.warn('Syncing configuration failed', e);
        handleFirestoreError(e, OperationType.WRITE, 'shared_config/main');
      }
    }, 1000); // 1000ms debounce
  }, [collections, canvasPositions, canvasFrames]);

  // Initial Load & Offline Bindings
  useEffect(() => {
    // 0. Handle PWA Shared Content
    const params = new URLSearchParams(window.location.search);
    const sharedUrl = params.get('url') || params.get('text');
    if (sharedUrl) {
      setCaptureInput(sharedUrl);
      // Clear params from URL
      window.history.replaceState({}, '', '/');
    }

    // 1. Load Local Fallbacks
    try {
      const localItems = localStorage.getItem('atlas_items');
      if (localItems) setItems(JSON.parse(localItems));

      const localCols = localStorage.getItem('atlas_cols');
      if (localCols) setCollections(JSON.parse(localCols));

      const localPos = localStorage.getItem('atlas_cpos');
      if (localPos) setCanvasPositions(JSON.parse(localPos));

      const localFrames = localStorage.getItem('atlas_cframes');
      if (localFrames) setCanvasFrames(JSON.parse(localFrames));

      const localGrid = localStorage.getItem('vias_grid_cols');
      if (localGrid) setGridCols(localGrid);
    } catch (e) {
      console.warn('Failed loading local backups cache', e);
    }

    // 2. Hydrate & Initialize IndexedDB
    idbStorage.init().then(() => {
      // IndexedDB ready
    }).catch(e => console.warn('IndexedDB unavailable', e));

    // 3. Connect real-time Firestore listeners
    const qItems = query(collection(db, 'shared_items'), orderBy('createdAt', 'desc'));
    const unsubItems = onSnapshot(qItems, (snapshot) => {
      const remoteItems: ArchiveItem[] = [];
      snapshot.forEach((doc) => {
        remoteItems.push(doc.data() as ArchiveItem);
      });
      
      if (remoteItems.length === 0) {
        const hasSeeded = localStorage.getItem('atlas_seeded_b');
        if (!hasSeeded) {
          localStorage.setItem('atlas_seeded_b', 'true');
          const starters: ArchiveItem[] = [
            {
              id: 'starter-1',
              type: 'link',
              url: 'https://www.pinterest.com/pin/retro-futurism-design-inspiration',
              title: 'Retro Futurist Poster Designs',
              description: 'A beautiful collection of mid-century space-age masterworks and vintage design layout systems.',
              thumbnail: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=400&auto=format&fit=crop&q=80',
              domain: 'pinterest.com',
              tags: ['Design', 'Poster', 'Retro'],
              collections: ['Inspiration', 'Design'],
              createdAt: Date.now() - 3600000 * 2,
              updatedAt: Date.now() - 3600000 * 2,
              openCount: 5,
              favorite: true
            },
            {
              id: 'starter-2',
              type: 'image',
              url: 'https://unsplash.com/photos/minimalist-architecture',
              title: 'Minimalist Architectural Line-work',
              description: 'Striking monochrome captures highlighting structure, geometric alignment, and deep contrast styling.',
              thumbnail: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&auto=format&fit=crop&q=80',
              domain: 'unsplash.com',
              tags: ['Architecture', 'Minimal', 'Layout'],
              collections: ['Research', 'Inspiration'],
              createdAt: Date.now() - 3600000 * 5,
              updatedAt: Date.now() - 3600000 * 5,
              openCount: 2,
              favorite: false
            },
            {
              id: 'starter-3',
              type: 'link',
              url: 'https://dribbble.com/shots/dashboard-bento',
              title: 'SaaS Bento Dashboard Framework',
              description: 'Modern high-density user interface conceptual layout featuring dark modes and micro widgets.',
              thumbnail: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&auto=format&fit=crop&q=80',
              domain: 'dribbble.com',
              tags: ['UI', 'UX', 'Bento'],
              collections: ['Design', 'Work'],
              createdAt: Date.now() - 3600000 * 12,
              updatedAt: Date.now() - 3600000 * 12,
              openCount: 9,
              favorite: true
            },
            {
              id: 'starter-4',
              type: 'video',
              url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
              title: 'Motion Design Masterclass',
              description: 'Breaking down spatial timing loops, organic spring physics curves, and interactive touch responses.',
              thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=80',
              domain: 'youtube.com',
              tags: ['Web', 'Motion', 'Dynamics'],
              collections: ['Research'],
              createdAt: Date.now() - 3600000 * 24,
              updatedAt: Date.now() - 3600000 * 24,
              openCount: 12,
              favorite: false
            },
            {
              id: 'starter-5',
              type: 'link',
              url: 'https://www.behance.net/gallery/nordic-branding',
              title: 'Nordic Branding Identity Package',
              description: 'Tactile editorial packaging layouts with off-black palettes, clean typography, and sustainable materials.',
              thumbnail: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=400&auto=format&fit=crop&q=80',
              domain: 'behance.net',
              tags: ['Branding', 'Assets', 'Design'],
              collections: ['Design', 'Research'],
              createdAt: Date.now() - 3600000 * 48,
              updatedAt: Date.now() - 3600000 * 48,
              openCount: 0,
              favorite: false
            }
          ];

          setItems(starters);
          localStorage.setItem('atlas_items', JSON.stringify(starters));
          starters.forEach(async (it) => {
            try {
              await setDoc(doc(db, 'shared_items', it.id), it);
            } catch (e) {
              console.warn('Seeding failed', e);
              handleFirestoreError(e, OperationType.WRITE, `shared_items/${it.id}`);
            }
          });
        } else {
          setItems([]);
          localStorage.setItem('atlas_items', JSON.stringify([]));
        }
      } else {
        setItems(remoteItems);
        localStorage.setItem('atlas_items', JSON.stringify(remoteItems));
      }
      
      setTimeout(() => setShowSplash(false), 500);
    }, (err) => {
      console.warn('Items sync failed offline fallback active', err);
      handleFirestoreError(err, OperationType.LIST, 'shared_items');
      
      // Offline fallback seeding if local storage is empty too
      const localItems = localStorage.getItem('atlas_items');
      if (!localItems || JSON.parse(localItems).length === 0) {
        const hasSeeded = localStorage.getItem('atlas_seeded_b');
        if (!hasSeeded) {
          localStorage.setItem('atlas_seeded_b', 'true');
          const starters: ArchiveItem[] = [
            {
              id: 'starter-1',
              type: 'link',
              url: 'https://www.pinterest.com/pin/retro-futurism-design-inspiration',
              title: 'Retro Futurist Poster Designs',
              description: 'A beautiful collection of mid-century space-age masterworks and vintage design layout systems.',
              thumbnail: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=400&auto=format&fit=crop&q=80',
              domain: 'pinterest.com',
              tags: ['Design', 'Poster', 'Retro'],
              collections: ['Inspiration', 'Design'],
              createdAt: Date.now() - 3600000 * 2,
              updatedAt: Date.now() - 3600000 * 2,
              openCount: 5,
              favorite: true
            },
            {
              id: 'starter-2',
              type: 'image',
              url: 'https://unsplash.com/photos/minimalist-architecture',
              title: 'Minimalist Architectural Line-work',
              description: 'Striking monochrome captures highlighting structure, geometric alignment, and deep contrast styling.',
              thumbnail: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&auto=format&fit=crop&q=80',
              domain: 'unsplash.com',
              tags: ['Architecture', 'Minimal', 'Layout'],
              collections: ['Research', 'Inspiration'],
              createdAt: Date.now() - 3600000 * 5,
              updatedAt: Date.now() - 3600000 * 5,
              openCount: 2,
              favorite: false
            }
          ];
          setItems(starters);
          localStorage.setItem('atlas_items', JSON.stringify(starters));
        }
      }
      
      setTimeout(() => setShowSplash(false), 500);
    });

    const unsubConfig = onSnapshot(doc(db, 'shared_config', 'main'), (snapshot) => {
      if (snapshot.exists()) {
        const d = snapshot.data();
        if (d.collections) {
          setCollections(d.collections);
          localStorage.setItem('atlas_cols', JSON.stringify(d.collections));
        }
        if (d.canvasPositions) {
          setCanvasPositions(d.canvasPositions);
          localStorage.setItem('atlas_cpos', JSON.stringify(d.canvasPositions));
        }
        if (d.canvasFrames) {
          setCanvasFrames(d.canvasFrames);
          localStorage.setItem('atlas_cframes', JSON.stringify(d.canvasFrames));
        }
      }
    }, (err) => {
      console.warn('Config sync failed offline fallback active', err);
      handleFirestoreError(err, OperationType.GET, 'shared_config/main');
    });

    return () => {
      unsubItems();
      unsubConfig();
    };
  }, []);

  // Update item details
  const handleUpdateItem = useCallback(async (id: string, patch: Partial<ArchiveItem>) => {
    const freshList = items.map(x => x.id === id ? { ...x, ...patch, updatedAt: Date.now() } : x);
    setItems(freshList);
    localStorage.setItem('atlas_items', JSON.stringify(freshList));

    const itemToUpdate = freshList.find(x => x.id === id);
    if (itemToUpdate) {
      try {
        await setDoc(doc(db, 'shared_items', id), itemToUpdate);
      } catch (e) {
        console.warn('Sync failed on update, saved locally', e);
        handleFirestoreError(e, OperationType.UPDATE, `shared_items/${id}`);
      }
    }
  }, [items]);

  // Favorite toggle helper
  const handleFavoriteChange = useCallback((id: string, isFav: boolean) => {
    handleUpdateItem(id, { favorite: isFav });
    if (isFav) {
      if (navigator.vibrate) navigator.vibrate(50);
      addToast('Added to Favorites!');
    } else {
      addToast('Removed from Favorites');
    }
  }, [handleUpdateItem, addToast]);

  // Delete item callback
  const handleDeleteItem = useCallback(async (id: string) => {
    const updatedList = items.filter(x => x.id !== id);
    setItems(updatedList);
    localStorage.setItem('atlas_items', JSON.stringify(updatedList));

    // Delete positions
    const freshPositions = { ...canvasPositions };
    delete freshPositions[id];
    setCanvasPositions(freshPositions);
    localStorage.setItem('atlas_cpos', JSON.stringify(freshPositions));

    // Clear IDB files
    try {
      await idbStorage.delete(id);
    } catch {
      // ignore
    }

    try {
      await deleteDoc(doc(db, 'shared_items', id));
      await handleSaveConfig(collections, freshPositions);
    } catch (e) {
      console.warn('Sync deletion failed', e);
      handleFirestoreError(e, OperationType.DELETE, `shared_items/${id}`);
    }
  }, [items, canvasPositions, collections, handleSaveConfig]);

  // Ingest pasting or input URL
  const handleIngest = useCallback(async () => {
    let url = captureInput.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

    try {
      new URL(url);
    } catch {
      addToast('Invalid URL entered.');
      return;
    }

    setIsIngesting(true);
    try {
      const meta = await fetchMeta(url);
      
      const newItem: ArchiveItem = {
        id: 'item-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        type: meta.type,
        url,
        title: meta.title || meta.domain || 'Untitled Resource',
        description: meta.description || '',
        thumbnail: meta.thumbnail,
        domain: meta.domain,
        tags: [],
        collections: [],
        notes: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        openCount: 0,
        favorite: false
      };

      // Add to state and cloud
      setItems(prev => [newItem, ...prev]);
      setCaptureInput('');
      addToast(`Saved — ${newItem.title.slice(0, 30)}${newItem.title.length > 30 ? '...' : ''}`);

      try {
        await setDoc(doc(db, 'shared_items', newItem.id), newItem);
      } catch (e) {
        console.warn('Ingested item saved locally only', e);
        handleFirestoreError(e, OperationType.CREATE, `shared_items/${newItem.id}`);
      }

    } catch (err) {
      console.error(err);
      addToast('Failed to parse URL metadata.');
    } finally {
      setIsIngesting(false);
    }
  }, [captureInput, addToast]);

  const handleClearAll = useCallback(async () => {
    addToast('Executing catastrophic purge...');
    
    try {
      // 1. Delete all items from Firestore in parallel
      // We do this first as it's the most likely to fail or be slow
      if (items.length > 0) {
        const itemDeletionPromises = items.map(item => 
          deleteDoc(doc(db, 'shared_items', item.id)).catch(e => console.warn(`Item delete fail: ${item.id}`, e))
        );
        await Promise.all(itemDeletionPromises);
      }
      
      // 2. Clear Firestore config
      try {
        await deleteDoc(doc(db, 'shared_config', 'main'));
      } catch (e) {
        console.warn('Config delete fail', e);
      }
      
      // 3. Clear IndexedDB (Local File Storage) - Non-blocking success
      idbStorage.clear().catch(e => console.warn('IDB clear fail', e));
      
      // 4. Reset App States immediately for snappy UI
      setItems([]);
      setCollections(['AI', 'Research', 'Design', 'Inspiration', 'Work']);
      setCanvasPositions({});
      setCanvasFrames({});
      setColonies([]);
      
      // 5. Comprehensive LocalStorage Purge
      localStorage.clear(); 
      // Re-initialize theme immediately so it doesn't flicker to white
      localStorage.setItem('atlas_theme', darkMode ? 'dark' : 'light');
      // Mark as seeded so it doesn't re-add starters on next load
      localStorage.setItem('atlas_seeded_b', 'true');
      
      addToast('Archive successfully purged.');
      setSettingsOpen(false);

      // Force a reload to ensure all listeners and caches are fully invalidated
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error('Catastrophic purge error:', error);
      alert('Purge encountered an error. The app will reload to try and reset state.');
      window.location.reload();
    }
  }, [items, addToast, darkMode]);

  const handleAddNote = useCallback(async (initialText?: string) => {
    // Avoid setting SyntheticBaseEvent (MouseEvent) as textContent when called directly via onClick handler
    const text = (typeof initialText === 'string') ? initialText : '';
    const newItem: ArchiveItem = {
      id: 'item-note-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      type: 'note',
      url: '',
      title: 'New Note',
      description: '',
      thumbnail: null,
      domain: '',
      tags: [],
      collections: [],
      textContent: text || 'Just a quick thought...',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      openCount: 0,
      favorite: false
    };

    setItems(prev => [newItem, ...prev]);
    addToast('Added new sticky note.');

    try {
      await setDoc(doc(db, 'shared_items', newItem.id), newItem);
    } catch (e) {
      console.warn('Note saved locally only', e);
      handleFirestoreError(e, OperationType.CREATE, `shared_items/${newItem.id}`);
    }
  }, [addToast]);

  // Upload Local File
  const handleFileUpload = useCallback(async (files: FileList) => {
    addToast(`Processing ${files.length} file${files.length > 1 ? 's' : ''}...`);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const id = 'file-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      
      let type: ArchiveItem['type'] = 'document';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/') || ['mp4', 'webm', 'mov'].includes(ext)) type = 'video';
      else if (ext === 'pdf') type = 'pdf';
      else if (['html', 'htm'].includes(ext)) type = 'html';

      let finalUrl = `local://${id}`;
      let thumbUrl: string | null = null;

      if (type === 'image') {
        try {
          addToast(`Compressing image ${file.name}...`);
          const compressed = await compressImage(file, 200);
          thumbUrl = compressed;
          finalUrl = compressed;
        } catch {
          try {
            await idbStorage.put(id, file);
            thumbUrl = URL.createObjectURL(file);
          } catch {
            // ignore
          }
        }
      } else {
        try {
          await idbStorage.put(id, file);
          thumbUrl = URL.createObjectURL(file);
        } catch {
          // ignore
        }
      }

      const enrichment = await enrichArchiveData(file.name, '', '');

      const newItem: ArchiveItem = {
        id,
        type,
        url: finalUrl,
        title: enrichment.suggestedTitle || file.name.replace(/\.[^.]+$/, ''),
        description: `${file.type || 'local file'} · ${(file.size / 1024).toFixed(0)} KB`,
        thumbnail: thumbUrl,
        domain: 'local upload',
        tags: enrichment.tags,
        collections: [],
        notes: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        openCount: 0,
        favorite: false,
        isLocalFile: type !== 'image',
        fileName: file.name,
        fileSize: file.size
      };

      setItems(prev => [newItem, ...prev]);

      try {
        await setDoc(doc(db, 'shared_items', newItem.id), newItem);
      } catch (e) {
        console.warn('File local backup saved', e);
        handleFirestoreError(e, OperationType.CREATE, `shared_items/${newItem.id}`);
      }
    }

    addToast('Local files successfully secured on VIAS.OS board.');
  }, [addToast]);

  // Manage collections
  const handleAddCollection = useCallback((name: string) => {
    if (collections.includes(name)) {
      addToast('Collection already exists.');
      return;
    }
    const updated = [...collections, name];
    setCollections(updated);
    localStorage.setItem('atlas_cols', JSON.stringify(updated));
    handleSaveConfig(updated);
    addToast(`Created collection "${name}"`);
  }, [collections, handleSaveConfig, addToast]);

  const handleDeleteCollection = useCallback((name: string) => {
    if (confirm(`Delete collection "${name}"? Items inside won't be deleted but will be uncategorized from this collection.`)) {
      const updated = collections.filter(c => c !== name);
      setCollections(updated);
      localStorage.setItem('atlas_cols', JSON.stringify(updated));

      // Remove association on items
      const freshItems = items.map(item => {
        if ((item.collections || []).includes(name)) {
          const freshCols = item.collections.filter(c => c !== name);
          handleUpdateItem(item.id, { collections: freshCols });
          return { ...item, collections: freshCols };
        }
        return item;
      });
      setItems(freshItems);
      handleSaveConfig(updated);
      addToast(`Collection "${name}" removed.`);
    }
  }, [collections, items, handleUpdateItem, handleSaveConfig, addToast]);

  // Drag and drop triggers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const files = e.dataTransfer.files;
    const text = e.dataTransfer.getData('text');
    
    if (files && files.length > 0) {
      await handleFileUpload(files);
    } else if (text && /^https?:\/\//i.test(text.trim())) {
      setCaptureInput(text.trim());
      // Lazy fire ingest
      setTimeout(() => handleIngest(), 50);
    }
  };

  // Keyboard binds trigger focus Box
  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const inp = document.getElementById('tags-inp-box') || document.querySelector('input[type="text"]');
        if (inp) (inp as HTMLElement).focus();
      }
    };

    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, []);

  // Handle PWA Share Target Items
  useEffect(() => {
    const checkSharedItems = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('shared') === '1') {
        window.history.replaceState({}, document.title, window.location.pathname);

        const DB_NAME = 'VIAS_ShareTarget';
        const STORE_NAME = 'shared_items';
        try {
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          
          if (!db.objectStoreNames.contains(STORE_NAME)) return;

          const storedItems = await new Promise<any[]>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });

          if (storedItems && storedItems.length > 0) {
            for (const item of storedItems) {
              if (item.files && item.files.length > 0) {
                // Mock FileList based on array of Files
                const mockFileList: any = {
                  length: item.files.length,
                  item: (idx: number) => item.files[idx],
                };
                for(let i=0; i<item.files.length; i++) mockFileList[i] = item.files[i];
                
                await handleFileUpload(mockFileList as FileList);
              } else {
                const combinedText = [item.title, item.text, item.url].filter(Boolean).join(' ');
                const urls = combinedText.match(/https?:\/\/[^\s]+/gi);
                if (urls && urls.length > 0) {
                  setCaptureInput(urls[0]);
                  setTimeout(() => handleIngest(), 500);
                } else if (item.text || item.title) {
                  handleAddNote(item.text || item.title);
                }
              }
            }
            
            // Clear DB
            await new Promise((resolve, reject) => {
              const tx = db.transaction(STORE_NAME, 'readwrite');
              tx.objectStore(STORE_NAME).clear();
              tx.oncomplete = () => resolve(true);
            });
          }
        } catch (e) {
          console.error('[PWA Share Target] Error checking shared items:', e);
        }
      }
    };
    checkSharedItems();
  }, [handleFileUpload, handleIngest, handleAddNote]);

  // Filter calculations
  const filteredItems = useMemo(() => {
    let result = [...items];

    // Filter by type
    if (filter.type === 'favorite') {
      result = result.filter(x => x.favorite);
    } else if (filter.type !== 'all') {
      result = result.filter(x => x.type === filter.type);
    }

    // Filter by collection (or colony)
    if (filter.collection) {
      result = result.filter(x => 
        (x.collections || []).includes(filter.collection!) || 
        x.colonyId === filter.collection
      );
    }

    // Filter by domain
    if (filter.domain) {
      result = result.filter(x => x.domain === filter.domain);
    }

    // Filter by search text
    if (filter.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(x => 
        (x.title || '').toLowerCase().includes(q) ||
        (x.description || '').toLowerCase().includes(q) ||
        (x.domain || '').toLowerCase().includes(q) ||
        (x.notes || '').toLowerCase().includes(q) ||
        (x.textContent || '').toLowerCase().includes(q) ||
        (x.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }

    // Apply Sorting
    switch (filter.sort) {
      case 'newest':
        result.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'oldest':
        result.sort((a, b) => a.createdAt - b.createdAt);
        break;
      case 'opens':
        result.sort((a, b) => (b.openCount || 0) - (a.openCount || 0));
        break;
      case 'alpha':
        result.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        break;
    }

    return result;
  }, [items, filter]);

  // Context menus triggers
  const handleContextMenu = (e: React.MouseEvent) => {
    const cardEl = (e.target as HTMLElement).closest('.card, .c-card');
    if (cardEl) {
      e.preventDefault();
      const id = (cardEl as HTMLElement).id.replace('card-', '');
      setContextMenu({
        itemId: id,
        x: e.clientX,
        y: e.clientY
      });
    }
  };

  // Touch Longpress Context trigger
  const touchTimerRef = useRef<any>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    const cardEl = (e.target as HTMLElement).closest('.card, .c-card');
    if (cardEl) {
      const id = (cardEl as HTMLElement).id.replace('card-', '');
      touchTimerRef.current = setTimeout(() => {
        if (navigator.vibrate) navigator.vibrate(50);
        setContextMenu({
          itemId: id,
          x: e.touches[0].clientX,
          y: e.touches[0].clientY
        });
      }, 700);
    }
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
    }
  };

  // Import JSON Backup
  const handleImportBackup = useCallback(async (data: any) => {
    try {
      const existingUrls = new Set(items.map(x => x.url));
      const newSaves = data.items.filter((x: any) => !existingUrls.has(x.url));

      const merged = [...items, ...newSaves];
      setItems(merged);
      localStorage.setItem('atlas_items', JSON.stringify(merged));

      if (data.collections) {
        const uniqueCols = Array.from(new Set([...collections, ...data.collections]));
        setCollections(uniqueCols);
        localStorage.setItem('atlas_cols', JSON.stringify(uniqueCols));
      }

      if (data.canvasPositions) {
        const mergedPos = { ...canvasPositions, ...data.canvasPositions };
        setCanvasPositions(mergedPos);
        localStorage.setItem('atlas_cpos', JSON.stringify(mergedPos));
        await handleSaveConfig(collections, mergedPos);
      }

      // Sync items to firestore
      for (const item of newSaves) {
        try {
          await setDoc(doc(db, 'shared_items', item.id), item);
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, `shared_items/${item.id}`);
        }
      }

      addToast(`Restored backup with ${newSaves.length} new items.`);
    } catch {
      addToast('Backup restoration failed.');
    }
  }, [items, collections, canvasPositions, handleSaveConfig, addToast]);

  // Purge ALL data factory reset
  const handleClearData = useCallback(async () => {
    setItems([]);
    setCollections(['AI', 'Research', 'Design', 'Inspiration', 'Work']);
    setCanvasPositions({});
    
    localStorage.removeItem('atlas_items');
    localStorage.removeItem('atlas_cols');
    localStorage.removeItem('atlas_cpos');

    try {
      await idbStorage.clear();
    } catch {
      // ignore
    }

    try {
      // Delete documents on firestore (note: simple wipe)
      await setDoc(doc(db, 'shared_config', 'main'), {
        collections: ['AI', 'Research', 'Design', 'Inspiration', 'Work'],
        canvasPositions: {}
      });
      // In production real-world scenario, documents must be deleted by batches, we clear local states fully.
    } catch (e) {
      console.warn('Wiping firestore config failed', e);
      handleFirestoreError(e, OperationType.WRITE, 'shared_config/main');
    }

    addToast('The visual board is now cleared.');
  }, [addToast]);

  // Click card trigger opens quick action menu
  const handleCardClick = useCallback((id: string, e: React.MouseEvent) => {
    setQuickActionMenu({
      itemId: id,
      x: e.clientX,
      y: e.clientY
    });
  }, []);

  const handleCardZoomClick = useCallback((id: string, e: React.MouseEvent) => {
    setQuickActionMenu({
      itemId: id,
      x: e.clientX,
      y: e.clientY
    });
  }, []);

  return (
    <AnimatePresence mode="wait">
      {!isStartupComplete ? (
        <StartupScreen key="startup" onComplete={() => setIsStartupComplete(true)} />
      ) : (
        <motion.div 
          key="app"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col w-full h-[100dvh] select-none overflow-hidden bg-[var(--app-bg)] text-[var(--text)] font-sans antialiased text-sm leading-relaxed"
          style={{
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
            paddingLeft: 'env(safe-area-inset-left)',
            paddingRight: 'env(safe-area-inset-right)'
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onContextMenu={handleContextMenu}
        >
      {/* Drag Over Overlay Screen */}
      {isDraggingOver && (
        <div className="fixed inset-0 z-[5000] bg-black/75 backdrop-blur flex items-center justify-center border-4 border-dashed border-[#0A84FF] pointer-events-none select-none animate-fade-in">
          <div className="text-center flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-[#0A84FF]/10 text-[#0A84FF] flex items-center justify-center border border-[#0A84FF]/20 select-none">
              <Sparkles className="w-8 h-8 fill-[#0A84FF]" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">Drop anything to save</h2>
            <p className="text-xs text-white/50 max-w-[280px]">
              Drop images, local videos, documents, pdf frames, or links directly onto your mood board workspace.
            </p>
          </div>
        </div>
      )}

      {/* Primary Top Header (Save URL pasting box inputs, Search elements, quick launchers) */}
      <Header
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        captureInput={captureInput}
        onCaptureInputChange={setCaptureInput}
        onIngest={handleIngest}
        isIngesting={isIngesting}
        onFileUpload={handleFileUpload}
        onAddNote={handleAddNote}
        filter={filter}
        onFilterChange={handleFilterChange}
        view={view}
        onViewChange={setView}
        onOpenDashboard={() => setDashboardOpen(true)}
        onOpenImportExport={() => setImportExportOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        darkMode={darkMode}
        onToggleTheme={() => setDarkMode(prev => !prev)}
      />

      {/* Main Structural Body Segment */}
      <div className="flex flex-1 overflow-hidden relative" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {/* Left Hand Navigation Filter Drawer */}
        <Sidebar
          items={items}
          collections={collections}
          colonies={colonies}
          filter={filter}
          onFilterChange={handleFilterChange}
          onAddCollection={handleAddCollection}
          onDeleteCollection={handleDeleteCollection}
          gridCols={gridCols}
          onGridColsChange={(cols) => {
            setGridCols(cols);
            localStorage.setItem('vias_grid_cols', cols);
          }}
          onOpenDashboard={() => setDashboardOpen(true)}
          onOpenImportExport={() => setImportExportOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          view={view}
          onViewChange={setView}
          darkMode={darkMode}
          onToggleTheme={() => setDarkMode(prev => !prev)}
        />

        {/* Dashboard workspace panel */}
        <main className="flex-1 overflow-hidden flex flex-col relative bg-[var(--app-bg)]">
          {/* Sub Capsule Type Filters panel */}
          <Toolbar
            filter={filter}
            onFilterChange={handleFilterChange}
            filteredCount={filteredItems.length}
          />

          {/* Core viewport display area */}
          <div className="flex-1 relative overflow-hidden flex">
            {view === 'grid' ? (
              <GridView
                items={filteredItems}
                onFavoriteChange={handleFavoriteChange}
                onItemClick={handleCardClick}
                onZoomClick={handleCardZoomClick}
                gridCols={gridCols}
              />
            ) : (
              <CanvasView
                items={filteredItems}
                canvasPositions={canvasPositions}
                canvasFrames={canvasFrames}
                onConfigUpdate={(newPos, newFrames) => {
                  setCanvasPositions(newPos);
                  setCanvasFrames(newFrames);
                  handleSaveConfig(collections, newPos, newFrames);
                }}
                onFavoriteChange={handleFavoriteChange}
                onItemClick={handleCardClick}
                onZoomClick={handleCardZoomClick}
              />
            )}
          </div>
        </main>

        {/* Locked right single card inspect Detail panel drawer */}
        {activeDetailId && (
          <div 
            onClick={() => setActiveDetailId(null)}
            className="fixed inset-0 z-1050 bg-black/35 backdrop-blur-xs select-none sm:hidden"
          />
        )}
        <DetailPanel
          itemId={activeDetailId}
          onClose={() => setActiveDetailId(null)}
          getItem={(id) => items.find(x => x.id === id)}
          onUpdateItem={handleUpdateItem}
          onDeleteItem={handleDeleteItem}
          collections={collections}
          onFavoriteChange={handleFavoriteChange}
          onToast={addToast}
        />
      </div>

      {/* Floating full-screen swiper Lightbox */}
      <Lightbox
        itemId={activeLightboxId}
        onClose={() => setActiveLightboxId(null)}
        filteredItems={filteredItems}
        onOpenInfo={(id) => setActiveDetailId(id)}
      />

      {/* Draggable canvas Right-click context actions menu */}
      <ContextMenu
        itemId={contextMenu?.itemId || null}
        position={contextMenu ? { x: contextMenu.x, y: contextMenu.y } : null}
        onClose={() => setContextMenu(null)}
        items={items}
        onFavoriteChange={handleFavoriteChange}
        onDeleteItem={handleDeleteItem}
        onOpenDetails={(id) => setActiveDetailId(id)}
        onToast={addToast}
      />

      {/* Quick Action Menu for regular clicks */}
      <QuickActionMenu 
        itemId={quickActionMenu?.itemId || null}
        onClose={() => setQuickActionMenu(null)}
        item={items.find(x => x.id === quickActionMenu?.itemId)}
        onOpenDetails={(id) => setActiveDetailId(id)}
        onOpenLightbox={(id) => setActiveLightboxId(id)}
        onOpenSource={(url) => window.open(url, '_blank')}
        onToggleFavorite={handleFavoriteChange}
        onDelete={handleDeleteItem}
      />

      {/* Auxiliary Overlay Modals */}
      <DashboardModal
        isOpen={dashboardOpen}
        onClose={() => setDashboardOpen(false)}
        items={items}
        collections={collections}
      />

      <ImportExportModal
        isOpen={importExportOpen}
        onClose={() => setImportExportOpen(false)}
        items={items}
        collections={collections}
        canvasPositions={canvasPositions}
        onImportBackup={handleImportBackup}
        onClearData={handleClearData}
        onToast={addToast}
      />

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        items={items}
        collections={collections}
        onToast={addToast}
        onClearAll={handleClearAll}
        darkMode={darkMode}
        onToggleTheme={() => setDarkMode(prev => !prev)}
      />

      {/* Floating active toasts notifier wrap */}
      <div 
        className="fixed left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none select-none items-center"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
      >
        {toasts.map(toast => (
          <div 
            key={toast.id}
            className="px-5 py-2 bg-[#1e1e1e]/90 text-white font-semibold text-xs rounded-full border border-white/8 transition-all duration-300 transform translate-y-0 scale-100 opacity-100 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md shrink-0 whitespace-nowrap animate-fade-in"
          >
            {toast.msg}
          </div>
        ))}
      </div>
    </motion.div>
    )}
    </AnimatePresence>
  );
}
