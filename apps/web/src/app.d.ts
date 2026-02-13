import type { Session, User, SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from '$lib/utils/logger';
import type { PerformanceMonitor } from '$lib/utils/performance';

// Note: Module declarations for optional dependencies (@sentry/sveltekit, web-vitals, qrcode)
// are in src/lib/types/optional-deps.d.ts

// Web Serial API types
declare global {
  interface Navigator {
    serial: Serial;
  }

  interface Serial {
    requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
    getPorts(): Promise<SerialPort[]>;
  }

  interface SerialPortRequestOptions {
    filters?: SerialPortFilter[];
  }

  interface SerialPortFilter {
    usbVendorId?: number;
    usbProductId?: number;
  }

  interface SerialPort {
    readable: ReadableStream<Uint8Array> | null;
    writable: WritableStream<Uint8Array> | null;
    open(options: SerialOptions): Promise<void>;
    close(): Promise<void>;
    getInfo(): SerialPortInfo;
  }

  interface SerialOptions {
    baudRate: number;
    dataBits?: 7 | 8;
    stopBits?: 1 | 2;
    parity?: 'none' | 'even' | 'odd' | 'mark' | 'space';
    bufferSize?: number;
    flowControl?: 'none' | 'hardware';
  }

  interface SerialPortInfo {
    usbVendorId?: number;
    usbProductId?: number;
  }

  // Web Bluetooth API types
  interface BluetoothDevice {
    id: string;
    name?: string;
    gatt?: BluetoothRemoteGATTServer;
  }

  interface BluetoothRemoteGATTServer {
    connected: boolean;
    connect(): Promise<BluetoothRemoteGATTServer>;
    disconnect(): void;
    getPrimaryService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>;
  }

  interface BluetoothRemoteGATTService {
    getCharacteristic(characteristic: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic>;
  }

  interface BluetoothRemoteGATTCharacteristic {
    value: DataView | null;
    readValue(): Promise<DataView>;
    writeValue(value: BufferSource): Promise<void>;
    startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
    stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
    addEventListener(type: 'characteristicvaluechanged', listener: (event: Event) => void): void;
    removeEventListener(type: 'characteristicvaluechanged', listener: (event: Event) => void): void;
  }

  type BluetoothServiceUUID = string | number;
  type BluetoothCharacteristicUUID = string | number;
}

// Cloudflare Workers AI types
interface CloudflareAI {
  run<T = unknown>(model: string, input: unknown): Promise<T>;
}

// Cloudflare KV types
interface CloudflareKV {
  get(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream' }): Promise<unknown>;
  put(key: string, value: string | ArrayBuffer | ReadableStream, options?: { expirationTtl?: number; expiration?: number; metadata?: Record<string, unknown> }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{ keys: { name: string; expiration?: number; metadata?: unknown }[]; list_complete: boolean; cursor?: string }>;
}

// Cloudflare R2 types
interface CloudflareR2Bucket {
  head(key: string): Promise<R2Object | null>;
  get(key: string): Promise<R2ObjectBody | null>;
  put(key: string, value: ReadableStream | ArrayBuffer | string, options?: R2PutOptions): Promise<R2Object>;
  delete(keys: string | string[]): Promise<void>;
  list(options?: R2ListOptions): Promise<R2Objects>;
}

interface R2Object {
  key: string;
  version: string;
  size: number;
  etag: string;
  httpEtag: string;
  uploaded: Date;
  httpMetadata?: R2HTTPMetadata;
  customMetadata?: Record<string, string>;
}

interface R2ObjectBody extends R2Object {
  body: ReadableStream;
  bodyUsed: boolean;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  json<T = unknown>(): Promise<T>;
  blob(): Promise<Blob>;
}

interface R2PutOptions {
  httpMetadata?: R2HTTPMetadata;
  customMetadata?: Record<string, string>;
  md5?: ArrayBuffer | string;
  sha1?: ArrayBuffer | string;
  sha256?: ArrayBuffer | string;
  sha384?: ArrayBuffer | string;
  sha512?: ArrayBuffer | string;
}

interface R2HTTPMetadata {
  contentType?: string;
  contentLanguage?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  cacheControl?: string;
  cacheExpiry?: Date;
}

interface R2ListOptions {
  limit?: number;
  prefix?: string;
  cursor?: string;
  delimiter?: string;
  include?: ('httpMetadata' | 'customMetadata')[];
}

interface R2Objects {
  objects: R2Object[];
  truncated: boolean;
  cursor?: string;
  delimitedPrefixes: string[];
}

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient;
      safeGetSession: () => Promise<{ session: Session | null; user: User | null }>;
      session: Session | null;
      user: User | null;
      nonce: string;
      rateLimitHeaders?: Record<string, string>;
      /** Unique request ID for tracing and correlation */
      requestId: string;
      /** Request-scoped structured logger */
      logger: Logger;
      /** Performance monitor for timing and metrics */
      performanceMonitor: PerformanceMonitor;
    }

    interface PageData {
      session: Session | null;
      user: User | null;
    }

    interface Platform {
      env?: {
        // Environment
        ENVIRONMENT: 'development' | 'staging' | 'production';
        APP_NAME: string;
        APP_URL: string;
        API_VERSION: string;

        // Supabase
        SUPABASE_URL: string;
        SUPABASE_ANON_KEY: string;
        SUPABASE_SERVICE_ROLE_KEY: string;

        // Stripe
        STRIPE_PUBLIC_KEY: string;
        STRIPE_SECRET_KEY: string;
        STRIPE_WEBHOOK_SECRET: string;
        STRIPE_PRICE_PRO_MONTHLY: string;
        STRIPE_PRICE_PRO_YEARLY: string;
        STRIPE_PRICE_ENTERPRISE_MONTHLY: string;
        STRIPE_PRICE_ENTERPRISE_YEARLY: string;

        // Cloudflare Workers AI
        AI: CloudflareAI;

        // Cloudflare KV - Pattern caching
        PATTERN_CACHE: CloudflareKV;

        // Cloudflare R2 - Asset storage
        PATTERN_ASSETS: CloudflareR2Bucket;
      };
      context?: {
        waitUntil(promise: Promise<unknown>): void;
      };
      caches?: CacheStorage;
    }

    interface Error {
      message: string;
      code?: string;
      status?: number;
    }
  }
}

export {};
