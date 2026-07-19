import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import {
  classifyPdfText,
  detectFileType,
  extractDocument,
  SCANNED_PDF_WARNING,
} from "@/lib/documents/extract";

describe("detectFileType", () => {
  it("detects by MIME type", () => {
    expect(detectFileType("application/pdf", "whatever")).toBe("pdf");
    expect(
      detectFileType(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "whatever"
      )
    ).toBe("docx");
    expect(
      detectFileType(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "whatever"
      )
    ).toBe("xlsx");
    expect(detectFileType("image/png", "whatever")).toBe("image");
  });

  it("falls back to file extension when MIME type is generic/unknown", () => {
    expect(detectFileType("application/octet-stream", "report.pdf")).toBe("pdf");
    expect(detectFileType("application/octet-stream", "notes.docx")).toBe("docx");
    expect(detectFileType("application/octet-stream", "budget.xlsx")).toBe("xlsx");
    expect(detectFileType("application/octet-stream", "scan.jpeg")).toBe("image");
    expect(detectFileType("", "old.xls")).toBe("xlsx");
  });

  it("is case-insensitive on extension", () => {
    expect(detectFileType("application/octet-stream", "REPORT.PDF")).toBe("pdf");
  });

  it("returns null for an unsupported type", () => {
    expect(detectFileType("video/mp4", "clip.mp4")).toBeNull();
    expect(detectFileType("application/octet-stream", "noextension")).toBeNull();
  });
});

describe("classifyPdfText", () => {
  it("flags near-empty text as a likely scanned PDF", () => {
    expect(classifyPdfText("").warning).toBe(SCANNED_PDF_WARNING);
    expect(classifyPdfText("   \n  ").warning).toBe(SCANNED_PDF_WARNING);
    expect(classifyPdfText("short").warning).toBe(SCANNED_PDF_WARNING);
  });

  it("does not flag PDFs with real embedded text", () => {
    expect(classifyPdfText("A".repeat(50)).warning).toBeUndefined();
  });
});

describe("extractDocument (xlsx)", () => {
  it("extracts sheets as tables via a real ExcelJS round trip", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Budget");
    sheet.addRow(["Item", "Cost"]);
    sheet.addRow(["Widgets", 100]);
    sheet.addRow(["Gadgets", 250]);

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const result = await extractDocument(buffer, "xlsx", "application/vnd.ms-excel");

    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].name).toBe("Budget");
    expect(result.tables[0].rows).toEqual([
      ["Item", "Cost"],
      ["Widgets", "100"],
      ["Gadgets", "250"],
    ]);
    expect(result.text).toContain("Widgets");
    expect(result.warning).toBeUndefined();
  });

  it("skips empty sheets", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Empty");
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const result = await extractDocument(buffer, "xlsx", "application/vnd.ms-excel");
    expect(result.tables).toHaveLength(0);
    expect(result.text).toBe("");
  });
});
