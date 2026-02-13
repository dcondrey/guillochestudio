/**
 * Type declarations for optional dependencies that may or may not be installed.
 * These modules are dynamically imported, so we provide type stubs to satisfy TypeScript.
 */

declare module '@sentry/sveltekit' {
  interface SentryEvent {
    exception?: {
      values?: Array<{
        type?: string;
        value?: string;
      }>;
    };
    [key: string]: unknown;
  }

  export function init(options: {
    dsn: string;
    environment?: string;
    tracesSampleRate?: number;
    replaysSessionSampleRate?: number;
    replaysOnErrorSampleRate?: number;
    integrations?: unknown[];
    beforeSend?: (event: SentryEvent) => SentryEvent | null;
  }): void;

  export function captureException(
    error: unknown,
    context?: { extra?: Record<string, unknown> }
  ): void;

  export function replayIntegration(options?: {
    maskAllText?: boolean;
    blockAllMedia?: boolean;
  }): unknown;
}

declare module 'web-vitals' {
  interface Metric {
    name: string;
    value: number;
    id: string;
    delta: number;
    entries: PerformanceEntry[];
  }

  type ReportHandler = (metric: Metric) => void;

  export function onCLS(onReport: ReportHandler): void;
  export function onFID(onReport: ReportHandler): void;
  export function onFCP(onReport: ReportHandler): void;
  export function onLCP(onReport: ReportHandler): void;
  export function onTTFB(onReport: ReportHandler): void;
  export function onINP(onReport: ReportHandler): void;
}

declare module 'qrcode' {
  interface QRCodeOptions {
    width?: number;
    margin?: number;
    color?: {
      dark?: string;
      light?: string;
    };
    type?: 'svg' | 'terminal' | 'utf8';
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  }

  export function toDataURL(data: string, options?: QRCodeOptions): Promise<string>;
  export function toString(data: string, options?: QRCodeOptions): Promise<string>;
}

declare module 'jszip' {
  interface JSZipObject {
    name: string;
    dir: boolean;
    date: Date;
    comment: string;
    unixPermissions: number | null;
    dosPermissions: number | null;
    async(type: 'string'): Promise<string>;
    async(type: 'base64'): Promise<string>;
    async(type: 'uint8array'): Promise<Uint8Array>;
    async(type: 'arraybuffer'): Promise<ArrayBuffer>;
    async(type: 'blob'): Promise<Blob>;
    async(type: 'nodebuffer'): Promise<Buffer>;
  }

  interface JSZipGeneratorOptions {
    type?: 'base64' | 'string' | 'uint8array' | 'arraybuffer' | 'blob' | 'nodebuffer';
    compression?: 'STORE' | 'DEFLATE';
    compressionOptions?: {
      level?: number;
    };
    comment?: string;
    mimeType?: string;
    platform?: 'DOS' | 'UNIX';
    encodeFileName?: (filename: string) => string;
    streamFiles?: boolean;
  }

  class JSZip {
    file(name: string): JSZipObject | null;
    file(
      name: string,
      data:
        | string
        | ArrayBuffer
        | Uint8Array
        | Blob
        | Promise<string | ArrayBuffer | Uint8Array | Blob>,
      options?: {
        base64?: boolean;
        binary?: boolean;
        date?: Date;
        compression?: string;
        comment?: string;
        optimizedBinaryString?: boolean;
        createFolders?: boolean;
        unixPermissions?: number;
        dosPermissions?: number;
        dir?: boolean;
      }
    ): this;
    folder(name: string): JSZip | null;
    forEach(callback: (relativePath: string, file: JSZipObject) => void): void;
    filter(predicate: (relativePath: string, file: JSZipObject) => boolean): JSZipObject[];
    remove(name: string): this;
    generateAsync(options: { type: 'blob' } & Omit<JSZipGeneratorOptions, 'type'>): Promise<Blob>;
    generateAsync(
      options?: JSZipGeneratorOptions
    ): Promise<string | Uint8Array | ArrayBuffer | Blob | Buffer>;
    loadAsync(
      data:
        | string
        | ArrayBuffer
        | Uint8Array
        | Blob
        | Promise<string | ArrayBuffer | Uint8Array | Blob>,
      options?: {
        base64?: boolean;
        checkCRC32?: boolean;
        optimizedBinaryString?: boolean;
        createFolders?: boolean;
        decodeFileName?: (bytes: Uint8Array) => string;
      }
    ): Promise<JSZip>;
  }

  const jszip: {
    new (): JSZip;
  };

  export default jszip;
}
