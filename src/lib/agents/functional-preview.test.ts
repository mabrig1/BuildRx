import { describe, expect, it } from "vitest";

import {
  buildFunctionalPreview,
  previewFunctionalityIssues,
} from "@/lib/agents/functional-preview";
import type { AppPlan } from "@/lib/agents/types";

const PLAN: AppPlan = {
  appName: "ClientFlow Pro",
  summary: "A multi-tenant client operations platform.",
  pages: [{ name: "Dashboard", path: "/", description: "Operations" }],
  components: [],
  features: ["Client management", "Project tracking"],
  workflows: [
    {
      name: "Onboard a client",
      actor: "Administrator",
      steps: ["Create client", "Create project", "Assign task"],
      outcome: "The delivery team can begin work",
    },
  ],
  dataModel: [
    {
      table: "clients",
      description: "Customer accounts and contact details",
      columns: [
        { name: "id", type: "uuid" },
        { name: "name", type: "text" },
        { name: "email", type: "text" },
        { name: "status", type: "text" },
      ],
    },
    {
      table: "projects",
      description: "Client delivery projects",
      columns: [
        { name: "id", type: "uuid" },
        { name: "name", type: "text" },
        { name: "status", type: "text" },
      ],
    },
  ],
};

describe("buildFunctionalPreview", () => {
  it("generates a complete persistent CRUD workspace", () => {
    const preview = buildFunctionalPreview(PLAN);

    expect(previewFunctionalityIssues(preview)).toEqual([]);
    expect(preview).toContain("localStorage.setItem");
    expect(preview).toContain("data-edit");
    expect(preview).toContain("data-delete");
    expect(preview).toContain("Export JSON");
    expect(preview).toContain("clients");
    expect(preview).toContain("projects");
  });

  it("escapes product text before placing it in HTML or script data", () => {
    const preview = buildFunctionalPreview({
      ...PLAN,
      appName: '<script>alert("x")</script>',
      dataModel: [
        {
          ...PLAN.dataModel[0],
          description: "</script><script>alert(1)</script>",
        },
      ],
    });

    expect(preview).not.toContain('<script>alert("x")</script>');
    expect(preview).toContain("&lt;script&gt;");
    expect(preview).toContain("\\u003c/script>");
  });
});

describe("previewFunctionalityIssues", () => {
  it("rejects a disclaimer pretending to be a product", () => {
    const fake = `<!doctype html><html><body><form><input /></form><button>Go</button><script>document.querySelector("button").addEventListener("click", () => document.body.classList.add("done"));</script><p>Full functionality requires backend integration and authentication.</p>${"x".repeat(3200)}</body></html>`;

    expect(previewFunctionalityIssues(fake)).toContain(
      "preview contains a non-functional disclaimer"
    );
  });
});
