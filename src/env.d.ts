/// <reference types="astro/client" />

interface R2Bucket {
  put(key: string, value: ArrayBuffer | ReadableStream, options?: {
    httpMetadata?: {
      contentType?: string;
    };
  }): Promise<void>;
  get(key: string): Promise<R2Object | null>;
  delete(key: string): Promise<void>;
}

interface R2Object {
  body: ReadableStream;
  httpMetadata?: {
    contentType?: string;
  };
}

interface Env {
  R2_BUCKET: R2Bucket;
}

declare namespace App {
  interface Locals {
    runtime: {
      env: Env;
    };
  }
}
