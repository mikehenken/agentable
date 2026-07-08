declare module 'classnames-original' {
  type ClassNamesFn = {
    (...args: unknown[]): string;
    default?: ClassNamesFn;
  };

  const classnames: ClassNamesFn;
  export default classnames;
}
