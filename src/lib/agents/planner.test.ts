import { describe, expect, it } from "vitest";

import { fallbackPlan } from "@/lib/agents/planner";

describe("fallbackPlan", () => {
  it("builds a complete statistical-analysis product when inference degrades", () => {
    const plan = fallbackPlan(
      "Build a statistical analysis app for researchers with CSV upload and regression"
    );

    expect(plan.appName).toBe("InsightLab");
    expect(plan.pages).toHaveLength(6);
    expect(plan.workflows?.map((workflow) => workflow.name)).toEqual(
      expect.arrayContaining([
        "Import and validate a dataset",
        "Run an analysis",
        "Export findings",
      ])
    );
    expect(plan.dataModel.map((table) => table.table)).toEqual(
      expect.arrayContaining(["projects", "datasets", "analyses", "results", "reports"])
    );
    expect(
      plan.dataModel.every((table) =>
        table.columns.some((column) => column.name === "owner_id")
      )
    ).toBe(true);
    expect(plan.acceptanceCriteria?.length).toBeGreaterThanOrEqual(5);
  });

  it("uses the delivery-specific real-workflow plan when free inference is unavailable", () => {
    const plan = fallbackPlan("Create a courier and deliveries app for riders and dispatchers.");
    expect(plan.appName).toBe("Courier & Deliveries");
    expect(plan.pages.map(page=>page.path)).toEqual(["/","/shipments","/dispatch","/riders","/tracking"]);
    expect(plan.dataModel.map(table=>table.table)).toContain("shipments");
    expect(plan.dataModel.map(table=>table.table)).toContain("shipment_events");
    expect(plan.acceptanceCriteria?.some(item=>item.includes("GPS"))).toBe(true);
  });
  it("uses an operational persistent workspace for unknown domains", () => {
    const plan = fallbackPlan("Build a vendor compliance tracker");

    expect(plan.pages.map((page) => page.name)).toEqual([
      "Workspace",
      "Records",
      "Settings",
    ]);
    expect(plan.features).toContain("Persistent CRUD");
    expect(plan.dataModel[0].columns.map((column) => column.name)).toContain(
      "owner_id"
    );
  });

  it("preserves up to seven explicitly requested pages", () => {
    const plan = fallbackPlan(`Build a portal
Pages:
- Overview
- Customers
- Orders
- Inventory
- Reports
- Billing
- Settings`);

    expect(plan.pages).toHaveLength(7);
    expect(plan.pages.at(-1)?.path).toBe("/settings");
  });
});
