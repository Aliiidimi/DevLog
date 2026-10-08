import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs,
  updateDoc,
  deleteDoc,
  doc
} from 'firebase/firestore';
import { db } from '../firebase';
import type { DailyLog, ProjectTask, ProjectMedia } from '../types';
import { updateLocalProjectMeta } from './projects';

const LOCAL_LOGS_KEY = 'devlog_logs_cache';
const LOCAL_TASKS_KEY = 'devlog_tasks_cache';
const LOCAL_MEDIA_KEY = 'devlog_media_cache';

const withTimeout = <T>(promise: Promise<T>, ms = 2500): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('FIRESTORE_TIMEOUT')), ms))
  ]);
};

// ========================
// 1. LOGS (Günlük Kayıtlar)
// ========================

export const getLocalLogs = (projectId: string): DailyLog[] => {
  try {
    const raw = localStorage.getItem(LOCAL_LOGS_KEY);
    if (!raw) return [];
    const all: DailyLog[] = JSON.parse(raw);
    return all.filter(l => l.projectId === projectId).sort((a, b) => b.date - a.date);
  } catch {
    return [];
  }
};

const saveLocalLog = (log: DailyLog) => {
  try {
    const raw = localStorage.getItem(LOCAL_LOGS_KEY);
    const all: DailyLog[] = raw ? JSON.parse(raw) : [];
    const filtered = all.filter(l => l.id !== log.id);
    localStorage.setItem(LOCAL_LOGS_KEY, JSON.stringify([log, ...filtered]));
  } catch (e) {
    console.error(e);
  }
};

const saveLocalLogsAll = (projectId: string, newLogs: DailyLog[]) => {
  try {
    const raw = localStorage.getItem(LOCAL_LOGS_KEY);
    const all: DailyLog[] = raw ? JSON.parse(raw) : [];
    const others = all.filter(l => l.projectId !== projectId);
    localStorage.setItem(LOCAL_LOGS_KEY, JSON.stringify([...newLogs, ...others]));
  } catch (e) {
    console.error(e);
  }
};

export const deleteDailyLog = async (logId: string): Promise<void> => {
  try {
    const raw = localStorage.getItem(LOCAL_LOGS_KEY);
    if (raw) {
      const all: DailyLog[] = JSON.parse(raw);
      localStorage.setItem(LOCAL_LOGS_KEY, JSON.stringify(all.filter(l => l.id !== logId)));
    }
  } catch (e) {
    console.error(e);
  }

  if (!logId.startsWith('local_')) {
    try {
      const ref = doc(db, 'logs', logId);
      await withTimeout(deleteDoc(ref), 2500);
    } catch (err) {
      console.warn('Firestore log silme hatası:', err);
    }
  }
};

export const addDailyLog = async (
  projectId: string, 
  data: Omit<DailyLog, 'id' | 'projectId' | 'date'>
): Promise<DailyLog> => {
  const logsRef = collection(db, 'logs');
  const now = Date.now();
  const newLogData = {
    ...data,
    projectId,
    date: now,
  };

  updateLocalProjectMeta(projectId, { updatedAt: now, version: data.version });

  try {
    const docRef = await withTimeout(addDoc(logsRef, newLogData), 2500);
    if (!projectId.startsWith('local_')) {
      const projectRef = doc(db, 'projects', projectId);
      updateDoc(projectRef, { 
        updatedAt: now,
        version: data.version
      }).catch(() => {});
    }
    const created = { id: docRef.id, ...newLogData } as DailyLog;
    saveLocalLog(created);
    return created;
  } catch (err) {
    console.warn('Log yerel önbelleğe anında kaydedildi:', err);
    const fallbackLog = { id: 'local_log_' + now, ...newLogData } as DailyLog;
    saveLocalLog(fallbackLog);
    return fallbackLog;
  }
};

export const getProjectLogs = async (
  projectId: string,
  onRemoteSync?: (logs: DailyLog[]) => void
): Promise<DailyLog[]> => {
  const localLogs = getLocalLogs(projectId);

  const logsRef = collection(db, 'logs');
  const q = query(logsRef, where('projectId', '==', projectId));

  withTimeout(getDocs(q), 3000)
    .then(snapshot => {
      const remoteLogs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DailyLog[];

      const mergedMap = new Map<string, DailyLog>();
      for (const ll of localLogs) {
        if (ll.id) mergedMap.set(ll.id, ll);
      }
      for (const rl of remoteLogs) {
        if (rl.id) {
          mergedMap.set(rl.id, rl);
        }
      }

      const merged = Array.from(mergedMap.values()).sort((a, b) => b.date - a.date);
      saveLocalLogsAll(projectId, merged);
      if (onRemoteSync) {
        onRemoteSync(merged);
      }
    })
    .catch(() => {});

  return localLogs;
};

