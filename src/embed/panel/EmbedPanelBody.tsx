import { Suspense, lazy, useMemo, type ComponentType, type LazyExoticComponent, type ReactElement } from 'react';

import { t } from '../../i18n';

import { SpecRenderer } from '../../panels/renderer';

import { defaultCatalog, validateSpec } from '../../panels/spec';

import type { NormalizedPanelSpec } from '../../panels/spec';

import type { ReactPanelLoaderProps } from '../../panels/registry';

import type { PanelDefinition } from '../../panels/types';

import { usePanelEmbedHost } from './PanelEmbedContext';

import { useEmbedReactPanelData } from './useEmbedReactPanelData';



export interface EmbedPanelBodyProps {

  definition: PanelDefinition;

  adapterSources: readonly string[];

  bodyScroll?: 'auto' | 'hidden';

  panelData?: Record<string, unknown>;

}



function PanelLoadingPlaceholder(): ReactElement {

  return (

    <div

      part="body-loading"

      role="status"

      aria-live="polite"

      data-testid="panel-body-loading"

      style={{

        padding: 24,

        display: 'flex',

        alignItems: 'center',

        justifyContent: 'center',

        height: '100%',

        color: 'var(--landi-color-text-muted, #6B6B66)',

        fontSize: 13,

      }}

    >

      {t('chrome.panel.loading')}

    </div>

  );

}



function useLazyReactPanel(

  definition: Extract<PanelDefinition, { kind: 'react' }>): LazyExoticComponent<ComponentType<ReactPanelLoaderProps>> {

  return useMemo(() => lazy(definition.loader) as LazyExoticComponent<ComponentType<ReactPanelLoaderProps>>,

    [definition]);

}



function SpecPanelBody(props: {

  definition: Extract<PanelDefinition, { kind: 'spec' }>;

  adapterSources: readonly string[];

  bodyScroll: 'auto' | 'hidden';

}): ReactElement {

  const host = usePanelEmbedHost();

  const lifecycle = host.data.lifecycle;



  const normalized = useMemo((): NormalizedPanelSpec | null => {

    const validation = validateSpec(props.definition.spec, {

      catalog: defaultCatalog,

      adapterSources: new Set(props.adapterSources),

      hostActions: new Set(),

      panelRegistry: new Set(host.panels.ids),

    });

    return validation.ok ? validation.spec: null;

  }, [props.definition.spec, props.adapterSources, host.panels]);



  if (normalized === null) {

    return (

      <div part="body-error" role="alert" data-testid="panel-spec-invalid">

        {t('chrome.composed.invalid')}

      </div>

    );

  }



  if (lifecycle === null) {

    return (

      <div part="body-error" role="alert" data-testid="panel-lifecycle-missing">

        {t('chrome.panel.adapterUnavailable')}

      </div>

    );

  }



  return (

    <div part="body-content" className="panel-shape__content" data-panel-interactive="true">

      <SpecRenderer

        spec={normalized}

        scope={{}}

        lifecycle={lifecycle}

        bodyScroll={props.bodyScroll}

      />

    </div>

  );

}



function ReactPanelBody(props: {

  definition: Extract<PanelDefinition, { kind: 'react' }>;

  panelData?: Record<string, unknown>;

}): ReactElement {

  const LazyPanel = useLazyReactPanel(props.definition);

  const data = useEmbedReactPanelData(props.definition.id, props.panelData);



  return (

    <div part="body-content" className="panel-shape__content" data-panel-interactive="true">

      <Suspense fallback={<PanelLoadingPlaceholder />}>

        <LazyPanel data={data} hostedInWhiteboard={false} />

      </Suspense>

    </div>

  );

}



export function EmbedPanelBody({

  definition,

  adapterSources,

  bodyScroll = 'auto',

  panelData,

}: EmbedPanelBodyProps): ReactElement {

  if (definition.kind === 'spec') {

    return (

      <SpecPanelBody

        definition={definition}

        adapterSources={adapterSources}

        bodyScroll={bodyScroll}

      />

    );

  }



  return <ReactPanelBody definition={definition} panelData={panelData} />;

}

