import { useState, useEffect } from 'react';
import { Terminal, PlusCircle, LayoutDashboard, Settings, LogOut } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import NewProjectModal from './components/NewProjectModal';
import ProjectDetail from './components/ProjectDetail';
import SettingsView from './components/SettingsView';
import { getUserProjects } from './lib/projects';
import type { Project } from './types';

function App() {
  const { currentUser, logout } = useAuth();
  const [currentView, setCurrentView] = useState<'projects' | 'settings'>('projects');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      loadProjects();
    }
  }, [currentUser]);

  const loadProjects = async () => {
    if (!currentUser) return;
    // SWR: Local cache loads instantly (0ms), then Firestore syncs quietly in background
    const cached = await getUserProjects(currentUser.uid, (syncedProjects) => {
      setProjects(syncedProjects);
    });
    setProjects(cached);
    setLoading(false);
  };

  const handleProjectUpdated = (updated: Project) => {
    setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
    if (selectedProject?.id === updated.id) {
      setSelectedProject(updated);
    }
  };

  const handleProjectDeleted = (deletedId: string) => {
    setProjects(prev => prev.filter(p => p.id !== deletedId));
    if (selectedProject?.id === deletedId) {
      setSelectedProject(null);
    }
  };

  if (!currentUser) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen flex text-text bg-background overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-surface border-r border-border p-4 flex flex-col gap-4 shrink-0">
        <div className="flex items-center gap-3 px-2 py-4 mb-4 cursor-pointer" onClick={() => { setCurrentView('projects'); setSelectedProject(null); }}>
          <Terminal className="w-8 h-8 text-primary" />
          <h1 className="text-xl font-bold tracking-tight">DevLog</h1>
        </div>
        
        <nav className="flex flex-col gap-2 flex-1">
          <button 
            onClick={() => { setCurrentView('projects'); setSelectedProject(null); }}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all active:scale-[0.98] ${
              currentView === 'projects' && !selectedProject
                ? 'bg-primary/10 text-primary font-medium' 
                : 'text-text-muted hover:bg-white/5 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="font-medium">Projelerim</span>
          </button>

          <button 
            onClick={() => { setCurrentView('settings'); setSelectedProject(null); }}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all active:scale-[0.98] ${
              currentView === 'settings' 
                ? 'bg-primary/10 text-primary font-medium' 
                : 'text-text-muted hover:bg-white/5 hover:text-white'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="font-medium">Ayarlar</span>
          </button>
        </nav>
        
        <div className="flex flex-col gap-2">
          <div className="text-xs text-text-muted px-2 py-1 mb-2 truncate">
            {currentUser.email}
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition-all active:scale-[0.96] shadow-lg">
            <PlusCircle className="w-5 h-5" />
            Yeni Proje
          </button>
          <button 
            onClick={() => logout()}
            className="flex items-center justify-center gap-2 px-4 py-3 border border-border hover:bg-white/5 text-text-muted rounded-lg font-medium transition-all active:scale-[0.96]">
            <LogOut className="w-4 h-4" />
            Çıkış Yap
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {currentView === 'settings' ? (
        <SettingsView onBack={() => setCurrentView('projects')} />
      ) : selectedProject ? (
        <ProjectDetail 
          project={selectedProject} 
          onBack={() => {
            setSelectedProject(null);
            loadProjects();
          }} 
          onProjectUpdated={handleProjectUpdated}
          onProjectDeleted={handleProjectDeleted}
        />
      ) : (
        <Dashboard 
          projects={projects} 
          loading={loading} 
          onProjectSelect={setSelectedProject}
        />
      )}

      {/* Modals */}
      <NewProjectModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={(newProject) => setProjects([newProject, ...projects])}
      />
    </div>
  );
}

export default App;
