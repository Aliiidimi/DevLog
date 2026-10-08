import { useState } from 'react';
import { X, Gamepad2, Box, Cpu, Monitor, Smartphone, Palette, Loader2 } from 'lucide-react';
import { addProject } from '../lib/projects';
import { useAuth } from '../contexts/AuthContext';
import type { Project } from '../types';

const COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#0ea5e9', // Sky Blue
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#d946ef', // Fuchsia
  '#f43f5e', // Rose
];

const ICONS = [
  { id: 'gamepad', icon: Gamepad2 },
  { id: 'box', icon: Box },
  { id: 'cpu', icon: Cpu },
  { id: 'monitor', icon: Monitor },
  { id: 'smartphone', icon: Smartphone },
  { id: 'palette', icon: Palette },
];

export default function NewProjectModal({ 
  isOpen, 
  onClose,
  onSuccess
}: { 
  isOpen: boolean; 
  onClose: () => void;
  onSuccess: (p: Project) => void;
}) {
  const { currentUser } = useAuth();
  const [name, setName] = useState('');
  const [engine, setEngine] = useState('');
  const [type, setType] = useState('');
  const [color, setColor] = useState(COLORS[5]);
  const [icon, setIcon] = useState(ICONS[0].id);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    setLoading(true);
    try {
      const newProject = await addProject(currentUser.uid, {
        name,
        engine: engine || 'Belirtilmedi',
        type: type || 'Belirtilmedi',
        color,
        icon
      });
      onSuccess(newProject);
      setName('');
      setEngine('');
      setType('');
      onClose();
    } catch (err) {
      console.error(err);
      alert('Proje oluşturulurken bir hata oluştu. Lütfen Firebase veritabanı kurallarınızı (Rules) kontrol edin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        
        <div className="flex justify-between items-center p-6 border-b border-border">
          <h3 className="text-xl font-bold">Yeni Proje Oluştur</h3>
          <button onClick={onClose} className="text-text-muted hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <form id="project-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
            
            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">Proje Adı</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:border-primary transition-colors"
                placeholder="Örn: Super Space Shooter"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">Oyun Motoru / Dil</label>
                <input
                  type="text"
                  value={engine}
                  onChange={(e) => setEngine(e.target.value)}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:border-primary transition-colors"
                  placeholder="Örn: Unity, Godot"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">Platform / Tür</label>
                <input
                  type="text"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:border-primary transition-colors"
                  placeholder="Örn: 2D Mobile"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-muted mb-3">Proje Rengi</label>
              <div className="flex gap-3 flex-wrap">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-white/50' : 'hover:scale-110'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-muted mb-3">Proje İkonu</label>
              <div className="flex gap-3 flex-wrap">
                {ICONS.map((i) => {
                  const IconComp = i.icon;
                  const isSelected = icon === i.id;
                  return (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => setIcon(i.id)}
                      className={`p-3 rounded-xl transition-all ${isSelected ? 'bg-primary/20 text-primary border border-primary/50' : 'bg-background border border-border text-text-muted hover:text-white hover:border-text-muted'}`}
                    >
                      <IconComp className="w-6 h-6" />
                    </button>
                  )
                })}
              </div>
            </div>

          </form>
        </div>

        <div className="p-6 border-t border-border flex justify-end gap-3">
          <button 
            type="button" 
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg text-text-muted font-medium hover:bg-white/5 transition-colors"
          >
            İptal
          </button>
          <button 
            form="project-form"
            type="submit"
            disabled={loading || !name}
            className="flex items-center justify-center min-w-[140px] px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Projeyi Oluştur'
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
