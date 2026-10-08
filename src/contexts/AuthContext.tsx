import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as fbSignOut, type User } from 'firebase/auth';
import { auth } from '../firebase';


export interface LocalUser {
  uid: string;
  email: string | null;
}

interface AuthContextType {
  currentUser: User | LocalUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  saveRememberMe: (email: string, pass: string, user?: { uid: string; email: string | null }) => void;
  getRememberedCreds: () => { email: string; pass: string } | null;
}

const REMEMBER_KEY = 'devlog_remember_creds';
const SESSION_USER_KEY = 'devlog_saved_session_user';

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  loading: true,
  logout: async () => {},
  saveRememberMe: () => {},
  getRememberedCreds: () => null,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | LocalUser | null>(() => {
    try {
      const saved = localStorage.getItem(SESSION_USER_KEY);
      if (saved) return JSON.parse(saved);
      const rem = localStorage.getItem(REMEMBER_KEY);
      if (rem) {
        const parsed = JSON.parse(rem);
        if (parsed.email) {
          return { uid: 'user_' + parsed.email.replace(/[^a-zA-Z0-9]/g, '_'), email: parsed.email };
        }
      }
      return null;
    } catch {
      return null;
    }
  });

  const [loading] = useState(false);

  useEffect(() => {
    // 1. Yerel masaüstü oturum kontrolü (Önce Native IPC, sonra HTTP API)
    const initSession = async () => {
      let diskData: any = null;
      if (window.devlogDesktop?.getSession) {
        try {
          diskData = await window.devlogDesktop.getSession();
        } catch (e) {
          console.warn('Native IPC getSession error:', e);
        }
      }

      if (!diskData) {
        try {
          const res = await fetch('/api/session');
          diskData = await res.json();
        } catch (e) {}
      }

      if (diskData?.user) {
        setCurrentUser(diskData.user);
        localStorage.setItem(SESSION_USER_KEY, JSON.stringify(diskData.user));
      }

      const email = diskData?.creds?.email || getRememberedCreds()?.email;
      const pass = diskData?.creds?.pass || getRememberedCreds()?.pass;

      if (email && pass) {
        try {
          const cred = await signInWithEmailAndPassword(auth, email, pass);
          const u = { uid: cred.user.uid, email: cred.user.email };
          setCurrentUser(u);
          localStorage.setItem(SESSION_USER_KEY, JSON.stringify(u));
        } catch (e) {
          console.warn('Otomatik Firebase girişi (arka plan):', e);
        }
      }
    };

    initSession();

    // 2. Firebase auth state listener
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const u = { uid: user.uid, email: user.email };
        setCurrentUser(u);
        localStorage.setItem(SESSION_USER_KEY, JSON.stringify(u));
      } else {
        // Çıkış yapılmadıysa oturumu koru
        const rem = getRememberedCreds();
        const saved = localStorage.getItem(SESSION_USER_KEY);
        if (rem || saved) {
          if (saved) {
            try {
              setCurrentUser(JSON.parse(saved));
            } catch {}
          }
        } else {
          setCurrentUser(null);
        }
      }
    });

    return unsubscribe;
  }, []);

  const saveRememberMe = (email: string, pass: string, userObj?: { uid: string; email: string | null }) => {
    try {
      const creds = { email, pass };
      localStorage.setItem(REMEMBER_KEY, JSON.stringify(creds));
      if (userObj) {
        localStorage.setItem(SESSION_USER_KEY, JSON.stringify(userObj));
        setCurrentUser(userObj);
      }

      // 1. Native IPC ile diske yaz (Paketlenmiş .exe içinde garantili)
      if (window.devlogDesktop?.saveSession) {
        window.devlogDesktop.saveSession({ creds, user: userObj }).catch(console.error);
      }

      // 2. HTTP sunucu API fallback
      fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creds, user: userObj })
      }).catch(() => {});
    } catch (e) {
      console.error(e);
    }
  };

  const getRememberedCreds = () => {
    try {
      const raw = localStorage.getItem(REMEMBER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const logout = async () => {
    localStorage.removeItem(SESSION_USER_KEY);
    localStorage.removeItem(REMEMBER_KEY);
    setCurrentUser(null);

    if (window.devlogDesktop?.clearSession) {
      window.devlogDesktop.clearSession().catch(console.error);
    }
    fetch('/api/session', { method: 'DELETE' }).catch(() => {});

    try {
      await fbSignOut(auth);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, loading, logout, saveRememberMe, getRememberedCreds }}>
      {children}
    </AuthContext.Provider>
  );
};
