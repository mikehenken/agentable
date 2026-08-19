import * as ReactModule from '../../../node_modules/react/cjs/react.development.js';

const React = ReactModule.default ?? ReactModule;

export const Fragment = React.Fragment;

export function jsx(type, props, key) {
  if (key !== undefined && props !== null) {
    return React.createElement(type, { ...props, key });
  }
  if (key !== undefined) {
    return React.createElement(type, { key });
  }
  return React.createElement(type, props);
}

export function jsxs(type, props, key) {
  return jsx(type, props, key);
}
