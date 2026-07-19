/**
 * Document text/table extraction — dispatches by file type. No file
 * storage is involved: the caller passes raw bytes, gets back
 * extracted text/tables, and the bytes are discarded. Only the
 * extracted content is persisted (see the `documents` table) — this
 * app has no blob storage configured yet, and extraction happening
 * synchronously at upload time means none is needed for this feature
 * to work end to end.
 */

import ExcelJS from "exceljs";
import mammoth from "mammoth";
// Deep import bypasses pdf-parse's package-root index.js, which runs a
// debug file read when bundlers evaluate it with no module.parent set —
// see src/types/pdf-parse-lib.d.ts for the full story.
import pdfParse from "pdf-parse/lib/pdf-parse.js";

import { extractDocument as extractImageDocument } from "@/lib/ai/parse";

export type DocumentFileType = "pdf" | "docx" | "xlsx" | "image";

export interface ExtractedTable {
  name: string;
  rows: string[][];
}

export interface ExtractionResult {
  text: string;
  tables: ExtractedTable[];
  /** Set when extraction succeeded but with a caveat worth surfacing (e.g. a scanned PDF). */
  warning?: string;
}

const TYPE_BY_MIME: Record<string, DocumentFileType> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel": "xlsx",
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "image/gif": "image",
};

const TYPE_BY_EXTENSION: Record<string, DocumentFileType> = {
  pdf: "pdf",
  docx: "docx",
  xlsx: "xlsx",
  xls: "xlsx",
  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
  gif: "image",
};

export function detectFileType(mimeType: string, filename: string): DocumentFileType | null {
  if (TYPE_BY_MIME[mimeType]) return TYPE_BY_MIME[mimeType];
  const extension = filename.split(".").pop()?.toLowerCase();
  return extension ? (TYPE_BY_EXTENSION[extension] ?? null) : null;
}

export const SCANNED_PDF_WARNING =
  "This looks like a scanned PDF with no embedded text layer. " +
  "OCR for scanned PDFs isn't supported yet — try uploading it as an image instead (one page per image).";

/**
 * A PDF with (almost) no embedded text is very likely a scanned image
 * with no text layer — extracting it needs OCR over each rendered
 * page, which this phase doesn't do (see the module doc). Pulled out
 * as a pure function so the threshold behavior is unit-testable
 * without invoking pdf-parse itself.
 */
export function classifyPdfText(text: string): { warning?: string } {
  return text.trim().length < 20 ? { warning: SCANNED_PDF_WARNING } : {};
}

async function extractPdf(buffer: Buffer): Promise<ExtractionResult> {
  const result = await pdfParse(buffer);
  const text = (result.text ?? "").trim();
  return { text, tables: [], ...classifyPdfText(text) };
}

async function extractDocx(buffer: Buffer): Promise<ExtractionResult> {
  const result = await mammoth.extractRawText({ buffer });
  return { text: result.value.trim(), tables: [] };
}

async function extractXlsx(buffer: Buffer): Promise<ExtractionResult> {
  const workbook = new ExcelJS.Workbook();
  // exceljs's bundled Buffer type is structurally stricter than the
  // ambient Node Buffer type here — a known DefinitelyTyped version
  // mismatch, not a real type-safety gap (a Buffer is a Buffer at
  // runtime); the cast just satisfies the compiler.
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

  const tables: ExtractedTable[] = [];
  const textParts: string[] = [];

  for (const sheet of workbook.worksheets) {
    const rows: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      rows.push(values.map((cell) => (cell === null || cell === undefined ? "" : String(cell))));
    });
    if (rows.length === 0) continue;

    tables.push({ name: sheet.name, rows });
    textParts.push(`## ${sheet.name}\n${rows.map((r) => r.join(" | ")).join("\n")}`);
  }

  return { text: textParts.join("\n\n").trim(), tables };
}

async function extractImage(buffer: Buffer, mimeType: string): Promise<ExtractionResult> {
  const base64 = buffer.toString("base64");
  const imageDataUrl = `data:${mimeType};base64,${base64}`;
  const result = await extractImageDocument({ imageDataUrl });
  return { text: result.text.trim(), tables: [] };
}

export async function extractDocument(
  buffer: Buffer,
  fileType: DocumentFileType,
  mimeType: string
): Promise<ExtractionResult> {
  switch (fileType) {
    case "pdf":
      return extractPdf(buffer);
    case "docx":
      return extractDocx(buffer);
    case "xlsx":
      return extractXlsx(buffer);
    case "image":
      return extractImage(buffer, mimeType);
  }
}
