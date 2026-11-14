import { describe, expect, it } from "vitest";

import {
  evaluateLaunchJourney,
  safeRepositoryName,
  validHttpsUrl,
  type LaunchSignals,
  type LaunchPreferences,
} from "./launch-journey";

const facts: LaunchSignals = {
  projectStatus: "ready",
  githubConnected: true,
  githubRepo: "owner/my-app",
  githubSimulated: false,
  deployments: [],
  cloudflareCheck: "not_connected",
};
const choices: LaunchPreferences = {
  host: "cloudflare",
  dataNeed: "none",
  databaseConfigured: false,
  sourceConfirmed: true,
  liveUrl: "",
  liveTestsConfirmed: false,
};
const run = (changes: Partial<LaunchSignals> = {}, options: Partial<LaunchPreferences> = {}) =>
  evaluateLaunchJourney({ ...facts, ...changes }, { ...choices, ...options });

describe("beginner launch journey", () => {
  it("does not tell draft or failed apps to deploy", () => {
    expect(run({ projectStatus: "draft" }).next).toMatch(/finish or repair/i);
    expect(run({ projectStatus: "error" }).steps[0].detail).toMatch(/Repair/);
  });

  it("does not invite demo users to publish temporary builds", () => {
    expect(run({ githubSimulated: true }).next).toMatch(/demo workspace/i);
    expect(run({ githubSimulated: true }).readyToReview).toBe(false);
  });

  it("separates a GitHub account login from a linked app repository", () => {
    expect(run({ githubRepo: null }).next).toMatch(/GitHub/i);
    expect(run({ githubConnected: false }).steps[1].state).toBe("action");
    expect(run({ githubSimulated: true }).steps[1].state).toBe("action");
  });

  it("does not mark a GitHub-linked repository complete without source confirmation", () => {
    const pending = run({}, { sourceConfirmed: false });
    expect(pending.steps[1].state).toBe("action");
    expect(pending.next).toMatch(/Push your generated app source/);
    const confirmed = run({}, { sourceConfirmed: true });
    expect(confirmed.steps[1].state).toBe("self-reported");
    expect(confirmed.steps[1].detail).toMatch(/self-reported/);
  });

  it("requires an explicit data choice and does not treat a checkbox as server evidence", () => {
    expect(run({}, { dataNeed: "unsure" }).next).toMatch(/database/i);
    const db = run({}, { dataNeed: "mongodb", databaseConfigured: true }).steps[2];
    expect(db.state).toBe("self-reported");
    expect(db.detail).toMatch(/NOT been independently verified/);
    expect(run({}, { dataNeed: "supabase", databaseConfigured: false }).next).toMatch(/database/i);
  });

  it("does not mistake Cloudflare GitHub check success for a verified live URL", () => {
    const journey = run({ cloudflareCheck: "passed" });
    expect(journey.readyToReview).toBe(false);
    expect(journey.steps[3].state).toBe("waiting");
    expect(journey.next).toMatch(/actual Cloudflare Worker URL/);
  });

  it("requires a tested HTTPS URL for self-reported Cloudflare launch completion", () => {
    expect(run({ cloudflareCheck: "passed" }, {
      liveTestsConfirmed: true, liveUrl: "http://unsafe.example",
    }).readyToReview).toBe(false);
    const completed = run({ cloudflareCheck: "passed" }, {
      liveTestsConfirmed: true, liveUrl: "https://my-app.workers.dev",
    });
    expect(completed.readyToReview).toBe(true);
    expect(completed.steps[4].state).toBe("self-reported");
  });

  it("does not treat a Vercel live record as evidence that app behavior works", () => {
    const deployment = { provider: "vercel", status: "live", url: "https://app.vercel.app" };
    expect(run({ deployments: [deployment] }, { host: "vercel" }).readyToReview).toBe(false);
    expect(run({ deployments: [deployment] }, {
      host: "vercel", liveTestsConfirmed: true,
    }).readyToReview).toBe(true);
    expect(run({ deployments: [{ ...deployment, status: "failed" }] }, {
      host: "vercel", liveTestsConfirmed: true,
    }).readyToReview).toBe(false);
  });

  it("does not invent live hosting when a Cloudflare check fails or has not arrived", () => {
    expect(run({ cloudflareCheck: "failed" }).next).toMatch(/Prepare/);
    expect(run({ cloudflareCheck: "unknown" }).readyToReview).toBe(false);
    expect(run({ cloudflareCheck: null }).readyToReview).toBe(false);
  });

  it("only generates GitHub links for safe owner/repository paths", () => {
    expect(safeRepositoryName("mabrig1/my-app")).toBe("mabrig1/my-app");
    expect(safeRepositoryName("github.com/a/b")).toBe(null);
    expect(safeRepositoryName("a/b?hack=1")).toBe(null);
    expect(validHttpsUrl("https://my-app.workers.dev")).toBe(true);
    expect(validHttpsUrl("javascript:alert(1)")).toBe(false);
    expect(validHttpsUrl("https://example.com@evil.invalid")).toBe(false);
  });
});
