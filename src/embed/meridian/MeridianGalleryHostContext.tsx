import { createContext, useContext, type ReactElement, type ReactNode } from 'react';
import type { MeridianGalleryHostBundle } from './meridianGalleryHost';

const MeridianGalleryHostContext = createContext<MeridianGalleryHostBundle | null>(null);

export function MeridianGalleryHostProvider(props: {
  bundle: MeridianGalleryHostBundle;
  children: ReactNode;
}): ReactElement {
  return (
    <MeridianGalleryHostContext.Provider value={props.bundle}>
      {props.children}
    </MeridianGalleryHostContext.Provider>
  );
}

export function useMeridianGalleryHost(): MeridianGalleryHostBundle {
  const bundle = useContext(MeridianGalleryHostContext);
  if (bundle === null) {
    throw new Error('useMeridianGalleryHost requires MeridianGalleryHostProvider');
  }
  return bundle;
}

export function useOptionalMeridianGalleryHost(): MeridianGalleryHostBundle | null {
  return useContext(MeridianGalleryHostContext);
}
