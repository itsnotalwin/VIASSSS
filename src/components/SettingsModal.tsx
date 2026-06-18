import React, { useState, useEffect } from 'react';
import { X, Settings, ShieldCheck, Key, RefreshCw, Command, HelpCircle, Sun, Moon } from 'lucide-react';
import { ArchiveItem } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: ArchiveItem[];
  collections: string[];
  onToast: (msg: string) => void;
  onClearAll: () => Promise<void>;
  darkMode: boolean;
  onToggleTheme: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  items,
  collections,
  onToast,
  onClearAll,
  darkMode,
  onToggleTheme
}) => {
  const [groqKey, setGroqKey] = useState('');
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const savedGroq = localStorage.getItem('vias_groq_key') || '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';
      setGroqKey(savedGroq);
      setIsConfirmingClear(false);
      setIsPurging(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveGroqKey = () => {
    localStorage.setItem('vias_groq_key', groqKey.trim());
    onToast('Groq API Key preserved in local storage.');
  };

  const OptionRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between items-center py-2.5 border-b border-[var(--border)] select-text">
      <span className="text-[var(--text-muted)] font-medium text-sm">{label}</span>
      <span className="text-[var(--text-dim)] font-semibold font-mono text-xs">{value}</span>
    </div>
  );

  const ShortcutRow = ({ keys, desc }: { keys: string; desc: string }) => (
    <div className="flex justify-between items-center py-2 border-b border-[var(--border)] select-none hover:bg-[var(--text)]/2 px-2 rounded transition">
      <div className="flex items-center gap-1.5">
        <span className="p-1 px-1.5 bg-[var(--text)]/10 rounded border border-[var(--border)] font-bold font-mono text-[10px] text-[var(--text)]">
          {keys}
        </span>
      </div>
      <span className="text-[var(--text-dim)] text-xs font-semibold">{desc}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 z-1000 backdrop-blur-sm flex items-center justify-center p-4">
      <div 
        className="fixed inset-0"
        onClick={onClose}
      />

      <div className="bg-[var(--app-bg)] border border-[var(--border)] w-full max-w-md max-h-[80vh] overflow-y-auto rounded-3xl shadow-2xl relative z-10 flex flex-col">
        {/* Header bar */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-[var(--border)] sticky top-0 bg-[var(--app-bg)]/95 backdrop-blur-md z-20 shrink-0 select-none">
          <h2 className="text-base font-bold text-[var(--text)] tracking-tight flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#0A84FF]" />
            <span>Preferences & Settings</span>
          </h2>
          <button 
            onClick={onClose}
            className="text-[var(--text-dim)] hover:text-[var(--text)] p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-6 flex flex-col gap-6 overflow-y-auto">
          {/* Static Mode Indicator */}
          <div className="flex flex-col gap-2">
            <div className="bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-xl flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Host Integrity</span>
                <span className="text-[10px] text-emerald-500/60 font-medium">Forced Static (Github Ready)</span>
              </div>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            </div>
          </div>
          
          {/* Appearance Section */}
          <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-4">
            <span className="text-[10px] font-bold tracking-widest text-[#0A84FF] uppercase flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5" />
              <span>Visual Appearance</span>
            </span>
            <div className="flex items-center justify-between bg-[var(--text)]/3 p-4 rounded-2xl border border-[var(--border)] mt-1">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-[var(--text)]/90">System Theme</span>
                <span className="text-[10px] text-[var(--text-dim)]">{darkMode ? 'Deep Dark Slate Archive' : 'Mininal Stark White Archive'}</span>
              </div>
              <button 
                onClick={onToggleTheme}
                className="h-9 px-4 bg-[var(--text)]/10 hover:bg-[var(--text)]/20 text-[var(--text)] rounded-xl text-xs font-bold transition flex items-center gap-2 border border-[var(--border)]"
              >
                {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
            </div>
          </div>
          
          {/* AI Settings Section */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold tracking-widest text-[#0A84FF] uppercase flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5" />
              <span>AI Auto-Tagging & Search</span>
            </span>
            <p className="text-xs text-[var(--text-dim)] leading-relaxed mb-2 leading-snug">
              Automatically labels visual items, describes cards, and powers full semantic search using Groq (Llama 3.3). Your API key is safely stored only in your local browser cache.
            </p>
            <div className="flex flex-col gap-2 bg-[var(--text)]/3 p-4 rounded-2xl border border-[var(--border)]">
              <span className="text-xs font-semibold text-[var(--text)]/70">Groq API Key</span>
              <input 
                type="password" 
                placeholder="gsk_..."
                value={groqKey || ''}
                onChange={(e) => setGroqKey(e.target.value)}
                className="w-full bg-[var(--app-bg)] border border-[var(--border)] text-[var(--text)] rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-[#0A84FF] font-mono"
              />
              <button 
                onClick={handleSaveGroqKey}
                className="h-9 px-4 bg-[#0A84FF] hover:bg-[#409CFF] text-white rounded-xl text-xs font-semibold transition self-end select-none"
              >
                Save Groq Key
              </button>
            </div>
          </div>

          {/* Sync status metrics */}
          <div className="flex flex-col gap-1 border-t border-[var(--border)] pt-4">
            <span className="text-[10px] font-bold tracking-widest text-[var(--text-dim)] uppercase mb-2 flex items-center gap-1.5 select-none">
              <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
              <span>Global Cloud Sync</span>
            </span>
            <OptionRow label="Ecosystem Connection" value="Shared Firestore Network" />
            <OptionRow label="Items Synchronized" value={`${items.length} items`} />
            <OptionRow label="Collections Active" value={`${collections.length} categories`} />
            <p className="text-[11px] text-[var(--text-dim)]/35 leading-relaxed mt-2 select-none italic text-center">
              Shared cloud backend is active. Data merges instantly across any synchronized sessions or devices in real time.
            </p>
          </div>

          {/* Keyboard Shortcuts indicators */}
          <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-4">
            <span className="text-[10px] font-bold tracking-widest text-[var(--text-dim)] uppercase mb-2 flex items-center gap-1.5 select-none">
              <Command className="w-3.5 h-3.5" />
              <span>System Shortcuts</span>
            </span>
            
            <ShortcutRow keys="⌘K or Ctrl+K" desc="Focus toolbar search box" />
            <ShortcutRow keys="⌘S or Ctrl+S" desc="Save active detail panel notes" />
            <ShortcutRow keys="Esc" desc="Close detailed views or active modals" />
            <ShortcutRow keys="Paste (⌘V)" desc="Auto-ingest URL in canvas or grid" />
            <ShortcutRow keys="Drop file" desc="Drag & drop uploads local media" />
            <ShortcutRow keys="Right-Click" desc="Open spatial context actions menu" />
          </div>

          {/* Dangerous Zone */}
          <div className="flex flex-col gap-3 border-t border-red-500/10 pt-6 mt-2 mb-4">
            <span className="text-[10px] font-bold tracking-[0.2em] text-red-500/60 uppercase select-none">
              Dangerous Zone
            </span>
            <div className="bg-red-500/5 border border-red-500/10 p-4 rounded-2xl flex flex-col gap-3">
              <p className="text-[10px] text-red-500/60 leading-relaxed font-medium">
                PURGING ARCHIVE: This will permanently delete all metadata, AI colonies, local cached files, and cloud-synchronized records. This action is catastrophic and cannot be reversed.
              </p>
              
              {!isConfirmingClear ? (
                <button 
                  onClick={() => setIsConfirmingClear(true)}
                  className="w-full h-10 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-bold rounded-xl border border-red-500/20 transition flex items-center justify-center gap-2"
                >
                  Purge Active Archive
                </button>
              ) : (
                <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-1 duration-300">
                  <p className="text-[10px] text-red-400 font-bold text-center mb-1">ARE YOU ABSOLUTELY SURE?</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => setIsConfirmingClear(false)}
                      className="h-9 bg-white/5 hover:bg-white/10 text-white/50 text-[10px] font-bold rounded-xl border border-white/10 transition"
                    >
                      Cancel
                    </button>
                    <button 
                      disabled={isPurging}
                      onClick={async () => {
                        setIsPurging(true);
                        try {
                          await onClearAll();
                        } finally {
                          setIsPurging(false);
                          setIsConfirmingClear(false);
                        }
                      }}
                      className={`h-9 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2 ${isPurging ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {isPurging ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Purging...</span>
                        </>
                      ) : (
                        'Confirm Purge'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Closing Footer */}
        <div className="p-4 px-6 border-t border-[var(--border)] flex justify-end shrink-0 select-none">
          <button
            onClick={onClose}
            className="h-9 px-5 bg-[var(--text)]/5 hover:bg-[var(--text)]/10 text-[var(--text)] text-xs font-semibold rounded-xl border border-[var(--border)] transition"
          >
            Done Config
          </button>
        </div>
      </div>
    </div>
  );
};
