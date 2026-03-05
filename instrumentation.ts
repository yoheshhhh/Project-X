/**
 * Next.js instrumentation — runs once at server startup before any route module is loaded.
 * Polyfills browser-only globals that pdfjs-dist (via pdf-parse) expects.
 */
export async function register() {
  if (typeof globalThis.File === 'undefined') {
    (globalThis as any).File = class File extends Blob {
      name: string;
      lastModified: number;
      constructor(bits: BlobPart[], name: string, opts?: FilePropertyBag) {
        super(bits, opts);
        this.name = name;
        this.lastModified = opts?.lastModified ?? Date.now();
      }
    };
  }
}
