/**
 * pdf-parse's package root (`pdf-parse`) runs a debug-mode file read
 * when its `index.js` is evaluated with no `module.parent` — true when
 * Turbopack/webpack statically evaluate it during the build, which
 * crashes the build with an ENOENT on a test fixture that isn't
 * shipped. Importing the actual parser module directly (no debug
 * wrapper) avoids that entirely — this declares its shape since that
 * subpath has no bundled types.
 */
declare module "pdf-parse/lib/pdf-parse.js" {
  interface PdfParseResult {
    numpages: number;
    numrender: number;
    info: unknown;
    metadata: unknown;
    text: string;
  }

  interface PdfParseOptions {
    pagerender?: (pageData: unknown) => string | Promise<string>;
    max?: number;
  }

  function pdfParse(dataBuffer: Buffer, options?: PdfParseOptions): Promise<PdfParseResult>;

  export = pdfParse;
}
