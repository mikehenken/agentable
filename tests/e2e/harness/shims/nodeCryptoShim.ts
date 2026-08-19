/**
 * Browser shim for gallery harness bundles (document export pulls node:crypto).
 */
export function createHash(algorithm: string): {
  update: (data: string) => { digest: (encoding: string) => string };
  digest: (encoding: string) => string;
} {
  void algorithm;
  let payload = '';
  return {
    update(data: string) {
      payload += data;
      return {
        digest(encoding: string) {
          void encoding;
          return `demo-${payload.length}`;
        },
      };
    },
    digest(encoding: string) {
      void encoding;
      return `demo-${payload.length}`;
    },
  };
}
