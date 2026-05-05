import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, Bell, Sparkles, Check } from 'lucide-react';
import { DraggablePanel } from './DraggablePanel';
import { useLayoutStore } from '../stores/layoutStore';

interface SettingField {
  id: string;
  label: string;
  type: 'toggle' | 'radio';
  description?: string;
  defaultValue: boolean | string;
  options?: { label: string; value: string }[];
}

interface SettingsSection {
  id: string;
  title: string;
  icon: typeof Save;
  fields: SettingField[];
}

const settingsConfig: SettingsSection[] = [
  {
    id: 'save', title: 'Save & Sync', icon: Save,
    fields: [
      { id: 'autoSave', label: 'Auto-save', type: 'toggle' as const, defaultValue: true, description: 'Automatically save your progress' },
      { id: 'saveLocation', label: 'Save location', type: 'radio' as const, defaultValue: 'browser', options: [{ label: 'Browser (local)', value: 'browser' }, { label: 'Account (cloud)', value: 'account' }] },
    ],
  },
  {
    id: 'notifications', title: 'Notifications', icon: Bell,
    fields: [
      { id: 'reminders', label: 'Interview reminders', type: 'toggle' as const, defaultValue: true },
      { id: 'matchingJobs', label: 'New matching jobs', type: 'toggle' as const, defaultValue: true },
      { id: 'news', label: 'Company news & updates', type: 'toggle' as const, defaultValue: false },
      { id: 'interviewRequests', label: 'Interview requests', type: 'toggle' as const, defaultValue: true },
    ],
  },
  {
    id: 'canvas', title: 'Canvas', icon: Save,
    fields: [
      { id: 'snapGrid', label: 'Snap to grid', type: 'toggle' as const, defaultValue: true, description: 'Snap panels to grid when organizing' },
    ],
  },
  {
    id: 'ai', title: 'AI Features', icon: Sparkles,
    fields: [
      { id: 'voice', label: 'Voice conversation', type: 'toggle' as const, defaultValue: true },
      { id: 'suggestions', label: 'Smart suggestions', type: 'toggle' as const, defaultValue: true },
    ],
  },
];

export function SettingsPanel() {
  const { panels } = useLayoutStore();
  const [values, setValues] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    settingsConfig.forEach(s => s.fields.forEach(f => initial[f.id] = f.defaultValue));
    return initial;
  });
  const [activeSection, setActiveSection] = useState('save');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const triggerAutoSave = useCallback(() => {
    setSaveStatus('saving');
    setTimeout(() => { setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 2000); }, 500);
  }, []);

  const handleToggle = (fieldId: string) => {
    setValues(prev => ({ ...prev, [fieldId]: !prev[fieldId] }));
    triggerAutoSave();
  };

  const handleRadio = (fieldId: string, value: string) => {
    setValues(prev => ({ ...prev, [fieldId]: value }));
    triggerAutoSave();
  };

  const layout = panels.settings;
  if (!layout?.visible) return null;

  const activeConfig = settingsConfig.find(s => s.id === activeSection);

  return (
    <DraggablePanel id="settings" title="Settings">
      <div className="flex h-full">
        <div className="w-44 border-r border-canvas-border py-2 shrink-0">
          {settingsConfig.map(section => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button key={section.id} onClick={() => setActiveSection(section.id)} className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors text-left ${isActive ? 'text-canvas-primary bg-canvas-primary-tint font-medium' : 'text-canvas-muted hover:bg-canvas-surface-subtle'}`}>
                <Icon size={16} />{section.title}
              </button>
            );
          })}
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {activeConfig && (
            <div>
              <h3 className="text-base font-semibold text-canvas mb-4">{activeConfig.title}</h3>
              <div className="space-y-5">
                {activeConfig.fields.map(field => (
                  <div key={field.id} className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-canvas">{field.label}</label>
                      {'description' in field && field.description && <p className="text-xs text-canvas-faint mt-0.5">{field.description}</p>}
                    </div>
                    {field.type === 'toggle' && (
                      <button onClick={() => handleToggle(field.id)} className={`relative w-11 h-6 rounded-full transition-colors shrink-0 mt-0.5 ${values[field.id] ? 'bg-canvas-primary' : 'bg-canvas-border'}`}>
                        <motion.div className="absolute top-0.5 left-0.5 w-5 h-5 bg-canvas-surface rounded-full shadow-sm" animate={{ x: values[field.id] ? 20 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
                      </button>
                    )}
                    {field.type === 'radio' && field.options && (
                      <div className="flex flex-col gap-2 shrink-0">
                        {field.options.map(opt => (
                          <button key={opt.value} onClick={() => handleRadio(field.id, opt.value)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${values[field.id] === opt.value ? 'border-canvas-primary bg-canvas-primary-tint text-canvas-primary' : 'border-canvas-border text-canvas-muted hover:bg-canvas-surface-subtle'}`}>
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${values[field.id] === opt.value ? 'border-canvas-primary' : 'border-canvas-border'}`}>{values[field.id] === opt.value && <div className="w-2 h-2 rounded-full bg-canvas-primary" />}</div>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="absolute bottom-3 right-4">
          <AnimatePresence mode="wait">
            {saveStatus === 'saving' && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs text-canvas-faint">Saving...</motion.span>}
            {saveStatus === 'saved' && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs text-green-600 flex items-center gap-1"><Check size={12} /> Saved</motion.span>}
          </AnimatePresence>
        </div>
      </div>
    </DraggablePanel>
  );
}
