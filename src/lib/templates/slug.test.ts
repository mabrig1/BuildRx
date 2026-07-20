import { describe, expect, it } from "vitest";

import { slugify } from "@/lib/templates/slug";

describe("slugify", () => {
  it("lowercases and hyphenates spaces", () => {
    expect(slugify("My Cool App")).toBe("my-cool-app");
  });

  it("collapses runs of non-alphanumeric characters into a single hyphen", () => {
    expect(slugify("Todo List!! (v2.0)")).toBe("todo-list-v2-0");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  --Landing Page--  ")).toBe("landing-page");
  });

  it("caps length at 60 characters", () => {
    const long = "a".repeat(100);
    expect(slugify(long)).toHaveLength(60);
  });

  it("returns an empty string for input with no alphanumeric characters", () => {
    expect(slugify("!!!")).toBe("");
  });
});
