import { useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import { auth } from '../firebase';
import { Terminal, LogIn, UserPlus, CheckSquare, Square, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Auth() {
  const { saveRememberMe, getRememberedCreds } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    const creds = getRememberedCreds();
    if (creds?.email) {
      setEmail(creds.email);
      if (creds.pass && creds.pass !== 'google_oauth_session') {
        setPassword(creds.pass);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let userObj: { uid: string; email: string | null } = { uid: '', email: email };
      if (isLogin) {
        const res = await signInWithEmailAndPassword(auth, email, password);
        userObj = { uid: res.user.uid, email: res.user.email };
      } else {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        userObj = { uid: res.user.uid, email: res.user.email };
      }

      if (rememberMe) {
        saveRememberMe(email, password, userObj);
      } else {
        localStorage.removeItem('devlog_remember_creds');
      }
    } catch (err: any) {
      console.error(err);
      let msg = err.message || 'Bir hata oluştu.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        msg = 'Hatalı e-posta veya şifre girdiniz.';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'Bu e-posta adresi zaten kullanımda. Giriş yapmayı deneyin.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Şifreniz en az 6 karakter olmalıdır.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const userObj = { uid: result.user.uid, email: result.user.email };

      if (rememberMe) {
        saveRememberMe(result.user.email || '', 'google_oauth_session', userObj);
      }
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Firebase Konsolunda Google ile giriş henüz aktif edilmemiş! Lütfen Firebase Console -> Authentication -> Sign-in method sekmesinden Google seçeneğini etkinleştirin.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        // Kullanıcı pencereyi kapattı, hata basmaya gerek yok
      } else if (err.code === 'auth/unauthorized-domain') {
        setError('Firebase Yetkilendirilmiş Alan Adı (Authorized Domain) hatası. Firebase Console -> Authentication -> Settings -> Authorized domains kısmına localhost eklenmeli.');
      } else {
        setError(err.message || 'Google ile giriş yapılırken bir sorun oluştu.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-text p-4">
      <div className="w-full max-w-md bg-surface p-8 rounded-2xl border border-border shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
            <Terminal className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">DevLog</h1>
          <p className="text-text-muted mt-2 text-sm text-center">
            {isLogin 
              ? 'Projelerine dönmek için giriş yap.' 
              : 'Yeni bir geliştirici hesabı oluştur.'}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg text-sm mb-6 leading-relaxed">
            {error}
          </div>
        )}

        {/* Google ile Giriş Butonu */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading || loading}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-800 py-2.5 rounded-lg font-medium transition-all active:scale-[0.98] border border-slate-300 shadow-sm disabled:opacity-50"
        >
          {googleLoading ? (
            <Loader2 className="w-5 h-5 animate-spin text-slate-600" />
          ) : (
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          )}
          <span>{googleLoading ? 'Google Bağlanıyor...' : 'Google ile Giriş Yap'}</span>
        </button>

        {/* Divider */}
        <div className="flex items-center my-6">
          <div className="flex-1 border-t border-border"></div>
          <span className="px-3 text-xs text-text-muted uppercase tracking-wider font-medium">veya e-posta ile</span>
          <div className="flex-1 border-t border-border"></div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1.5">
              E-posta Adresi
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:border-primary transition-colors text-white"
              placeholder="ornek@mail.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1.5">
              Şifre
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:border-primary transition-colors text-white"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          {/* Beni Hatırla Seçeneği */}
          <div 
            onClick={() => setRememberMe(!rememberMe)}
            className="flex items-center gap-2 cursor-pointer text-xs text-text-muted hover:text-white transition-colors py-1 select-none"
          >
            {rememberMe ? (
              <CheckSquare className="w-4 h-4 text-primary" />
            ) : (
              <Square className="w-4 h-4 text-text-muted" />
            )}
            <span>Beni Hatırla (Her girişte tekrar sorma)</span>
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white py-2.5 rounded-lg font-medium transition-all active:scale-[0.98] mt-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />)}
            {loading ? 'İşleniyor...' : (isLogin ? 'E-posta ile Giriş Yap' : 'Kayıt Ol')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-text-muted hover:text-white transition-colors"
          >
            {isLogin 
              ? 'Hesabın yok mu? Hemen kayıt ol.' 
              : 'Zaten hesabın var mı? Giriş yap.'}
          </button>
        </div>
      </div>
    </div>
  );
}
