import { describe, expect, it } from "vitest";
import { safePage, safeQuery, validClientId, validTicketStatus } from "./admin-data";

describe("Admin CRM input gates", () => {
  it("bounds pages and rejects non-numeric or negative values", () => {
    expect(safePage("3")).toBe(3);
    expect(safePage("-3")).toBe(1);
    expect(safePage("NaN")).toBe(1);
    expect(safePage("9999999999")).toBe(1);
  });
  it("removes wildcard characters from client email search", () => {
    expect(safeQuery("  a%_b\\\\@example.com ")).toBe("ab@example.com");
    expect(safeQuery("a".repeat(140)).length).toBe(100);
  });
  it("accepts only UUID identifiers and an explicit ticket-status allowlist", () => {
    expect(validClientId("9aa6ce88-9e87-492c-b704-5bd89e01fb89")).toBe(true);
    expect(validClientId("../../")).toBe(false);
    expect(validTicketStatus("open")).toBe(true);
    expect(validTicketStatus("resolved")).toBe(true);
    expect(validTicketStatus("paid")).toBe(false);
  });
});
