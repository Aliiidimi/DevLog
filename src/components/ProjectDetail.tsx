import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  Clock, 
  FileText, 
  Bug, 
  CheckCircle2, 
  Circle, 
  Loader2, 
  Sparkles, 
  MessageSquare, 
  Hash, 
  Image as ImageIcon, 
  ListTodo, 
  Settings2, 
  Trash2, 
  Copy, 
  Check, 
  Upload, 
  Maximize2, 
  X,
  AlertCircle,
  LayoutDashboard,
  ArrowRight,
  Zap,
  Target
} from 'lucide-react';
import type { Project, DailyLog, ProjectTask, ProjectMedia } from '../types';
import { 
  getProjectLogs, 
  addDailyLog, 
  deleteDailyLog,
  getProjectTasks, 
  addTask, 
  updateTaskStatus, 
  updateTaskPriority,
  deleteTask,
  getProjectMedia,
  addProjectMedia,
  deleteProjectMedia
} from '../lib/projectDetails';
import { generateProjectSummary, generateSocialMediaPost } from '../lib/gemini';
import EditProjectModal from './EditProjectModal';

export default function ProjectDetail({ 
  project: initialProject, 
  onBack,
  onProjectUpdated,
  onProjectDeleted
}: { 
  project: Project;
  onBack: () => void;
  onProjectUpdated: (p: Project) => void;
  onProjectDeleted: (projectId: string) => void;
}) {
  const [project, setProject] = useState<Project>(initialProject);
  const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'todos' | 'bugs' | 'media' | 'ai'>('overview');

  // Data States
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [mediaList, setMediaList] = useState<ProjectMedia[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // New Log Form
  const [newLogContent, setNewLogContent] = useState('');
  const [newLogHours, setNewLogHours] = useState('');
  const [newLogVersion, setNewLogVersion] = useState(project.version);
  const [isAddingLog, setIsAddingLog] = useState(false);

  // New To-Do Form
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [newTodoPriority, setNewTodoPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [isAddingTodo, setIsAddingTodo] = useState(false);

  // New Bug Form
  const [newBugTitle, setNewBugTitle] = useState('');
  const [newBugDesc, setNewBugDesc] = useState('');
  const [newBugVersion, setNewBugVersion] = useState(project.version);
  const [newBugPriority, setNewBugPriority] = useState<'low' | 'medium' | 'high'>('high');
  const [isAddingBug, setIsAddingBug] = useState(false);

  // New Media Form
  const [mediaTitle, setMediaTitle] = useState('');
  const [mediaDesc, setMediaDesc] = useState('');
  const [mediaVersion, setMediaVersion] = useState(project.version);
  const [mediaUrl, setMediaUrl] = useState('');
  const [isAddingMedia, setIsAddingMedia] = useState(false);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<ProjectMedia | null>(null);

  // AI States
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [copiedAi, setCopiedAi] = useState(false);

  useEffect(() => {
    setProject(initialProject);
  }, [initialProject]);

  useEffect(() => {
    if (!project.id) return;
    loadAllData();
  }, [project.id]);

  const loadAllData = async () => {
    if (!project.id) return;
    const [cachedLogs, cachedTasks, cachedMedia] = await Promise.all([
      getProjectLogs(project.id, (syncedLogs) => setLogs(syncedLogs)),
      getProjectTasks(project.id, (syncedTasks) => setTasks(syncedTasks)),
      getProjectMedia(project.id, (syncedMedia) => setMediaList(syncedMedia))
    ]);

    setLogs(cachedLogs);
    setTasks(cachedTasks);
    setMediaList(cachedMedia);
  };

  // --- Handlers: Logs ---
  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project.id) return;
    setIsAddingLog(true);
    try {
      const added = await addDailyLog(project.id, {
        content: newLogContent,
        hoursWorked: Number(newLogHours) || 0,
        version: newLogVersion || project.version
      });
      setLogs([added, ...logs]);
      setNewLogContent('');
      setNewLogHours('');
      if (newLogVersion !== project.version) {
        const updated = { ...project, version: newLogVersion };
        setProject(updated);
        onProjectUpdated(updated);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAddingLog(false);
    }
  };

  const handleDeleteLog = async (logId: string) => {
    setLogs(logs.filter(l => l.id !== logId));
    await deleteDailyLog(logId);
  };

  // --- Handlers: Todos ---
  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project.id || !newTodoTitle) return;
    setIsAddingTodo(true);
    try {
      const added = await addTask(project.id, {
        title: newTodoTitle,
        type: 'todo',
        priority: newTodoPriority,
        status: 'pending'
      });
      setTasks([added, ...tasks]);
      setNewTodoTitle('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsAddingTodo(false);
    }
  };

  // --- Handlers: Bugs ---
  const handleAddBug = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project.id || !newBugTitle) return;
    setIsAddingBug(true);
    try {
      const added = await addTask(project.id, {
        title: newBugTitle,
        description: newBugDesc,
        version: newBugVersion || project.version,
        type: 'bug',
        priority: newBugPriority,
        status: 'pending'
      });
      setTasks([added, ...tasks]);
      setNewBugTitle('');
      setNewBugDesc('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsAddingBug(false);
    }
  };

  const toggleTaskStatus = async (task: ProjectTask) => {
    const nextStatus: ProjectTask['status'] = 
      task.status === 'completed' ? 'pending' : 'completed';
    setTasks(tasks.map(t => t.id === task.id ? { ...t, status: nextStatus } : t));
    if (task.id) {
      await updateTaskStatus(task.id, nextStatus);
    }
  };

  const handleCyclePriority = async (task: ProjectTask, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!task.id) return;
    const nextPriority: ProjectTask['priority'] = 
      task.priority === 'low' ? 'medium' : task.priority === 'medium' ? 'high' : 'low';
    setTasks(tasks.map(t => t.id === task.id ? { ...t, priority: nextPriority } : t));
    await updateTaskPriority(task.id, nextPriority);
  };

  const handleDeleteTask = async (taskId?: string) => {
    if (!taskId) return;
    setTasks(tasks.filter(t => t.id !== taskId));
    await deleteTask(taskId);
  };

  // --- Handlers: Media ---
  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setMediaUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project.id || !mediaUrl) return;
    setIsAddingMedia(true);
    try {
      const added = await addProjectMedia(project.id, {
        title: mediaTitle || 'Ekran Görüntüsü',
        description: mediaDesc,
        imageUrl: mediaUrl,
        version: mediaVersion || project.version
      });
      setMediaList([added, ...mediaList]);
      setMediaTitle('');
      setMediaDesc('');
      setMediaUrl('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsAddingMedia(false);
    }
  };

  const handleDeleteMedia = async (mediaId?: string) => {
    if (!mediaId) return;
    setMediaList(mediaList.filter(m => m.id !== mediaId));
    await deleteProjectMedia(mediaId);
  };

  // --- Handlers: AI ---
  const handleAI = async (action: 'summary-24h' | 'summary-all' | 'social-discord' | 'social-instagram') => {
    setIsAiLoading(true);
    setAiResult(null);
    setCopiedAi(false);
    try {
      let result = '';
      if (action === 'summary-24h') result = await generateProjectSummary(logs, tasks, '24h');
      else if (action === 'summary-all') result = await generateProjectSummary(logs, tasks, 'all');
      else if (action === 'social-discord') result = await generateSocialMediaPost(logs, 'discord');
      else if (action === 'social-instagram') result = await generateSocialMediaPost(logs, 'instagram');
      setAiResult(result);
    } catch (err: any) {
      setAiResult("Yapay zeka hatası: " + err.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleCopyAi = () => {
    if (!aiResult) return;
    navigator.clipboard.writeText(aiResult);
    setCopiedAi(true);
    setTimeout(() => setCopiedAi(false), 2000);
  };

  // Filtered Lists & Calculations
  const todoList = tasks.filter(t => t.type === 'todo');
  const bugList = tasks.filter(t => t.type === 'bug');
  const pendingTodos = todoList.filter(t => t.status !== 'completed');
  const openBugs = bugList.filter(b => b.status !== 'completed');
  const totalHoursWorked = logs.reduce((sum, l) => sum + (Number(l.hoursWorked) || 0), 0);

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-background">
      
      {/* Top Header */}
      <header className="p-6 border-b border-border flex justify-between items-center bg-surface shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors text-text-muted hover:text-white"
            title="Geri Dön"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold" style={{ color: project.color }}>
                {project.name}
              </h2>
              <span className="text-xs px-2.5 py-1 bg-background text-text rounded-md border border-border font-mono">
                {project.version}
              </span>
            </div>
            <p className="text-xs text-text-muted mt-0.5">{project.engine} • {project.type}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-border hover:bg-white/5 text-text-muted hover:text-white text-xs font-medium transition-all active:scale-[0.98]"
          >
            <Settings2 className="w-4 h-4" />
            Projeyi Düzenle
          </button>
        </div>
      </header>

      {/* Tabs Navigation */}
      <div className="px-8 border-b border-border bg-surface/50 flex gap-1 shrink-0 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-medium border-b-2 transition-all shrink-0 ${
            activeTab === 'overview'
              ? 'border-primary text-primary bg-primary/5 font-semibold'
              : 'border-transparent text-text-muted hover:text-white'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          Genel Bakış
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-medium border-b-2 transition-all shrink-0 ${
            activeTab === 'logs'
              ? 'border-primary text-primary bg-primary/5 font-semibold'
              : 'border-transparent text-text-muted hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          Günlük Loglar ({logs.length})
        </button>

        <button
          onClick={() => setActiveTab('todos')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-medium border-b-2 transition-all shrink-0 ${
            activeTab === 'todos'
              ? 'border-primary text-primary bg-primary/5 font-semibold'
              : 'border-transparent text-text-muted hover:text-white'
          }`}
        >
          <ListTodo className="w-4 h-4" />
          Yapılacaklar ({pendingTodos.length})
        </button>

        <button
          onClick={() => setActiveTab('bugs')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-medium border-b-2 transition-all shrink-0 ${
            activeTab === 'bugs'
              ? 'border-red-500 text-red-400 bg-red-500/5 font-semibold'
              : 'border-transparent text-text-muted hover:text-white'
          }`}
        >
          <Bug className="w-4 h-4 text-red-400" />
          Hatalar & Bugs ({openBugs.length})
        </button>

        <button
          onClick={() => setActiveTab('media')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-medium border-b-2 transition-all shrink-0 ${
            activeTab === 'media'
              ? 'border-fuchsia-500 text-fuchsia-400 bg-fuchsia-500/5 font-semibold'
              : 'border-transparent text-text-muted hover:text-white'
          }`}
        >
          <ImageIcon className="w-4 h-4 text-fuchsia-400" />
          Görsel Galerisi ({mediaList.length})
        </button>

        <button
          onClick={() => setActiveTab('ai')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-medium border-b-2 transition-all shrink-0 ${
            activeTab === 'ai'
              ? 'border-amber-500 text-amber-400 bg-amber-500/5 font-semibold'
              : 'border-transparent text-text-muted hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          Gemini Asistanı
        </button>
      </div>

      {/* Main Tab Content Body */}
      <div className="flex-1 overflow-y-auto p-8">
        
        {/* ======================================================== */}
        {/* TAB 0: GENEL BAKIŞ (ÖN İZLEME VE ANA SAYFA KOKPİTİ) */}
        {/* ======================================================== */}
        {activeTab === 'overview' && (
          <div className="max-w-5xl mx-auto flex flex-col gap-8">
            
            {/* Büyük Selamlama & Proje Kartı Hero Banner */}
            <div 
              className="bg-surface border border-border rounded-2xl p-8 relative overflow-hidden shadow-xl"
              style={{ borderLeft: `6px solid ${project.color}` }}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-medium bg-white/10 text-white">
                      {project.version}
                    </span>
                    <span className="text-xs text-text-muted">• {project.engine} • {project.type}</span>
                  </div>
                  <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">
                    Hoş Geldin, Geliştirici! 🎮
                  </h1>
                  <p className="text-sm text-text-muted leading-relaxed max-w-2xl">
                    <strong className="text-white">{project.name}</strong> projenin geliştirme masasına hoş geldin. Bugün oyuna yeni mekanikler eklemek ve ilerlemeni kaydetmek için harika bir gün!
                  </p>
                </div>

                {/* Hızlı Eylem Kısayolları */}
                <div className="flex flex-wrap gap-2.5">
                  <button
                    onClick={() => setActiveTab('logs')}
                    className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-medium transition-all active:scale-[0.98] shadow-md"
                  >
                    <Plus className="w-4 h-4" /> Log Ekle
                  </button>
                  <button
                    onClick={() => setActiveTab('todos')}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-medium transition-all active:scale-[0.98]"
                  >
                    <ListTodo className="w-4 h-4" /> Görev Ekle
                  </button>
                  <button
                    onClick={() => setActiveTab('bugs')}
                    className="flex items-center gap-2 px-4 py-2.5 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-xl text-xs font-medium transition-all active:scale-[0.98]"
                  >
                    <Bug className="w-4 h-4" /> Hata Kaydet
                  </button>
                </div>
              </div>
            </div>

            {/* Hızlı İstatistik Kartları */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div 
                onClick={() => setActiveTab('logs')}
                className="p-5 bg-surface border border-border hover:border-primary/50 rounded-xl transition-all cursor-pointer group shadow-sm"
              >
                <div className="flex items-center justify-between text-text-muted mb-2">
                  <span className="text-xs font-medium">Toplam Çalışma</span>
                  <Clock className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                </div>
                <div className="text-2xl font-bold font-mono text-white">{totalHoursWorked} <span className="text-sm font-normal text-text-muted">saat</span></div>
                <div className="text-[11px] text-text-muted mt-1">{logs.length} adet geliştirici logu</div>
              </div>

              <div 
                onClick={() => setActiveTab('todos')}
                className="p-5 bg-surface border border-border hover:border-primary/50 rounded-xl transition-all cursor-pointer group shadow-sm"
              >
                <div className="flex items-center justify-between text-text-muted mb-2">
                  <span className="text-xs font-medium">Yapılacaklar</span>
                  <Target className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                </div>
                <div className="text-2xl font-bold font-mono text-amber-400">{pendingTodos.length} <span className="text-sm font-normal text-text-muted">bekliyor</span></div>
                <div className="text-[11px] text-text-muted mt-1">{todoList.length - pendingTodos.length} görev tamamlandı</div>
              </div>

              <div 
                onClick={() => setActiveTab('bugs')}
                className="p-5 bg-surface border border-border hover:border-red-500/50 rounded-xl transition-all cursor-pointer group shadow-sm"
              >
                <div className="flex items-center justify-between text-text-muted mb-2">
                  <span className="text-xs font-medium">Açık Hatalar</span>
                  <Bug className="w-4 h-4 text-red-400 group-hover:scale-110 transition-transform" />
                </div>
                <div className="text-2xl font-bold font-mono text-red-400">{openBugs.length} <span className="text-sm font-normal text-text-muted">açık</span></div>
                <div className="text-[11px] text-text-muted mt-1">{bugList.length} toplam hata kaydı</div>
              </div>

              <div 
                onClick={() => setActiveTab('media')}
                className="p-5 bg-surface border border-border hover:border-fuchsia-500/50 rounded-xl transition-all cursor-pointer group shadow-sm"
              >
                <div className="flex items-center justify-between text-text-muted mb-2">
                  <span className="text-xs font-medium">Görsel Galerisi</span>
                  <ImageIcon className="w-4 h-4 text-fuchsia-400 group-hover:scale-110 transition-transform" />
                </div>
                <div className="text-2xl font-bold font-mono text-fuchsia-400">{mediaList.length} <span className="text-sm font-normal text-text-muted">görsel</span></div>
                <div className="text-[11px] text-text-muted mt-1">Ekran görüntüleri & konseptler</div>
              </div>
            </div>

            {/* İki Kolonlu Önizleme Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Widget 1: Son Eklenen Loglar */}
              <div className="bg-surface border border-border rounded-xl p-5 shadow-md flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-border/60 mb-4">
                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" />
                      Son Eklenen Loglar
                    </h3>
                    <span className="text-[11px] text-text-muted">{logs.length} toplam</span>
                  </div>

                  {logs.length === 0 ? (
                    <div className="py-8 text-center text-xs text-text-muted">
                      Henüz log eklenmedi.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {logs.slice(0, 3).map((l) => (
                        <div key={l.id} className="p-3 bg-background border border-border rounded-lg text-xs flex flex-col gap-1.5">
                          <div className="flex justify-between items-center text-text-muted text-[10px]">
                            <span>{new Date(l.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</span>
                            <div className="flex gap-2">
                              <span>⏱️ {l.hoursWorked}s</span>
                              <span className="font-mono text-primary font-semibold">{l.version}</span>
                            </div>
                          </div>
                          <p className="text-slate-200 line-clamp-2 leading-relaxed">{l.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setActiveTab('logs')}
                  className="mt-4 pt-3 border-t border-border/50 text-xs text-primary hover:text-blue-400 font-medium flex items-center justify-center gap-1.5 transition-colors"
                >
                  Tüm Logları Gör ve Yeni Ekle <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Widget 2: Yapılacaklar & Hata Özeti */}
              <div className="bg-surface border border-border rounded-xl p-5 shadow-md flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-border/60 mb-4">
                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400" />
                      Bekleyen Görevler & Hatalar
                    </h3>
                    <span className="text-[11px] text-text-muted">{pendingTodos.length + openBugs.length} aktif</span>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {pendingTodos.length === 0 && openBugs.length === 0 ? (
                      <div className="py-8 text-center text-xs text-text-muted">
                        Açık görev veya hata bulunmuyor. 🎉
                      </div>
                    ) : (
                      <>
                        {pendingTodos.slice(0, 2).map((t) => (
                          <div 
                            key={t.id} 
                            onClick={() => toggleTaskStatus(t)}
                            className="p-2.5 bg-background border border-border hover:border-primary/40 rounded-lg text-xs flex items-center justify-between gap-3 cursor-pointer"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <Circle className="w-3.5 h-3.5 text-text-muted shrink-0" />
                              <span className="truncate text-white">{t.title}</span>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-medium shrink-0">
                              {t.priority === 'high' ? '🔥 Yüksek' : t.priority === 'medium' ? '⚡ Orta' : '🌱 Düşük'}
                            </span>
                          </div>
                        ))}

                        {openBugs.slice(0, 2).map((b) => (
                          <div 
                            key={b.id} 
                            onClick={() => toggleTaskStatus(b)}
                            className="p-2.5 bg-background border border-red-500/30 hover:border-red-500/60 rounded-lg text-xs flex items-center justify-between gap-3 cursor-pointer"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                              <span className="truncate text-white">{b.title}</span>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-medium shrink-0">
                              🚨 {b.priority === 'high' ? 'Kritik' : 'Orta'}
                            </span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border/50 flex justify-between text-xs font-medium">
                  <button
                    onClick={() => setActiveTab('todos')}
                    className="text-primary hover:text-blue-400 flex items-center gap-1 transition-colors"
                  >
                    Yapılacakları Aç ({pendingTodos.length}) <ArrowRight className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setActiveTab('bugs')}
                    className="text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
                  >
                    Hata Takibini Aç ({openBugs.length}) <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Widget 3: Son Eklenen Görsel */}
              <div className="bg-surface border border-border rounded-xl p-5 shadow-md flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-border/60 mb-4">
                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-fuchsia-400" />
                      Son Ekran Görüntüsü
                    </h3>
                    <span className="text-[11px] text-text-muted">{mediaList.length} görsel</span>
                  </div>

                  {mediaList.length === 0 ? (
                    <div className="py-6 text-center text-xs text-text-muted flex flex-col items-center gap-2">
                      <p>Henüz görsel eklenmemiş.</p>
                      <button
                        onClick={() => setActiveTab('media')}
                        className="px-3 py-1.5 rounded-lg bg-fuchsia-600/20 text-fuchsia-400 text-xs font-medium hover:bg-fuchsia-600/30 transition-colors"
                      >
                        İlk Görseli Yükle
                      </button>
                    </div>
                  ) : (
                    <div 
                      onClick={() => setSelectedPreviewImage(mediaList[0])}
                      className="group relative aspect-video rounded-lg overflow-hidden bg-black cursor-pointer border border-border"
                    >
                      <img 
                        src={mediaList[0].imageUrl} 
                        alt={mediaList[0].title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                      />
                      <div className="absolute top-2 right-2 bg-black/80 px-2 py-0.5 rounded text-[10px] font-mono text-fuchsia-300">
                        {mediaList[0].version}
                      </div>
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-6">
                        <p className="text-xs font-bold text-white truncate">{mediaList[0].title}</p>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setActiveTab('media')}
                  className="mt-4 pt-3 border-t border-border/50 text-xs text-fuchsia-400 hover:text-fuchsia-300 font-medium flex items-center justify-center gap-1.5 transition-colors"
                >
                  Görsel Galerisini Aç ({mediaList.length}) <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Widget 4: Gemini AI Hızlı Özet */}
              <div className="bg-surface border border-border rounded-xl p-5 shadow-md flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-border/60 mb-4">
                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      Gemini Asistanı
                    </h3>
                    <span className="text-[11px] text-amber-400 font-mono">AI Active</span>
                  </div>

                  <p className="text-xs text-text-muted leading-relaxed mb-4">
                    Girdiğin geliştirici loglarını analiz edip tek tıkla motive edici özetler ve Discord/Instagram için hazır paylaşım metinleri üretir.
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => { setActiveTab('ai'); handleAI('summary-24h'); }}
                      className="p-2.5 bg-background border border-border hover:border-primary text-left rounded-lg text-xs transition-colors"
                    >
                      <div className="font-semibold text-white">📝 24 Saati Özetle</div>
                      <div className="text-[10px] text-text-muted mt-0.5">Hızlı özet üret</div>
                    </button>
                    <button
                      onClick={() => { setActiveTab('ai'); handleAI('social-discord'); }}
                      className="p-2.5 bg-[#5865F2]/10 border border-[#5865F2]/20 hover:border-[#5865F2] text-left rounded-lg text-xs transition-colors"
                    >
                      <div className="font-semibold text-[#5865F2]">📢 Discord Duyurusu</div>
                      <div className="text-[10px] text-text-muted mt-0.5">Paylaşım metni</div>
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('ai')}
                  className="mt-4 pt-3 border-t border-border/50 text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center justify-center gap-1.5 transition-colors"
                >
                  Tüm Yapay Zeka Özelliklerini Aç <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 1: LOGLAR */}
        {/* ======================================================== */}
        {activeTab === 'logs' && (
          <div className="max-w-4xl mx-auto flex flex-col gap-6">
            
            {/* New Log Box */}
            <div className="bg-surface border border-border rounded-xl p-5 shadow-lg">
              <h3 className="text-base font-bold mb-3 flex items-center gap-2 text-white">
                <FileText className="w-4 h-4 text-primary" />
                Günün Geliştirici Logunu Ekle
              </h3>
              <form onSubmit={handleAddLog} className="flex flex-col gap-3">
                <textarea
                  value={newLogContent}
                  onChange={(e) => setNewLogContent(e.target.value)}
                  placeholder="Bugün oyuna hangi mekanikleri ekledin, hangi kodları yazdın veya neleri optimize ettin?"
                  className="w-full h-24 px-4 py-3 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary resize-none transition-colors text-white"
                  required
                />
                <div className="flex flex-wrap gap-3">
                  <div className="flex-1 min-w-[140px]">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={newLogHours}
                      onChange={(e) => setNewLogHours(e.target.value)}
                      placeholder="Çalışılan saat (Örn: 3.5)"
                      className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary transition-colors text-white"
                      required
                    />
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <input
                      type="text"
                      value={newLogVersion}
                      onChange={(e) => setNewLogVersion(e.target.value)}
                      placeholder="Versiyon (Örn: v0.1.0)"
                      className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm font-mono focus:outline-none focus:border-primary transition-colors text-white"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isAddingLog || !newLogContent}
                    className="px-6 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-50 flex items-center gap-2"
                  >
                    {isAddingLog ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Logu Kaydet
                  </button>
                </div>
              </form>
            </div>

            {/* Log Timeline */}
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-text-muted px-1">Geçmiş Geliştirme Notları</h3>
              {logs.length === 0 ? (
                <div className="p-8 text-center bg-surface/50 border border-dashed border-border rounded-xl text-text-muted text-sm">
                  Henüz kaydedilmiş log bulunmuyor. İlk çalışmanı yukarıdan kaydedebilirsin!
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="bg-surface border border-border p-5 rounded-xl flex flex-col gap-3 group relative">
                    <div className="flex justify-between items-start">
                      <div className="text-xs text-text-muted">
                        {new Date(log.date).toLocaleDateString('tr-TR', { 
                          day: 'numeric', 
                          month: 'long', 
                          year: 'numeric', 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2.5 py-1 bg-white/5 rounded-md flex items-center gap-1.5 text-text-muted font-mono">
                          <Clock className="w-3 h-3 text-primary" /> {log.hoursWorked} saat
                        </span>
                        <span className="text-xs px-2.5 py-1 bg-primary/10 text-primary rounded-md font-mono font-medium">
                          {log.version}
                        </span>
                        <button
                          onClick={() => log.id && handleDeleteLog(log.id)}
                          className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 p-1 transition-opacity"
                          title="Logu Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed text-slate-200">{log.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: YAPILACAKLAR (TODOS) */}
        {/* ======================================================== */}
        {activeTab === 'todos' && (
          <div className="max-w-4xl mx-auto flex flex-col gap-6">
            
            {/* New Todo Box */}
            <div className="bg-surface border border-border rounded-xl p-5 shadow-lg">
              <h3 className="text-base font-bold mb-3 flex items-center gap-2 text-white">
                <ListTodo className="w-4 h-4 text-primary" />
                Yeni Görev Ekle
              </h3>
              <form onSubmit={handleAddTodo} className="flex gap-3">
                <input
                  type="text"
                  value={newTodoTitle}
                  onChange={(e) => setNewTodoTitle(e.target.value)}
                  placeholder="Yapılacak görevi yaz (Örn: Envanter arayüzünü tasarla)..."
                  className="flex-1 px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary transition-colors text-white"
                  required
                />
                <select
                  value={newTodoPriority}
                  onChange={(e) => setNewTodoPriority(e.target.value as any)}
                  className="px-3 py-2 bg-background border border-border rounded-lg text-xs text-text-muted focus:outline-none focus:border-primary"
                >
                  <option value="low">🌱 Düşük Öncelik</option>
                  <option value="medium">⚡ Orta Öncelik</option>
                  <option value="high">🔥 Yüksek Öncelik</option>
                </select>
                <button
                  type="submit"
                  disabled={isAddingTodo || !newTodoTitle}
                  className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isAddingTodo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Görev Ekle
                </button>
              </form>
            </div>

            {/* Todo List */}
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-text-muted px-1">Görev Listesi</h3>
              {todoList.length === 0 ? (
                <div className="p-8 text-center bg-surface/50 border border-dashed border-border rounded-xl text-text-muted text-sm">
                  Tebrikler! Bekleyen görev yok.
                </div>
              ) : (
                todoList.map((todo) => {
                  const isDone = todo.status === 'completed';
                  return (
                    <div
                      key={todo.id}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                        isDone 
                          ? 'bg-background/40 border-transparent opacity-60' 
                          : 'bg-surface border-border hover:border-primary/40'
                      }`}
                    >
                      <div 
                        onClick={() => toggleTaskStatus(todo)}
                        className="flex items-center gap-3 cursor-pointer flex-1"
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        ) : (
                          <Circle className="w-5 h-5 text-text-muted hover:text-primary shrink-0 transition-colors" />
                        )}
                        <span className={`text-sm ${isDone ? 'line-through text-text-muted' : 'text-white'}`}>
                          {todo.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={(e) => handleCyclePriority(todo, e)}
                          title="Önceliği değiştirmek için tıkla (Düşük / Orta / Yüksek)"
                          className={`text-[10px] px-2.5 py-1 rounded font-medium transition-all active:scale-95 cursor-pointer hover:brightness-125 select-none ${
                            todo.priority === 'high' 
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                              : todo.priority === 'medium'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                          }`}
                        >
                          {todo.priority === 'high' ? '🔥 Yüksek' : todo.priority === 'medium' ? '⚡ Orta' : '🌱 Düşük'}
                        </button>
                        <button
                          onClick={() => handleDeleteTask(todo.id)}
                          className="text-text-muted hover:text-red-400 p-1 transition-colors"
                          title="Görevi Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: HATALAR & BUGS */}
        {/* ======================================================== */}
        {activeTab === 'bugs' && (
          <div className="max-w-4xl mx-auto flex flex-col gap-6">
            
            {/* New Bug Box */}
            <div className="bg-surface border border-red-500/20 rounded-xl p-5 shadow-lg">
              <h3 className="text-base font-bold mb-3 flex items-center gap-2 text-red-400">
                <Bug className="w-4 h-4" />
                Hata / Bug Kaydı Aç
              </h3>
              <form onSubmit={handleAddBug} className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newBugTitle}
                    onChange={(e) => setNewBugTitle(e.target.value)}
                    placeholder="Hata Başlığı (Örn: Karakter duvardan geçiyor)"
                    className="flex-1 px-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-red-500 transition-colors text-white"
                    required
                  />
                  <input
                    type="text"
                    value={newBugVersion}
                    onChange={(e) => setNewBugVersion(e.target.value)}
                    placeholder="Bulunan Versiyon"
                    className="w-36 px-3 py-2 bg-background border border-border rounded-lg text-xs font-mono text-white focus:outline-none focus:border-red-500"
                  />
                  <select
                    value={newBugPriority}
                    onChange={(e) => setNewBugPriority(e.target.value as any)}
                    className="px-3 py-2 bg-background border border-border rounded-lg text-xs text-text-muted focus:outline-none focus:border-red-500"
                  >
                    <option value="high">🚨 Kritik Hata</option>
                    <option value="medium">⚠️ Orta Düzey</option>
                    <option value="low">💡 Önemsiz</option>
                  </select>
                </div>
                <div className="flex gap-3">
                  <textarea
                    value={newBugDesc}
                    onChange={(e) => setNewBugDesc(e.target.value)}
                    placeholder="Hatanın detayları, nasıl ortaya çıktığı veya konsol logları (İsteğe bağlı)..."
                    className="flex-1 h-16 px-4 py-2 bg-background border border-border rounded-lg text-xs focus:outline-none focus:border-red-500 resize-none transition-colors text-white"
                  />
                  <button
                    type="submit"
                    disabled={isAddingBug || !newBugTitle}
                    className="px-5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isAddingBug ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Hatayı Kaydet
                  </button>
                </div>
              </form>
            </div>

            {/* Bugs List */}
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-text-muted px-1">Mevcut Hatalar</h3>
              {bugList.length === 0 ? (
                <div className="p-8 text-center bg-surface/50 border border-dashed border-border rounded-xl text-text-muted text-sm">
                  Harika! Kayıtlı açık hata bulunmuyor. 🚀
                </div>
              ) : (
                bugList.map((bug) => {
                  const isResolved = bug.status === 'completed';
                  return (
                    <div
                      key={bug.id}
                      className={`p-4 rounded-xl border flex flex-col gap-2 transition-all ${
                        isResolved
                          ? 'bg-background/40 border-transparent opacity-60'
                          : 'bg-surface border-red-500/30 hover:border-red-500/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div 
                          onClick={() => toggleTaskStatus(bug)}
                          className="flex items-center gap-3 cursor-pointer flex-1"
                        >
                          {isResolved ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                          )}
                          <span className={`text-sm font-semibold ${isResolved ? 'line-through text-text-muted' : 'text-white'}`}>
                            {bug.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {bug.version && (
                            <span className="text-[11px] px-2 py-0.5 rounded font-mono bg-white/5 border border-border text-text-muted">
                              {bug.version}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => handleCyclePriority(bug, e)}
                            title="Önceliği değiştirmek için tıkla (Kritik / Orta / Düşük)"
                            className={`text-[10px] px-2.5 py-1 rounded font-medium transition-all active:scale-95 cursor-pointer hover:brightness-125 select-none ${
                              bug.priority === 'high' 
                                ? 'bg-red-500/20 text-red-300 border border-red-500/30' 
                                : bug.priority === 'medium'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                            }`}
                          >
                            {bug.priority === 'high' ? '🚨 Kritik' : bug.priority === 'medium' ? '⚠️ Orta' : '💡 Önemsiz'}
                          </button>
                          <button
                            onClick={() => handleDeleteTask(bug.id)}
                            className="text-text-muted hover:text-red-400 p-1 transition-colors"
                            title="Hatayı Sil"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {bug.description && (
                        <p className="text-xs text-text-muted pl-8 leading-relaxed whitespace-pre-wrap">
                          {bug.description}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: GÖRSEL GALERİSİ (MEDIA & VERSIONS) */}
        {/* ======================================================== */}
        {activeTab === 'media' && (
          <div className="max-w-5xl mx-auto flex flex-col gap-6">
            
            {/* New Media Upload Box */}
            <div className="bg-surface border border-fuchsia-500/20 rounded-xl p-5 shadow-lg">
              <h3 className="text-base font-bold mb-3 flex items-center gap-2 text-fuchsia-400">
                <ImageIcon className="w-4 h-4" />
                Projeye Ekran Görüntüsü / Görsel Ekle
              </h3>
              <form onSubmit={handleAddMedia} className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={mediaTitle}
                    onChange={(e) => setMediaTitle(e.target.value)}
                    placeholder="Görsel Başlığı (Örn: Yeni Envanter Menüsü)"
                    className="px-4 py-2 bg-background border border-border rounded-lg text-sm text-white focus:outline-none focus:border-fuchsia-500"
                    required
                  />
                  <input
                    type="text"
                    value={mediaDesc}
                    onChange={(e) => setMediaDesc(e.target.value)}
                    placeholder="Açıklama (Ne eklendi/değişti?)"
                    className="px-4 py-2 bg-background border border-border rounded-lg text-sm text-white focus:outline-none focus:border-fuchsia-500"
                  />
                  <input
                    type="text"
                    value={mediaVersion}
                    onChange={(e) => setMediaVersion(e.target.value)}
                    placeholder="Versiyon (Örn: v0.2.0)"
                    className="px-4 py-2 bg-background border border-border rounded-lg text-sm font-mono text-white focus:outline-none focus:border-fuchsia-500"
                    required
                  />
                </div>

                <div className="flex flex-col md:flex-row gap-3 items-center">
                  <div className="flex-1 w-full">
                    <input
                      type="text"
                      value={mediaUrl}
                      onChange={(e) => setMediaUrl(e.target.value)}
                      placeholder="Görsel Linki (URL) veya bilgisayarından dosya seç..."
                      className="w-full px-4 py-2 bg-background border border-border rounded-lg text-sm text-white focus:outline-none focus:border-fuchsia-500"
                    />
                  </div>

                  <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-lg text-sm font-medium transition-colors shrink-0">
                    <Upload className="w-4 h-4" />
                    Bilgisayardan Dosya Seç
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileUpload}
                      className="hidden"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={isAddingMedia || !mediaUrl}
                    className="px-6 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-lg text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-50 flex items-center gap-2 shrink-0"
                  >
                    {isAddingMedia ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Galeriye Kaydet
                  </button>
                </div>

                {mediaUrl && (
                  <div className="mt-2 w-32 h-20 rounded-lg overflow-hidden border border-border bg-black">
                    <img src={mediaUrl} alt="Önizleme" className="w-full h-full object-cover" />
                  </div>
                )}
              </form>
            </div>

            {/* Gallery Grid */}
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-text-muted px-1">Proje Görselleri & Versiyon Geçmişi</h3>
              {mediaList.length === 0 ? (
                <div className="p-12 text-center bg-surface/50 border border-dashed border-border rounded-xl text-text-muted text-sm flex flex-col items-center justify-center gap-2">
                  <ImageIcon className="w-8 h-8 text-text-muted/60" />
                  <p>Henüz ekran görüntüsü eklenmemiş. Oyununun gelişimini görselleştirmek için yukarıdan ekleyebilirsin!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {mediaList.map((media) => (
                    <div 
                      key={media.id} 
                      className="bg-surface border border-border rounded-xl overflow-hidden group hover:border-fuchsia-500/50 transition-all shadow-md flex flex-col"
                    >
                      {/* Image Thumbnail */}
                      <div className="relative aspect-video bg-black overflow-hidden cursor-pointer" onClick={() => setSelectedPreviewImage(media)}>
                        <img 
                          src={media.imageUrl} 
                          alt={media.title} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] font-mono text-fuchsia-300 border border-white/10">
                          {media.version}
                        </div>
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <Maximize2 className="w-6 h-6" />
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          <h4 className="font-bold text-sm text-white mb-1">{media.title}</h4>
                          {media.description && (
                            <p className="text-xs text-text-muted leading-relaxed line-clamp-2">{media.description}</p>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-3 mt-3 border-t border-border/50 text-[11px] text-text-muted">
                          <span>{new Date(media.createdAt).toLocaleDateString('tr-TR')}</span>
                          <button
                            onClick={() => handleDeleteMedia(media.id)}
                            className="text-text-muted hover:text-red-400 p-1 transition-colors"
                            title="Görseli Sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 5: GEMINI YAPAY ZEKA */}
        {/* ======================================================== */}
        {activeTab === 'ai' && (
          <div className="max-w-4xl mx-auto flex flex-col gap-6">
            <div className="bg-surface border border-border rounded-xl p-6 shadow-xl flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Gemini Geliştirici & Sosyal Medya Asistanı</h3>
                  <p className="text-xs text-text-muted">Girdiğin logları analiz ederek anında özetler ve sosyal medya metinleri üretir.</p>
                </div>
              </div>

              {/* Action Buttons Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <button 
                  onClick={() => handleAI('summary-24h')}
                  disabled={isAiLoading}
                  className="p-3 bg-background border border-border hover:border-primary text-left rounded-xl transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  <div className="text-base mb-1">📝</div>
                  <div className="text-xs font-bold text-white">Son 24 Saati Özetle</div>
                  <div className="text-[10px] text-text-muted mt-0.5">Bugünkü gelişimin özeti</div>
                </button>

                <button 
                  onClick={() => handleAI('summary-all')}
                  disabled={isAiLoading}
                  className="p-3 bg-background border border-border hover:border-primary text-left rounded-xl transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  <div className="text-base mb-1">📚</div>
                  <div className="text-xs font-bold text-white">Tüm Projeyi Özetle</div>
                  <div className="text-[10px] text-text-muted mt-0.5">Başlangıçtan bu yana durum</div>
                </button>

                <button 
                  onClick={() => handleAI('social-discord')}
                  disabled={isAiLoading}
                  className="p-3 bg-[#5865F2]/10 border border-[#5865F2]/20 hover:border-[#5865F2] text-left rounded-xl transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  <div className="text-base mb-1 text-[#5865F2]"><MessageSquare className="w-5 h-5" /></div>
                  <div className="text-xs font-bold text-white">Discord Duyurusu</div>
                  <div className="text-[10px] text-text-muted mt-0.5">Oyuncular için güncelleme notu</div>
                </button>

                <button 
                  onClick={() => handleAI('social-instagram')}
                  disabled={isAiLoading}
                  className="p-3 bg-[#E1306C]/10 border border-[#E1306C]/20 hover:border-[#E1306C] text-left rounded-xl transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  <div className="text-base mb-1 text-[#E1306C]"><Hash className="w-5 h-5" /></div>
                  <div className="text-xs font-bold text-white">Instagram Gönderisi</div>
                  <div className="text-[10px] text-text-muted mt-0.5">Emoji & hashtag'li post</div>
                </button>
              </div>

              {/* AI Output Box */}
              {(isAiLoading || aiResult) && (
                <div className="p-5 bg-background border border-border rounded-xl flex flex-col gap-3 relative">
                  <div className="flex justify-between items-center border-b border-border/50 pb-2">
                    <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Gemini Yanıtı
                    </span>
                    {aiResult && !isAiLoading && (
                      <button
                        onClick={handleCopyAi}
                        className="flex items-center gap-1.5 text-xs text-text-muted hover:text-white px-2.5 py-1 rounded bg-white/5 transition-colors"
                      >
                        {copiedAi ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedAi ? 'Kopyalandı' : 'Metni Kopyala'}
                      </button>
                    )}
                  </div>

                  {isAiLoading ? (
                    <div className="py-8 flex flex-col items-center justify-center gap-3 text-text-muted">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <span className="text-xs">Gemini loglarını analiz ediyor ve metni oluşturuyor...</span>
                    </div>
                  ) : (
                    <div className="text-sm whitespace-pre-wrap leading-relaxed text-slate-200 select-text">
                      {aiResult}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Lightbox Image Preview Modal */}
      {selectedPreviewImage && (
        <div 
          onClick={() => setSelectedPreviewImage(null)}
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-6 cursor-zoom-out"
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelectedPreviewImage(null)}
              className="absolute -top-10 right-0 text-white/70 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
            <img 
              src={selectedPreviewImage.imageUrl} 
              alt={selectedPreviewImage.title}
              className="max-w-full max-h-[80vh] rounded-lg shadow-2xl object-contain border border-white/10"
            />
            <div className="mt-3 text-center">
              <h4 className="text-base font-bold text-white flex items-center justify-center gap-2">
                {selectedPreviewImage.title}
                <span className="text-xs px-2 py-0.5 bg-fuchsia-500/20 text-fuchsia-300 rounded font-mono">
                  {selectedPreviewImage.version}
                </span>
              </h4>
              {selectedPreviewImage.description && (
                <p className="text-xs text-text-muted mt-1">{selectedPreviewImage.description}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      <EditProjectModal
        isOpen={isEditModalOpen}
        project={project}
        onClose={() => setIsEditModalOpen(false)}
        onUpdated={(updated) => {
          setProject(updated);
          onProjectUpdated(updated);
        }}
        onDeleted={(deletedId) => {
          onProjectDeleted(deletedId);
          onBack();
        }}
      />

    </div>
  );
}
