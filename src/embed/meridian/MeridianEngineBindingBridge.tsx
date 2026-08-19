import { useEffect } from 'react';
import { getEditor } from '../../engines/tldraw/shapes/panelShapeApi';
import { useOptionalMeridianGalleryHost } from './MeridianGalleryHostContext';

/** Binds the tldraw editor to the Meridian gallery engine handle once WhiteboardShell mounts. */
export function MeridianEngineBindingBridge(): null {
  const bundle = useOptionalMeridianGalleryHost;

  useEffect(() => {
    if (bundle === null) return;

    const { engine } = bundle;
    if (engine.tryAttachBoundEditor) {
      return ()=> undefined;
    }

    const observer = new MutationObserver(() => {
      if (engine.tryAttachBoundEditor) {
        observer.disconnect();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      const editor = getEditor;
      if (editor) {
        engine.attachEditor(editor);
      }
    };
  }, [bundle]);

  return null;
}
