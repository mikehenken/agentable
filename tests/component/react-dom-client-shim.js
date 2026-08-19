import * as ReactDomClientModule from '../../../node_modules/react-dom/cjs/react-dom-client.development.js';

const ReactDomClient = ReactDomClientModule.default ?? ReactDomClientModule;

export const createRoot = ReactDomClient.createRoot;
export const hydrateRoot = ReactDomClient.hydrateRoot;
