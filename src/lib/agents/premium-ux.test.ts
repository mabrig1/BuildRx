import { describe, expect, it } from "vitest";
import type { AppPlan } from "@/lib/agents/types";
import { classifyProductIndustry, generatePremiumPreview, showcaseFixture, htmlSafe } from "./premium-ux";
import { generatePremiumNextPage } from "./premium-next";

const createPlan = (name: string, summary: string, tables: string[]): AppPlan => ({
  appName: name,
  summary,
  features: ["responsive", "filterable catalog", "customer workflows"],
  pages: [
    { name: "Home", path: "/", description: "Overview" },
    { name: "Catalog", path: "/catalog", description: "Browse and find items" },
    { name: "Orders", path: "/orders", description: "Track records" },
  ],
  components: [],
  dataModel: tables.map(table => ({
    table,
    description: "Private persisted records",
    columns: [{ name: "id", type: "uuid" }, { name: "name", type: "text" }],
  })),
});

describe("premium generator defaults", () => {
  it("generates a populated, image-led Nigerian supermarket preview with actual demo interactions", () => {
    const plan = createPlan("BOSAL Store", "Local Nigerian supermarket with many products", ["products","orders"]);
    expect(classifyProductIndustry(plan)).toBe("retail");
    const preview = generatePremiumPreview(plan);
    expect(preview).toContain("Soft Sliced Bread");
    expect(preview).toContain("Fresh Tomatoes");
    expect(preview).toContain("Premium Rice");
    expect(preview).toContain("images.unsplash.com/");
    expect(preview).toContain("Add to cart");
    expect(preview).toContain("data-filter");
    expect(preview).toContain("renderCards()");
    expect(preview).toContain("DEMONSTRATION PREVIEW");
    expect(preview).toContain("no payment");
    expect(preview).toContain("@media(max-width:750px)");
    expect(showcaseFixture(plan).length).toBeGreaterThanOrEqual(8);
  });

  it("produces a distinct restaurant menu rather than supermarket products", () => {
    const plan = createPlan("BOSAL Restaurant", "Food menu, kitchen orders and pickup", ["menu_items","orders"]);
    expect(classifyProductIndustry(plan)).toBe("restaurant");
    const preview = generatePremiumPreview(plan);
    expect(preview).toContain("Smoky Jollof Rice");
    expect(preview).toContain("Grilled Chicken Platter");
    expect(preview).not.toContain("Premium Rice · 5kg");
  });

  it("uses industry-specific fixtures for school, booking, research, and business apps", () => {
    const samples: Array<[AppPlan, string]> = [
      [createPlan("School Portal", "Manage students and classes", ["students"]), "Programming Foundations"],
      [createPlan("Appointment Desk", "Manage salon appointments", ["appointments"]), "Private consultation"],
      [createPlan("StatLab", "Analyze datasets and survey results", ["datasets"]), "Customer Satisfaction Study"],
      [createPlan("Client CRM", "Manage leads and customer relationships", ["contacts"]), "Website redesign request"],
    ];
    for(const [plan, example] of samples) {
      expect(generatePremiumPreview(plan)).toContain(example);
    }
  });

  it("escapes untrusted business names in generated HTML and JSX source", () => {
    const plan = createPlan('Joe <script>alert("x")</script>', "Store with <script>bad</script> name", ["products"]);
    const preview = generatePremiumPreview(plan);
    expect(preview).toContain("&lt;script&gt;");
    expect(preview).not.toContain('<script>alert("x")</script>');
    const next = generatePremiumNextPage(plan,plan.pages[0]);
    expect(next).not.toContain('const brand = "Joe <script>');
    expect(next).toContain("\\u003cscript");
    expect(htmlSafe("<strong>")).toBe("&lt;strong&gt;");
  });

  it("generates interactive, responsive Next pages with working sample selection controls and no fake checkout", () => {
    const plan = createPlan("BOSAL Store","Nigerian grocery supermarket",["products"]);
    const home = generatePremiumNextPage(plan,plan.pages[0]);
    const sub = generatePremiumNextPage(plan,plan.pages[1]);
    for(const output of [home,sub]){
      expect(output).toContain('"use client"');
      expect(output).toContain('useState');
      expect(output).toContain('onChange={event=>setSearch');
      expect(output).toContain('onClick={()=>add(item.id)}');
      expect(output).toContain("sm:grid-cols-2");
      expect(output).toContain("SAMPLE EXPERIENCE");
      expect(output).toContain("No real database, purchase");
      expect(output).not.toContain("Quarterly review");
      expect(output).not.toContain('>Create record</button>');
    }
    expect(sub).toContain('const pageTitle = "Catalog"');
  });
});
