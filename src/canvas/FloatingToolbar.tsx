import { useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Pencil, Paperclip, Mic, Clock, Camera,
  ChevronDown, Image, Download
} from 'lucide-react';
import { useLayoutStore } from '../stores/layoutStore';

const tools = [
  { id: 'draw', icon: Pencil, label: 'Draw' },
  { id: 'attach', icon: Paperclip, label: 'Attachments' },
  { id: 'voice', icon: Mic, label: 'Voice' },
  { id: 'history', icon: Clock, label: 'History' },
  { id: 'camera', icon: Camera, label: 'Screenshot' },
];

const activities = [
  { id: '1', text: 'Concierge audio call (13 mins)', time: '2m ago', type: 'call' },
  { id: '2', text: 'Resume uploaded', time: '15m ago', type: 'upload' },
  { id: '3', text: 'Resume improved', time: '18m ago', type: 'generate' },
  { id: '4', text: 'Trajectory mapped!', time: '32m ago', type: 'generate' },
  { id: '5', text: '14 jobs matched', time: '1h ago', type: 'match' },
];

export function FloatingToolbar() {
  const [showMenu, setShowMenu] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [showScreenshot, setShowScreenshot] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showPanel } = useLayoutStore();

  const handleToolClick = (toolId: string) => {
    setShowActivity(false);
    setShowScreenshot(false);
    setShowMenu(false);

    switch (toolId) {
      case 'attach':
        fileInputRef.current?.click();
        break;
      case 'voice':
        showPanel('voice');
        break;
      case 'history':
        setShowActivity(true);
        break;
      case 'camera':
        setShowScreenshot(true);
        break;
      case 'draw':
        // Toggle draw mode - placeholder
        console.log('Draw mode toggled');
        break;
      default:
        break;
    }
  };

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[60] pointer-events-auto">
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => { console.log('Files:', Array.from(e.target.files || []).map(f => f.name)); }} />

      <div className="relative">
        <div className="bg-canvas-surface rounded-xl border border-canvas-border shadow-sm flex items-center px-1 py-1 gap-0.5">
          {tools.map((tool) => (
            <div key={tool.id} className="relative">
              <button
                title={tool.label}
                onClick={() => handleToolClick(tool.id)}
                className={`p-2 rounded-lg transition-colors ${
                  tool.id === 'camera'
                    ? 'bg-canvas-primary text-white hover:bg-canvas-primary-hover'
                    : (tool.id === 'history' && showActivity) || (tool.id === 'camera' && showScreenshot)
                    ? 'bg-canvas-primary-tint text-canvas-primary'
                    : 'hover:bg-canvas-surface-subtle text-canvas-faint hover:text-canvas-muted'
                }`}
              >
                <tool.icon size={18} strokeWidth={1.5} />
              </button>

              {/* Activity dropdown */}
              {tool.id === 'history' && showActivity && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="absolute top-full mt-2 right-0 bg-canvas-surface rounded-xl border border-canvas-border shadow-lg py-2 w-64 z-50">
                  <div className="px-3 py-1.5 border-b border-canvas-border mb-1"><span className="text-xs font-semibold text-canvas-muted uppercase tracking-wider">Recent Activity</span></div>
                  {activities.map(a => (
                    <div key={a.id} className="px-3 py-2 hover:bg-canvas-surface-subtle flex items-center gap-2.5">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${a.type === 'call' ? 'bg-blue-400' : a.type === 'upload' ? 'bg-green-400' : a.type === 'generate' ? 'bg-purple-400' : 'bg-amber-400'}`} />
                      <div className="flex-1 min-w-0"><p className="text-xs text-canvas-muted truncate">{a.text}</p></div>
                      <span className="text-[10px] text-canvas-faint shrink-0">{a.time}</span>
                    </div>
                  ))}
                </motion.div>
              )}

              {/* Screenshot dropdown */}
              {tool.id === 'camera' && showScreenshot && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="absolute top-full mt-2 right-0 bg-canvas-surface rounded-xl border border-canvas-border shadow-lg py-2 w-48 z-50">
                  <button className="w-full px-3 py-2 text-left text-sm text-canvas-muted hover:bg-canvas-surface-subtle flex items-center gap-2"><Image size={14} /> Entire canvas</button>
                  <button className="w-full px-3 py-2 text-left text-sm text-canvas-muted hover:bg-canvas-surface-subtle flex items-center gap-2"><Download size={14} /> Current view only</button>
                </motion.div>
              )}
            </div>
          ))}

          <div className="w-px h-5 bg-canvas-border mx-0.5" />

          {/* Dock menu */}
          <div className="relative">
            <button onClick={() => { setShowMenu(!showMenu); setShowActivity(false); setShowScreenshot(false); }} className="p-2 rounded-lg hover:bg-canvas-surface-subtle text-canvas-faint hover:text-canvas-muted transition-colors">
              <ChevronDown size={16} />
            </button>
            <AnimatePresence>
              {showMenu && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute top-full right-0 mt-1 bg-canvas-surface rounded-xl border border-canvas-border shadow-lg py-1 min-w-[140px] z-50">
                  {['top', 'bottom', 'left', 'right'].map(d => <button key={d} onClick={() => setShowMenu(false)} className="w-full text-left px-3 py-2 text-sm text-canvas-muted hover:bg-canvas-surface-subtle">Dock {d}</button>)}
                  <div className="border-t border-canvas-border my-1" />
                  <button onClick={() => setShowMenu(false)} className="w-full text-left px-3 py-2 text-sm text-canvas-muted hover:bg-canvas-surface-subtle">Hide</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
