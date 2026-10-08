import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs,
  doc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Project } from '../types';

const LOCAL_PROJECTS_KEY = 'devlog_projects_cache';

export const getLocalProjects = (userId?: string): Project[] => {
  try {
    const raw = localStorage.getItem(LOCAL_PROJECTS_KEY);
    if (!raw) return [];
    const all: Project[] = JSON.parse(raw);
    if (!userId) return all.sort((a, b) => b.updatedAt - a.updatedAt);
    
    const filtered = all.filter(p => p.userId === userId);
    // Masaüstü uygulamasında tek kullanıcı olduğu için, yerelde proje varsa ama userId farklıysa bunları kullanıcının kabul et:
    if (filtered.length === 0 && all.length > 0) {
      const remapped = all.map(p => ({ ...p, userId }));
      localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(remapped));
      return remapped.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    return filtered.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
};

export const saveLocalProjects = (projects: Project[]) => {
  try {
    localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(projects));
  } catch (e) {
    console.error('Local projects save error:', e);
  }
};

export const saveLocalProject = (project: Project) => {
  try {
    const raw = localStorage.getItem(LOCAL_PROJECTS_KEY);
    const all: Project[] = raw ? JSON.parse(raw) : [];
    const filtered = all.filter(p => p.id !== project.id);
    localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify([project, ...filtered]));
  } catch (e) {
    console.error(e);
  }
};

export const updateLocalProjectMeta = (projectId: string, updates: Partial<Project>) => {
  try {
    const raw = localStorage.getItem(LOCAL_PROJECTS_KEY);
    if (!raw) return;
    const all: Project[] = JSON.parse(raw);
    const updated = all.map(p => p.id === projectId ? { ...p, ...updates } : p);
    localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error(e);
  }
};

export const deleteLocalProject = (projectId: string) => {
  try {
    const raw = localStorage.getItem(LOCAL_PROJECTS_KEY);
    if (!raw) return;
    const all: Project[] = JSON.parse(raw);
    const filtered = all.filter(p => p.id !== projectId);
    localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error(e);
  }
};

const withTimeout = <T>(promise: Promise<T>, ms = 2500): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('FIRESTORE_TIMEOUT')), ms))
  ]);
};

export const addProject = async (
  userId: string, 
  data: Omit<Project, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'version'>
): Promise<Project> => {
  const projectsRef = collection(db, 'projects');
  
  const newProjectData = {
    ...data,
    userId,
    version: 'v0.1.0',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  try {
    const docRef = await withTimeout(addDoc(projectsRef, newProjectData), 2500);
    const created = { id: docRef.id, ...newProjectData } as Project;
    saveLocalProject(created);
    return created;
  } catch (err) {
    console.warn('Firestore gecikti, yerel önbellek ile anında kaydedildi:', err);
    const fallbackProject = { id: 'local_' + Date.now(), ...newProjectData } as Project;
    saveLocalProject(fallbackProject);
    return fallbackProject;
  }
};

export const updateProject = async (
  projectId: string,
  data: Partial<Project>
): Promise<Project> => {
  const updates = {
    ...data,
    updatedAt: Date.now(),
  };

  updateLocalProjectMeta(projectId, updates);

  if (!projectId.startsWith('local_')) {
    try {
      const projectRef = doc(db, 'projects', projectId);
      await withTimeout(updateDoc(projectRef, updates), 2500);
    } catch (err) {
      console.warn('Firestore güncelleme hatası (yerelde saklandı):', err);
    }
  }

  const raw = localStorage.getItem(LOCAL_PROJECTS_KEY);
  const all: Project[] = raw ? JSON.parse(raw) : [];
  const found = all.find(p => p.id === projectId);
  return found || ({ id: projectId, ...updates } as Project);
};

export const deleteProject = async (projectId: string): Promise<void> => {
  deleteLocalProject(projectId);

  if (!projectId.startsWith('local_')) {
    try {
      const projectRef = doc(db, 'projects', projectId);
      await withTimeout(deleteDoc(projectRef), 2500);
    } catch (err) {
      console.warn('Firestore silme hatası:', err);
    }
  }
};

// SWR (Stale While Revalidate) Pattern for ultra-fast loading
export const getUserProjects = async (
  userId: string, 
  onRemoteSync?: (projects: Project[], status: 'connected' | 'offline_or_rules_needed') => void
): Promise<Project[]> => {
  // 1. ANINDA yerel önbellekten getir (0ms)
  const localProjects = getLocalProjects(userId);

  // 2. Arka planda sessizce Firestore ile senkronize et
  const projectsRef = collection(db, 'projects');
  const q = query(projectsRef, where('userId', '==', userId));

  withTimeout(getDocs(q), 3000)
    .then(snapshot => {
      const remoteProjects = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];

      const mergedMap = new Map<string, Project>();
      for (const lp of localProjects) {
        if (lp.id) mergedMap.set(lp.id, lp);
      }
      for (const rp of remoteProjects) {
        if (rp.id) mergedMap.set(rp.id, rp);
      }

      const merged = Array.from(mergedMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);
      saveLocalProjects(merged);
      if (onRemoteSync) {
        onRemoteSync(merged, 'connected');
      }
    })
    .catch(err => {
      console.warn('Arka plan Firestore senkronizasyonu atlandı (yerel önbellek devrede):', err);
      if (onRemoteSync) {
        onRemoteSync(localProjects, 'offline_or_rules_needed');
      }
    });

  return localProjects;
};
