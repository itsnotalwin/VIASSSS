export interface Colony {
  id: string;
  name: string;
  description?: string;
  itemIds: string[];
  color?: string;
  icon?: string;
  createdAt: number;
}

export interface ArchiveItem {
  id: string;
  type: 'link' | 'image' | 'video' | 'pdf' | 'document' | 'html' | 'note';
  url: string;
  title: string;
  description?: string;
  thumbnail?: string | null;
  domain?: string;
  tags: string[];
  collections: string[];
  notes?: string;
  textContent?: string;
  createdAt: number;
  updatedAt: number;
  openCount: number;
  favorite: boolean;
  isLocalFile?: boolean;
  fileName?: string;
  fileSize?: number;
  colonyId?: string;
}

export interface CanvasPosition {
  x: number;
  y: number;
}

export interface CanvasFrame {
  id: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

export interface FilterState {
  type: string;
  collection: string | null;
  domain: string | null;
  sort: 'newest' | 'oldest' | 'opens' | 'alpha';
  search: string;
}
