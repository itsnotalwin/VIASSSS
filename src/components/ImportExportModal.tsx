import React, { useRef } from 'react';
import { X, Save, FileSpreadsheet, Loader, Trash2, FileJson, LucideIcon } from 'lucide-react';
import { ArchiveItem } from '../types';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: ArchiveItem[];
  collections: string[];
  canvasPositions: Record<string, any>;
  onImportBackup: (importedData: any) => void;
  onClearData: () => Promise<void>;
  onToast: (msg: string) => void;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  onClose,
  items,
  collections,
  canvasPositions,
  onImportBackup,
  onClearData,
  onToast
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // helper download file
  const triggerDownload = (content: string, fileName: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleExportJSON = () => {
    const data = {
      _atlas_version: 1,
      exportedAt: new Date().toISOString(),
      items,
      collections,
      canvasPositions
    };
    triggerDownload(JSON.stringify(data, null, 2), 'atlas-backup.json', 'application/json');
    onToast('Exported complete JSON backup file.');
  };

  const handleExportCSV = () => {
    const headers = ['id', 'title', 'url', 'type', 'domain', 'tags', 'collections', 'notes', 'favorite', 'openCount', 'createdAt'];
    const rows = items.map(x => [
      x.id,
      `"${(x.title || '').replace(/"/g, '""')}"`,
      `"${(x.url || '').slice(0, 500).replace(/"/g, '""')}"`,
      x.type,
      x.domain || '',
      `"${(x.tags || []).join(', ')}"`,
      `"${(x.collections || []).join(', ')}"`,
      `"${(x.notes || '').replace(/"/g, '""')}"`,
      x.favorite ? 'true' : 'false',
      x.openCount || 0,
      new Date(x.createdAt).toISOString()
    ].join(','));
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    triggerDownload(csvContent, 'atlas-archive.csv', 'text/csv');
    onToast('Exported simple CSV sheet.');
  };

  const handleChooseImportFile = () => {
    fileInputRef.current?.click();
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed || !Array.isArray(parsed.items)) {
          throw new Error('Invalid format: Missing items array.');
        }

        const duplicateCount = parsed.items.filter((item: any) => 
          items.some(existing => existing.url === item.url || existing.id === item.id)
        ).length;

        const mergeCount = parsed.items.length - duplicateCount;

        if (confirm(`Import ${parsed.items.length} items? ${mergeCount} new items will be restored (${duplicateCount} updates/duplicates ignored).`)) {
          onImportBackup(parsed);
          onToast(`Successfully imported ${mergeCount} new backup items.`);
          onClose();
        }
      } catch (err) {
        onToast('Failed to parse backup metadata. File may be corrupted.');
        console.error(err);
      }
    };
    reader.readAsText(file);
    
    // Reset target value
    e.target.value = '';
  };

  const handleWipeData = async () => {
    if (confirm('CRITICAL ACTION: This will permanently purge ALL archived items, files, collections, and custom spatial layouts from the cloud database and IndexedDB. This CANNOT be undone. Proceed?')) {
      if (confirm('SECOND CONFIRMATION REQUIRED: Type CONFIRM to delete everything or click cancel.')) {
        await onClearData();
        onToast('The visual archive has been factory reset.');
        onClose();
      }
    }
  };

  const CardAction = ({ icon: Icon, title, desc, onClick, actionLabel, danger = false }: {
    icon: LucideIcon;
    title: string;
    desc: string;
    onClick: () => void;
    actionLabel: string;
    danger?: boolean;
  }) => (
    <div className="bg-[var(--text)]/5 border border-[var(--border)] p-4 rounded-2xl flex flex-col justify-between items-start gap-4">
      <div className="flex flex-col gap-1 text-left select-none">
        <span className="flex items-center gap-2 font-bold text-[var(--text)] text-[14px]">
          <Icon className={`w-4 h-4 ${danger ? 'text-red-400' : 'text-[#0A84FF]'}`} />
          <span>{title}</span>
        </span>
        <span className="text-[var(--text-dim)] text-[12px] leading-relaxed select-text">
          {desc}
        </span>
      </div>
      <button 
        onClick={onClick}
        className={`h-9 px-4 rounded-xl text-xs font-semibold whitespace-nowrap transition shrink-0 select-none ${
          danger 
            ? 'bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/10' 
            : 'bg-[var(--text)]/5 hover:bg-[var(--text)]/10 text-[var(--text)] border border-[var(--border)]'
        }`}
      >
        {actionLabel}
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 z-1000 backdrop-blur-sm flex items-center justify-center p-4">
      <div 
        className="fixed inset-0"
        onClick={onClose}
      />
      
      <div className="bg-[var(--app-bg)] border border-[var(--border)] w-full max-w-xl max-h-[80vh] overflow-y-auto rounded-3xl shadow-2xl relative z-10 flex flex-col">
        {/* Header bar */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-[var(--border)] sticky top-0 bg-[var(--app-bg)]/95 backdrop-blur-md z-20 shrink-0 select-none">
          <h2 className="text-base font-bold text-[var(--text)] tracking-tight flex items-center gap-2">
            <Save className="w-4 h-4 text-[#0A84FF]" />
            <span>Data Operations</span>
          </h2>
          <button 
            onClick={onClose}
            className="text-[var(--text-dim)] hover:text-[var(--text)] p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content grid */}
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CardAction 
            icon={FileJson}
            title="Backup JSON Archive"
            desc="Complete database backup — preserves all visual cards, notes, custom tags, collection metrics, and dragging coordinates."
            actionLabel="Export JSON"
            onClick={handleExportJSON}
          />
          
          <CardAction 
            icon={FileSpreadsheet}
            title="Export Simplified CSV"
            desc="Generates a spreadsheet sheet list — includes titles, URLs, tags, domains, and item metadata values."
            actionLabel="Export CSV"
            onClick={handleExportCSV}
          />

          <CardAction 
            icon={Save}
            title="Restore JSON Backup"
            desc="Import files from a previous VIAS.OS JSON backup. Merges missing archives and skips existing entries."
            actionLabel="Restore Archive"
            onClick={handleChooseImportFile}
          />

          <CardAction 
            icon={Trash2}
            title="Reset Database"
            desc="Permanently empty all items, files, collections, and coordinates positions, returning VIAS.OS to a blank canvas."
            actionLabel="Purge Archive"
            onClick={handleWipeData}
            danger={true}
          />
        </div>

        {/* Hidden File Input for import */}
        <input 
          type="file" 
          ref={fileInputRef}
          accept=".json"
          onChange={handleImportFileChange}
          className="hidden"
        />

        {/* Action Controls Footer */}
        <div className="p-4 px-6 border-t border-[var(--border)] flex justify-end shrink-0 select-none">
          <button
            onClick={onClose}
            className="h-9 px-5 bg-[var(--text)]/5 hover:bg-[var(--text)]/10 text-[var(--text)] text-xs font-semibold rounded-xl border border-[var(--border)] transition"
          >
            Finished Actions
          </button>
        </div>
      </div>
    </div>
  );
};
