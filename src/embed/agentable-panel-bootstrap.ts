/**
 * P9-T2 embed bootstrap: register `<agentable-panel>` and auto-scan placeholders.
 */
import './agentable-panel';
import { bootstrapAutoMountScan } from './autoMountScan';

export {
  AgentablePanelElement,
  type AgentablePanelConfigReloadDetail,
  type AgentablePanelReadyDetail,
  type AgentablePanelAdapterDetail,
  type AgentablePanelErrorDetail,
  type AgentablePanelChromeDetail,
  type AgentablePanelApprovalDetail,
  type AgentablePanelPhaseDetail,
  type AgentablePanelEventMap,
} from './agentable-panel';

export {
  bootstrapAutoMountScan,
  scanAutoMountTargets,
  startAutoMountObserver,
  DATA_PANEL_ATTR,
  DATA_SLOT_ATTR,
  DATA_MOUNTED_ATTR,
  type AutoMountScanResult,
  type AutoMountScanOptions,
} from './autoMountScan';

export {
  LAZY_HYDRATE_ATTR,
  DATA_LAZY_HYDRATE_ATTR,
  DATA_LAZY_PENDING_ATTR,
  DEFAULT_LAZY_ROOT_MARGIN,
  observeLazyVisibility,
  readLazyHydrateFlag,
  ensurePanelEmbedSkeletonStyles,
} from './lazyHydration';

if (typeof window !== 'undefined' && import.meta.env.MODE !== 'test') {
  bootstrapAutoMountScan();
}
