import { Gamepad2, Box, Cpu, Monitor, Smartphone, Palette, Terminal, Loader2 } from 'lucide-react';
import type { Project } from '../types';

const ICON_MAP: Record<string, any> = {
  gamepad: Gamepad2,
  box: Box,
  cpu: Cpu,
  monitor: Monitor,
  smartphone: Smartphone,
  palette: Palette,
};

export default function Dashboard({ 
  projects, 
  loading,
  onProjectSelect
}: { 
  projects: Project[];
  loading: boolean;
  onProjectSelect: (p: Project) => void;
}) {
  
  if (loading) {
    return (
      <div className="flex-1 p-8 flex flex-col items-center justify-center text-text-muted gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm font-medium">Projeler yükleniyor...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold mb-2">Projelerim</h2>
          <p className="text-text-muted">Geliştirdiğin tüm projeler burada listeleniyor.</p>
        </div>
      </header>

      {projects.length === 0 ? (
        <div className="bg-surface border border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center text-center">
          <Terminal className="w-12 h-12 text-text-muted mb-4" />
          <h3 className="text-lg font-bold mb-2">Henüz Proje Yok</h3>
          <p className="text-text-muted max-w-sm">Sol menüdeki "Yeni Proje" butonuna tıklayarak ilk oyun/yazılım projeni ekleyebilirsin.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((p) => {
            const IconComp = ICON_MAP[p.icon] || Terminal;
            
            return (
              <div 
                key={p.id}
                onClick={() => onProjectSelect(p)}
                className="bg-surface border border-border rounded-xl p-6 transition-all hover:-translate-y-1 hover:shadow-lg cursor-pointer group"
                style={{ '--hover-color': p.color } as React.CSSProperties}
              >
                <div className="flex items-center gap-4 mb-4">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center transition-colors"
                    style={{ backgroundColor: `${p.color}20`, color: p.color }}
                  >
                    <IconComp className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold group-hover:text-[var(--hover-color)] transition-colors">{p.name}</h3>
                    <p className="text-xs text-text-muted">{p.engine} • {p.type}</p>
                  </div>
                </div>
                
                <div className="flex justify-between items-center text-xs text-text-muted pt-4 border-t border-border/50">
                  <span>Güncelleme: {new Date(p.updatedAt).toLocaleDateString()}</span>
                  <span className="px-2 py-1 bg-background rounded-md border border-border font-mono">{p.version}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
