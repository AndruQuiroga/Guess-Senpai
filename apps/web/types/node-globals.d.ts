// Minimal Node.js environment declarations for client-side usage.
declare const process: {
  env: {
    NODE_ENV?: "development" | "production" | "test";
    NEXT_PUBLIC_API_BASE?: string;
    [key: string]: string | undefined;
  };
};

type BufferEncoding =
  | "ascii"
  | "utf8"
  | "utf-8"
  | "utf16le"
  | "ucs2"
  | "ucs-2"
  | "base64"
  | "base64url"
  | "latin1"
  | "binary"
  | "hex"
  | (string & {});

interface MinimalBuffer {
  toString(encoding?: BufferEncoding): string;
}

declare module "node:buffer" {
  export type Buffer = MinimalBuffer;
  export const Buffer: {
    from(input: ArrayBuffer | ArrayBufferView): Buffer;
    from(input: string, encoding?: BufferEncoding): Buffer;
  };
}
