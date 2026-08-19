import { useCallback, useState, type ReactElement } from 'react';

import { Bell, Bot, Cloud, Grid3X3, Save } from 'lucide-react';

import type { ReactPanelLoaderProps } from '../../../../src/panels/registry';



type SettingsTab = 'sync' | 'notifications' | 'canvas' | 'ai';



interface ToggleRowProps {

  label: string;

  description: string;

  checked: boolean;

  onChange: (next: boolean) => void;

}



function ToggleRow({ label, description, checked, onChange }: ToggleRowProps): ReactElement {

  return (

    <label className="flex items-start justify-between gap-4 py-3 border-b border-canvas-border last:border-0 cursor-pointer">

      <div>

        <p className="text-[13px] font-medium text-canvas">{label}</p>

        <p className="text-[12px] text-canvas-muted mt-0.5">{description}</p>

      </div>

      <button

        type="button"

        role="switch"

        aria-checked={checked}

        onClick={() => onChange(!checked)}

        className={`relative w-10 h-6 rounded-full shrink-0 transition-colors ${

          checked ? 'bg-canvas-primary': 'bg-canvas-border'

        }`}

      >

        <span

          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${

            checked ? 'translate-x-4': ''

          }`}

        />

      </button>

    </label>

  );

}



const TABS: Array<{ id: SettingsTab; label: string; icon: typeof Save }> = [

  { id: 'sync', label: 'Save & Sync', icon: Cloud },

  { id: 'notifications', label: 'Notifications', icon: Bell },

  { id: 'canvas', label: 'Canvas', icon: Grid3X3 },

  { id: 'ai', label: 'AI Features', icon: Bot },

];



export function SettingsPanel(_props: ReactPanelLoaderProps): ReactElement {

  const [tab, setTab] = useState<SettingsTab>('sync');

  const [autoSave, setAutoSave] = useState(true);

  const [cloudSync, setCloudSync] = useState(true);

  const [emailAlerts, setEmailAlerts] = useState(true);

  const [interviewReminders, setInterviewReminders] = useState(true);

  const [snapToGrid, setSnapToGrid] = useState(true);

  const [voiceTools, setVoiceTools] = useState(true);

  const [toolSuggestions, setToolSuggestions] = useState(true);



  const renderBody = useCallback((): ReactElement => {

    switch (tab) {

      case 'sync':

        return (

          <>

            <ToggleRow

              label="Auto-save canvas"

              description="Persist panel layout and drawings locally."

              checked={autoSave}

              onChange={setAutoSave}

            />

            <ToggleRow

              label="Cloud sync"

              description="Sync preferences across devices when signed in."

              checked={cloudSync}

              onChange={setCloudSync}

            />

          </>

        );

      case 'notifications':

        return (

          <>

            <ToggleRow

              label="Application updates"

              description="Email when application status changes."

              checked={emailAlerts}

              onChange={setEmailAlerts}

            />

            <ToggleRow

              label="Interview reminders"

              description="Notify 24h before scheduled interviews."

              checked={interviewReminders}

              onChange={setInterviewReminders}

            />

          </>

        );

      case 'canvas':

        return (

          <ToggleRow

            label="Snap to grid"

            description="Align shapes and panels to the 20px grid."

            checked={snapToGrid}

            onChange={setSnapToGrid}

          />

        );

      case 'ai':

        return (

          <>

            <ToggleRow

              label="Voice conversation"

              description="Enable mic and live agent tool calls."

              checked={voiceTools}

              onChange={setVoiceTools}

            />

            <ToggleRow

              label="Proactive suggestions"

              description="Let Sandy suggest panels and next steps."

              checked={toolSuggestions}

              onChange={setToolSuggestions}

            />

          </>

        );

      default:

        return <></>;

    }

  }, [

    tab,

    autoSave,

    cloudSync,

    emailAlerts,

    interviewReminders,

    snapToGrid,

    voiceTools,

    toolSuggestions,

  ]);



  return (

    <div className="flex flex-col h-full min-h-[380px]" data-testid="settings-panel">

      <div className="shrink-0 px-4 py-3 border-b border-canvas-border flex items-center justify-between">

        <h2 className="text-[15px] font-semibold text-canvas">Settings</h2>

        <button

          type="button"

          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-canvas-primary px-2.5 py-1.5 rounded-lg bg-canvas-primary-tint hover:bg-canvas-primary/15 transition-colors"

        >

          <Save size={14} />

          Save & Sync

        </button>

      </div>

      <div className="flex flex-1 min-h-0">

        <nav

          className="shrink-0 w-[148px] border-r border-canvas-border p-2 space-y-0.5"

          aria-label="Settings sections"

        >

          {TABS.map(({ id, label, icon: Icon }) => (

            <button

              key={id}

              type="button"

              data-testid={`settings-tab-${id}`}

              onClick={() => setTab(id)}

              className={`w-full flex items-center gap-2 px-2.5 py-2 text-[12px] font-medium rounded-lg text-left transition-colors ${

                tab === id

                  ? 'bg-canvas-primary-tint text-canvas-primary': 'text-canvas-muted hover:text-canvas hover:bg-canvas-surface-subtle'

              }`}

            >

              <Icon size={14} className="shrink-0" />

              <span className="leading-tight">{label}</span>

            </button>

          ))}

        </nav>

        <div className="flex-1 overflow-y-auto landi-overlay-scroll px-4 py-2 min-w-0">

          {renderBody}

        </div>

      </div>

    </div>

  );

}


