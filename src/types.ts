export interface Project {
  id?: string;
  userId: string;
  name: string;
  engine: string;
  type: string;
  color: string;
  icon: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  version: string;
}

export interface DailyLog {
  id?: string;
  projectId: string;
  date: number; // timestamp
  content: string;
  hoursWorked: number;
  version: string;
}

export interface ProjectTask {
  id?: string;
  projectId: string;
  title: string;
  description?: string;
  type: 'todo' | 'bug';
  priority?: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed';
  version?: string; // Hatanın bulunduğu / çözüldüğü versiyon
  createdAt: number;
}

export interface ProjectMedia {
  id?: string;
  projectId: string;
  title: string;
  description: string;
  imageUrl: string; // base64 data URL veya web URL
  version: string;
  createdAt: number;
}

export interface UpdateStatus {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error' | 'unsupported';
  message?: string;
  version?: string;
  percent?: number;
}

declare global {
  interface Window {
    devlogDesktop?: {
      saveSession: (data: any) => Promise<any>;
      getSession: () => Promise<any>;
      clearSession: () => Promise<any>;
      checkForUpdates?: () => Promise<any>;
      installUpdate?: () => Promise<any>;
      getAppVersion?: () => Promise<string>;
      onUpdateStatus?: (callback: (status: UpdateStatus) => void) => () => void;
    };
  }
}