// ========================
// 2. TASKS & BUGS (Görevler ve Hatalar)
// ========================

export const getLocalTasks = (projectId: string): ProjectTask[] => {
  try {
    const raw = localStorage.getItem(LOCAL_TASKS_KEY);
    if (!raw) return [];
    const all: ProjectTask[] = JSON.parse(raw);
    return all.filter(t => t.projectId === projectId).sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
};

const saveLocalTask = (task: ProjectTask) => {
  try {
    const raw = localStorage.getItem(LOCAL_TASKS_KEY);
    const all: ProjectTask[] = raw ? JSON.parse(raw) : [];
    const filtered = all.filter(t => t.id !== task.id);
    localStorage.setItem(LOCAL_TASKS_KEY, JSON.stringify([task, ...filtered]));
  } catch (e) {
    console.error(e);
  }
};

const saveLocalTasksAll = (projectId: string, newTasks: ProjectTask[]) => {
  try {
    const raw = localStorage.getItem(LOCAL_TASKS_KEY);
    const all: ProjectTask[] = raw ? JSON.parse(raw) : [];
    const others = all.filter(t => t.projectId !== projectId);
    localStorage.setItem(LOCAL_TASKS_KEY, JSON.stringify([...newTasks, ...others]));
  } catch (e) {
    console.error(e);
  }
};

export const addTask = async (
  projectId: string, 
  data: Omit<ProjectTask, 'id' | 'projectId' | 'createdAt'>
): Promise<ProjectTask> => {
  const tasksRef = collection(db, 'tasks');
  const now = Date.now();
  const newTaskData = {
    ...data,
    projectId,
    createdAt: now,
  };

  try {
    const docRef = await withTimeout(addDoc(tasksRef, newTaskData), 2500);
    const created = { id: docRef.id, ...newTaskData } as ProjectTask;
    saveLocalTask(created);
    return created;
  } catch (err) {
    console.warn('Görev yerel önbelleğe kaydedildi:', err);
    const fallbackTask = { id: 'local_task_' + now, ...newTaskData } as ProjectTask;
    saveLocalTask(fallbackTask);
    return fallbackTask;
  }
};

export const getProjectTasks = async (
  projectId: string,
  onRemoteSync?: (tasks: ProjectTask[]) => void
): Promise<ProjectTask[]> => {
  const localTasks = getLocalTasks(projectId);

  const tasksRef = collection(db, 'tasks');
  const q = query(tasksRef, where('projectId', '==', projectId));

  withTimeout(getDocs(q), 3000)
    .then(snapshot => {
      const remoteTasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ProjectTask[];

      const mergedMap = new Map<string, ProjectTask>();
      for (const lt of localTasks) {
        if (lt.id) mergedMap.set(lt.id, lt);
      }
      for (const rt of remoteTasks) {
        if (rt.id) {
          mergedMap.set(rt.id, rt);
        }
      }

      const merged = Array.from(mergedMap.values()).sort((a, b) => b.createdAt - a.createdAt);
      saveLocalTasksAll(projectId, merged);
      if (onRemoteSync) {
        onRemoteSync(merged);
      }
    })
    .catch(() => {});

  return localTasks;
};

export const updateTaskStatus = async (taskId: string, status: ProjectTask['status']) => {
  try {
    const raw = localStorage.getItem(LOCAL_TASKS_KEY);
    if (raw) {
      const all: ProjectTask[] = JSON.parse(raw);
      const updated = all.map(t => t.id === taskId ? { ...t, status } : t);
      localStorage.setItem(LOCAL_TASKS_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.error(e);
  }

  if (!taskId.startsWith('local_')) {
    try {
      const taskRef = doc(db, 'tasks', taskId);
      await withTimeout(updateDoc(taskRef, { status }), 2500);
    } catch (err) {
      console.warn('Görev durumu yerelde güncellendi:', err);
    }
  }
};

// Önceliği sonradan değiştirebilme fonksiyonu
export const updateTaskPriority = async (taskId: string, priority: ProjectTask['priority']) => {
  try {
    const raw = localStorage.getItem(LOCAL_TASKS_KEY);
    if (raw) {
      const all: ProjectTask[] = JSON.parse(raw);
      const updated = all.map(t => t.id === taskId ? { ...t, priority } : t);
      localStorage.setItem(LOCAL_TASKS_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.error(e);
  }

  if (!taskId.startsWith('local_')) {
    try {
      const taskRef = doc(db, 'tasks', taskId);
      await withTimeout(updateDoc(taskRef, { priority }), 2500);
    } catch (err) {
      console.warn('Görev önceliği yerelde güncellendi:', err);
    }
  }
};

export const deleteTask = async (taskId: string) => {
  try {
    const raw = localStorage.getItem(LOCAL_TASKS_KEY);
    if (raw) {
      const all: ProjectTask[] = JSON.parse(raw);
      localStorage.setItem(LOCAL_TASKS_KEY, JSON.stringify(all.filter(t => t.id !== taskId)));
    }
  } catch (e) {
    console.error(e);
  }

  if (!taskId.startsWith('local_')) {
    try {
      const taskRef = doc(db, 'tasks', taskId);
      await withTimeout(deleteDoc(taskRef), 2500);
    } catch (err) {
      console.warn('Görev silme hatası:', err);
    }
  }
};

// ========================
// 3. MEDIA (Görsel ve Versiyon Galerisi)
// ========================

export const getLocalMedia = (projectId: string): ProjectMedia[] => {
  try {
    const raw = localStorage.getItem(LOCAL_MEDIA_KEY);
    if (!raw) return [];
    const all: ProjectMedia[] = JSON.parse(raw);
    return all.filter(m => m.projectId === projectId).sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
};

const saveLocalMedia = (media: ProjectMedia) => {
  try {
    const raw = localStorage.getItem(LOCAL_MEDIA_KEY);
    const all: ProjectMedia[] = raw ? JSON.parse(raw) : [];
    const filtered = all.filter(m => m.id !== media.id);
    localStorage.setItem(LOCAL_MEDIA_KEY, JSON.stringify([media, ...filtered]));
  } catch (e) {
    console.error(e);
  }
};

const saveLocalMediaAll = (projectId: string, newMedia: ProjectMedia[]) => {
  try {
    const raw = localStorage.getItem(LOCAL_MEDIA_KEY);
    const all: ProjectMedia[] = raw ? JSON.parse(raw) : [];
    const others = all.filter(m => m.projectId !== projectId);
    localStorage.setItem(LOCAL_MEDIA_KEY, JSON.stringify([...newMedia, ...others]));
  } catch (e) {
    console.error(e);
  }
};

export const addProjectMedia = async (
  projectId: string,
  data: Omit<ProjectMedia, 'id' | 'projectId' | 'createdAt'>
): Promise<ProjectMedia> => {
  const mediaRef = collection(db, 'media');
  const now = Date.now();
  const newMediaData = {
    ...data,
    projectId,
    createdAt: now,
  };

  try {
    const docRef = await withTimeout(addDoc(mediaRef, newMediaData), 2500);
    const created = { id: docRef.id, ...newMediaData } as ProjectMedia;
    saveLocalMedia(created);
    return created;
  } catch (err) {
    console.warn('Görsel yerel önbelleğe anında kaydedildi:', err);
    const fallbackMedia = { id: 'local_media_' + now, ...newMediaData } as ProjectMedia;
    saveLocalMedia(fallbackMedia);
    return fallbackMedia;
  }
};

export const getProjectMedia = async (
  projectId: string,
  onRemoteSync?: (media: ProjectMedia[]) => void
): Promise<ProjectMedia[]> => {
  const localMedia = getLocalMedia(projectId);

  const mediaRef = collection(db, 'media');
  const q = query(mediaRef, where('projectId', '==', projectId));

  withTimeout(getDocs(q), 3000)
    .then(snapshot => {
      const remoteMedia = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ProjectMedia[];

      const mergedMap = new Map<string, ProjectMedia>();
      for (const lm of localMedia) {
        if (lm.id) mergedMap.set(lm.id, lm);
      }
      for (const rm of remoteMedia) {
        if (rm.id) {
          mergedMap.set(rm.id, rm);
        }
      }

      const merged = Array.from(mergedMap.values()).sort((a, b) => b.createdAt - a.createdAt);
      saveLocalMediaAll(projectId, merged);
      if (onRemoteSync) {
        onRemoteSync(merged);
      }
    })
    .catch(() => {});

  return localMedia;
};

export const deleteProjectMedia = async (mediaId: string): Promise<void> => {
  try {
    const raw = localStorage.getItem(LOCAL_MEDIA_KEY);
    if (raw) {
      const all: ProjectMedia[] = JSON.parse(raw);
      localStorage.setItem(LOCAL_MEDIA_KEY, JSON.stringify(all.filter(m => m.id !== mediaId)));
    }
  } catch (e) {
    console.error(e);
  }

  if (!mediaId.startsWith('local_')) {
    try {
      const ref = doc(db, 'media', mediaId);
      await withTimeout(deleteDoc(ref), 2500);
    } catch (err) {
      console.warn('Firestore medya silme hatası:', err);
    }
  }
};
