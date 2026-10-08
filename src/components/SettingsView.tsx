import { useState, useEffect } from 'react';
import { 
  Key, 
  Sparkles, 
  Download, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  User, 
  HardDrive, 
  Info, 
  ShieldCheck,
  RefreshCw,
  ArrowLeft,
  ArrowDownToLine
} from 'lucide-react';
import { getGeminiApiKey, setGeminiApiKey, testGeminiConnection } from '../lib/gemini';
import { useAuth } from '../contexts/AuthContext';
import type { UpdateStatus } from '../types';

export default function SettingsView({ onBack }: { onBack: () => void }) {
  const { currentUser } = useAuth();
  
  // Gemini API Key state
  const [apiKey, setApiKey] = useState('');
  const [testStatus, setTestStatus] = useState<{ loading: boolean; success?: boolean; message?: string }>({ loading: false });

  // Auto Updater state
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [appVersion, setAppVersion] = useState('v1.0.1');

  // Developer Profile state
  const [devName, setDevName] = useState(() => localStorage.getItem('devlog_profile_name') || 'Solo Geliştirici');
  const [devStudio, setDevStudio] = useState(() => localStorage.getItem('devlog_profile_studio') || 'Indie Studio');
  const [profileSaved, setProfileSaved] = useState(false);

  // Storage Stats
  const [cacheStats, setCacheStats] = useState({ projects: 0, logs: 0, tasks: 0, media: 0 });

  useEffect(() => {
    setApiKey(getGeminiApiKey());
    calculateStats();
    if (window.devlogDesktop?.getAppVersion) {
      window.devlogDesktop.getAppVersion().then(v => {
        if (v) setAppVersion('v' + v);
      });
    }
  }, []);

  const calculateStats = () => {
    try {
      const p = JSON.parse(localStorage.getItem('devlog_projects_cache') || '[]');
      const l = JSON.parse(localStorage.getItem('devlog_logs_cache') || '[]');
      const t = JSON.parse(localStorage.getItem('devlog_tasks_cache') || '[]');
      const m = JSON.parse(localStorage.getItem('devlog_media_cache') || '[]');
      setCacheStats({ projects: p.length, logs: l.length, tasks: t.length, media: m.length });
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (window.devlogDesktop?.onUpdateStatus) {
      const unsub = window.devlogDesktop.onUpdateStatus((status) => {
        setUpdateStatus(status);
        if (status.status !== 'checking') {
          setCheckingUpdate(false);
        }
      });
      return unsub;
    }
  }, []);

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateStatus({ status: 'checking', message: 'Güncellemeler kontrol ediliyor...' });
    if (window.devlogDesktop?.checkForUpdates) {
      try {
        const res = await window.devlogDesktop.checkForUpdates();
        if (res.status === 'unsupported' || res.status === 'error') {
          setUpdateStatus({ status: res.status, message: res.message || 'Güncelleme sunucusuna erişilemedi.' });
          setCheckingUpdate(false);
        }
      } catch (err: any) {
        setUpdateStatus({ status: 'error', message: err.message || 'Güncelleme kontrolü başarısız.' });
        setCheckingUpdate(false);
      }
    } else {
      setTimeout(() => {
        setUpdateStatus({ status: 'not-available', message: 'Uygulamanız en güncel sürümde (v1.0.0).' });
        setCheckingUpdate(false);
      }, 1000);
    }
  };

  const handleInstallUpdate = () => {
    if (window.devlogDesktop?.installUpdate) {
      window.devlogDesktop.installUpdate();
    }
  };

  const handleSaveApiKey = () => {
    setGeminiApiKey(apiKey);
    setTestStatus({ loading: false, success: true, message: 'API anahtarı kaydedildi!' });
    setTimeout(() => setTestStatus({ loading: false }), 2500);
  };

  const handleTestKey = async () => {
    setTestStatus({ loading: true });
    const res = await testGeminiConnection(apiKey);
    setTestStatus({ loading: false, success: res.success, message: res.message });
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('devlog_profile_name', devName);
    localStorage.setItem('devlog_profile_studio', devStudio);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  };

  const handleExportBackup = () => {
    try {
      const backupData = {
        exportedAt: new Date().toISOString(),
        user: currentUser?.email || 'anonymous',
        profile: { devName, devStudio },
        projects: JSON.parse(localStorage.getItem('devlog_projects_cache') || '[]'),
        logs: JSON.parse(localStorage.getItem('devlog_logs_cache') || '[]'),
        tasks: JSON.parse(localStorage.getItem('devlog_tasks_cache') || '[]'),
        media: JSON.parse(localStorage.getItem('devlog_media_cache') || '[]'),
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `devlog-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Backup error:', e);
    }
  };

  const handleClearCache = () => {
    if (confirm('Yerel önbellek temizlensin mi? (Firestore veritabanındaki verileriniz silinmez, yeniden indirilir).')) {
      localStorage.removeItem('devlog_projects_cache');
      localStorage.removeItem('devlog_logs_cache');
      localStorage.removeItem('devlog_tasks_cache');
      localStorage.removeItem('devlog_media_cache');
      calculateStats();
      alert('Önbellek temizlendi!');
    }
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-background text-text">
      
      {/* Header */}
      <header className="mb-8 flex justify-between items-center border-b border-border pb-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors text-text-muted hover:text-white"
            title="Geri Dön"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold mb-1">Uygulama Ayarları</h2>
            <p className="text-text-muted text-sm">Geliştirici profili, yapay zeka yapılandırması ve veri yönetimi.</p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl flex flex-col gap-8">
        
        {/* 1. Yapay Zeka (Gemini AI) Ayarları */}
        <div className="bg-surface border border-border rounded-xl p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Google Gemini AI Yapılandırması</h3>
              <p className="text-xs text-text-muted">Proje özetleri ve sosyal medya paylaşımları için kullanılan yapay zeka anahtarı.</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <label className="text-sm font-medium text-text-muted flex items-center gap-2">
              <Key className="w-4 h-4 text-primary" /> Gemini API Anahtarı
            </label>
            <div className="flex gap-3">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AQ... veya AIzaSy..."
                className="flex-1 px-4 py-2.5 bg-background border border-border rounded-lg text-sm font-mono focus:outline-none focus:border-primary transition-colors text-white"
              />
              <button
                type="button"
                onClick={handleSaveApiKey}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-lg text-sm font-medium transition-all active:scale-[0.98]"
              >
                Kaydet
              </button>
              <button
                type="button"
                onClick={handleTestKey}
                disabled={testStatus.loading || !apiKey}
                className="px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-50 flex items-center gap-2"
              >
                {testStatus.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Bağlantıyı Test Et
              </button>
            </div>

            {testStatus.message && (
              <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                testStatus.success 
                  ? 'bg-green-500/10 text-green-400 border border-green-500/30' 
                  : 'bg-red-500/10 text-red-400 border border-red-500/30'
              }`}>
                {testStatus.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
                <span>{testStatus.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* 2. Geliştirici Profili */}
        <div className="bg-surface border border-border rounded-xl p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Geliştirici Profili</h3>
              <p className="text-xs text-text-muted">Raporlarda ve dışa aktarmalarda yer alacak kimlik bilgileri.</p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">Geliştirici Adı / Takma Ad</label>
              <input
                type="text"
                value={devName}
                onChange={(e) => setDevName(e.target.value)}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary transition-colors text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">Stüdyo / Ekip Adı</label>
              <input
                type="text"
                value={devStudio}
                onChange={(e) => setDevStudio(e.target.value)}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary transition-colors text-white"
              />
            </div>

            <div className="col-span-full flex items-center justify-between pt-2">
              <span className="text-xs text-text-muted">
                Bağlı Hesap: <strong className="text-white">{currentUser?.email || 'Giriş yapılmadı'}</strong>
              </span>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-all active:scale-[0.98]"
              >
                {profileSaved ? 'Kaydedildi ✓' : 'Profili Güncelle'}
              </button>
            </div>
          </form>
        </div>

        {/* 3. Veri Yönetimi & Yedekleme */}
        <div className="bg-surface border border-border rounded-xl p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Veri Depolama & Yedekleme</h3>
              <p className="text-xs text-text-muted">Yerel önbellek durumu ve tek tıkla tam JSON yedeği alma.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-2">
            <div className="p-3 bg-background border border-border rounded-lg text-center">
              <div className="text-xl font-bold font-mono text-primary">{cacheStats.projects}</div>
              <div className="text-xs text-text-muted mt-0.5">Kayıtlı Proje</div>
            </div>
            <div className="p-3 bg-background border border-border rounded-lg text-center">
              <div className="text-xl font-bold font-mono text-emerald-400">{cacheStats.logs}</div>
              <div className="text-xs text-text-muted mt-0.5">Geliştirici Logu</div>
            </div>
            <div className="p-3 bg-background border border-border rounded-lg text-center">
              <div className="text-xl font-bold font-mono text-amber-400">{cacheStats.tasks}</div>
              <div className="text-xs text-text-muted mt-0.5">Görev & Hata</div>
            </div>
            <div className="p-3 bg-background border border-border rounded-lg text-center">
              <div className="text-xl font-bold font-mono text-fuchsia-400">{cacheStats.media}</div>
              <div className="text-xs text-text-muted mt-0.5">Galeri Görseli</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={handleExportBackup}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-all active:scale-[0.98]"
            >
              <Download className="w-4 h-4" />
              Tüm Verileri JSON Olarak İndir (Yedek)
            </button>
            <button
              type="button"
              onClick={handleClearCache}
              className="flex items-center gap-2 px-4 py-2.5 border border-border hover:bg-white/5 text-text-muted hover:text-white rounded-lg text-sm font-medium transition-all active:scale-[0.98]"
            >
              <RefreshCw className="w-4 h-4" />
              Önbelleği Temizle & Yenile
            </button>
          </div>
        </div>

        {/* 4. Sürüm ve Otomatik Güncelleme */}
        <div className="bg-surface border border-border rounded-xl p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <ArrowDownToLine className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Uygulama Güncellemeleri</h3>
                <p className="text-xs text-text-muted">Mevcut sürüm: <span className="text-white font-mono">{appVersion}</span> • Tek tıkla otomatik güncelleme</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCheckUpdate}
              disabled={checkingUpdate}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-all active:scale-[0.98]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkingUpdate ? 'animate-spin' : ''}`} />
              {checkingUpdate ? 'Kontrol Ediliyor...' : 'Güncellemeleri Denetle'}
            </button>
          </div>

          {updateStatus && (
            <div className={`p-3.5 rounded-lg text-xs flex items-center justify-between gap-3 ${
              updateStatus.status === 'downloaded'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : updateStatus.status === 'available' || updateStatus.status === 'downloading'
                ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30'
                : updateStatus.status === 'error'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'bg-white/5 text-text-muted border border-border'
            }`}>
              <div className="flex items-center gap-2">
                {updateStatus.status === 'checking' && <Loader2 className="w-4 h-4 animate-spin shrink-0 text-indigo-400" />}
                {updateStatus.status === 'downloaded' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                {updateStatus.status === 'not-available' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                {updateStatus.status === 'error' && <XCircle className="w-4 h-4 text-amber-400 shrink-0" />}
                <span>{updateStatus.message || (updateStatus.percent ? `İndiriliyor: %${updateStatus.percent}` : 'İşleniyor...')}</span>
              </div>

              {updateStatus.status === 'downloaded' && (
                <button
                  type="button"
                  onClick={handleInstallUpdate}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-medium text-xs transition-all active:scale-[0.96]"
                >
                  Yeniden Başlat ve Yükle
                </button>
              )}
            </div>
          )}
        </div>

        {/* 5. Sistem ve Sürüm Bilgisi */}
        <div className="bg-surface/50 border border-border rounded-xl p-5 flex items-center justify-between text-xs text-text-muted">
          <div className="flex items-center gap-3">
            <Info className="w-5 h-5 text-text-muted shrink-0" />
            <div>
              <p className="font-semibold text-white">DevLog - Game Developer Project & AI Assistant</p>
              <p>Masaüstü Sürümü: {appVersion} • Electron 44 • React 19 • Firebase Sync</p>
            </div>
          </div>
          <div className="px-3 py-1 bg-white/5 rounded-full border border-border font-mono text-[11px]">
            Desktop Windows/macOS
          </div>
        </div>

      </div>
    </div>
  );
}
