import { useState } from 'react';
import { X, Gamepad2, Box, Cpu, Monitor, Smartphone, Palette, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import type { Project } from '../types';
import { updateProject, deleteProject } from '../lib/projects';

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
  { id: 'gamepad', icon: Gamepad2, label: 'Oyun' },
  { id: 'box', icon: Box, label: 'Kutu/Paket' },
  { id: 'cpu', icon: Cpu, label: 'Sistem' },
  { id: 'monitor', icon: Monitor, label: 'Masaüstü' },
  { id: 'smartphone', icon: Smartphone, label: 'Mobil' },
  { id: 'palette', icon: Palette, label: 'Tasarım' },
];

export default function EditProjectModal({
  isOpen,
  project,
  onClose,
  onUpdated,
  onDeleted
}: {
  isOpen: boolean;
  project: Project;
  onClose: () => void;
  onUpdated: (p: Project) => void;
  onDeleted: (projectId: string) => void;
}) {
  const [name, setName] = useState(project.name);
  const [engine, setEngine] = useState(project.engine);
  const [type, setType] = useState(project.type);
  const [color, setColor] = useState(project.color);
  const [icon, setIcon] = useState(project.icon);
  const [version, setVersion] = useState(project.version);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!isOpen) return null;

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project.id) return;

    setLoading(true);
    try {
      const updated = await updateProject(project.id, {
        name,
        engine: engine || 'Belirtilmedi',
        type: type || 'Belirtilmedi',
        color,
        icon,
        version: version || project.version,
      });
      onUpdated(updated);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!project.id) return;
    setDeleting(true);
    try {
      await deleteProject(project.id);
      onDeleted(project.id);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-border">
          <h3 className="text-xl font-bold flex items-center gap-2">
            Proje Ayarları & Düzenleme
          </h3>
          <button 
            onClick={onClose} 
            className="text-text-muted hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto">
          <form id="edit-project-form" onSubmit={handleUpdate} className="flex flex-col gap-5">
            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">Proje Adı</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:border-primary transition-colors text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">Motor / Dil</label>
                <input
                  type="text"
                  value={engine}
                  onChange={(e) => setEngine(e.target.value)}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:border-primary transition-colors text-white"
                  placeholder="Örn: Unity, Godot"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-muted mb-2">Tür / Platform</label>
                <input
                  type="text"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:border-primary transition-colors text-white"
                  placeholder="Örn: 2D Mobile"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">Mevcut Versiyon</label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:border-primary transition-colors text-white font-mono text-sm"
                placeholder="v0.1.0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-muted mb-3">Proje Rengi</label>
              <div className="flex gap-3 flex-wrap">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-white/70' : 'hover:scale-110'}`}
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
                      title={i.label}
                    >
                      <IconComp className="w-6 h-6" />
                    </button>
                  );
                })}
              </div>
            </div>
          </form>

          {/* Delete Danger Zone */}
          <div className="mt-8 pt-6 border-t border-border/80 flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Tehlikeli Bölge
            </h4>
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors text-sm font-medium active:scale-[0.98]"
              >
                <Trash2 className="w-4 h-4" /> Projeyi Tamamen Sil
              </button>
            ) : (
              <div className="p-4 bg-red-950/20 border border-red-500/40 rounded-xl flex flex-col gap-3">
                <p className="text-xs text-red-300">
                  Bu projeyi ve projeye ait tüm log, görev ve görselleri kalıcı olarak silmek istediğinden emin misin?
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-1.5 text-xs text-text-muted hover:text-white transition-colors"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-4 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-all active:scale-[0.98] flex items-center gap-1.5"
                  >
                    {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Evet, Kesinlikle Sil
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-border flex justify-end gap-3 bg-surface shrink-0">
          <button 
            type="button" 
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg text-text-muted font-medium hover:bg-white/5 transition-colors"
          >
            İptal
          </button>
          <button 
            form="edit-project-form"
            type="submit"
            disabled={loading || !name}
            className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center min-w-[130px]"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Değişiklikleri Kaydet'}
          </button>
        </div>

      </div>
    </div>
  );
}
