import { describe, expect, it } from "vitest";

import { TRAINING_TRACKS } from "./labs";
import {
  CAPSTONE_NOTE_LIMIT, CAPSTONE_RUBRICS, CAPSTONE_TITLE_LIMIT,
  capstoneEvidenceReview, capstoneReviewMarkdown, containsCapstoneSensitiveText,
  newCapstoneRecord, parseCapstoneRecord, parseCapstoneStore,
  parseGithubRepository, validFullCommitSha, validGithubCiRun, validPublicDemoUrl,
} from "./capstone-evidence";

const sha = "a".repeat(40);
const repoUrl = "https://github.com/mabrig1/BuildRx";
const ciUrl = "https://github.com/mabrig1/BuildRx/actions/runs/43258025031";

describe("capstone reviewer evidence model", () => {
  it("provides six distinct, actionable rubric criteria for each track", () => {
    for (const track of TRAINING_TRACKS) {
      const rubric = CAPSTONE_RUBRICS[track.id];
      expect(rubric).toHaveLength(6);
      expect(new Set(rubric.map(item => item.id)).size).toBe(6);
      for (const criterion of rubric) {
        expect(criterion.title.length).toBeGreaterThan(10);
        expect(criterion.requestedEvidence.length).toBeGreaterThan(25);
        expect(criterion.reviewerCheck.length).toBeGreaterThan(25);
      }
      const empty = newCapstoneRecord(track.id);
      expect(empty.trackId).toBe(track.id);
      expect(Object.keys(empty.evidence)).toHaveLength(6);
      expect(capstoneEvidenceReview(empty).documented).toBe(0);
      expect(capstoneEvidenceReview(empty).hasReviewableReferences).toBe(false);
    }
  });

  it("recognizes only exact GitHub repository HTTPS URLs without embedded credentials", () => {
    expect(parseGithubRepository(repoUrl)).toEqual({ owner: "mabrig1", repo: "BuildRx", url: repoUrl });
    expect(parseGithubRepository(repoUrl + "/")).toEqual({ owner: "mabrig1", repo: "BuildRx", url: repoUrl });
    for (const bad of [
      "", "http://github.com/mabrig1/BuildRx",
      "https://github.com.evil.example/mabrig1/BuildRx",
      "https://evil.example/mabrig1/BuildRx",
      "https://github.com/owner/repo/commit/" + sha,
      "https://github.com/owner/repo.git",
      "https://github.com/owner/repo?token=value",
      "https://github.com/owner/repo#readme",
      "https://user:pass@github.com/owner/repo",
      "javascript:alert(1)",
      "https://github.com/owner/../repo",
    ]) expect(parseGithubRepository(bad), bad).toBeNull();
  });

  it("pins provenance to a 40-character SHA and a matching Actions run", () => {
    expect(validFullCommitSha(sha)).toBe(true);
    expect(validFullCommitSha("a".repeat(7))).toBe(false);
    expect(validFullCommitSha("g".repeat(40))).toBe(false);
    expect(validGithubCiRun(ciUrl, repoUrl)).toBe(true);
    expect(validGithubCiRun("https://github.com/mabrig1/Other/actions/runs/43258025031", repoUrl)).toBe(false);
    expect(validGithubCiRun(ciUrl + "?secret=1", repoUrl)).toBe(false);
    expect(validGithubCiRun("https://github.com/mabrig1/BuildRx/actions/runs/abc", repoUrl)).toBe(false);
    expect(validGithubCiRun("https://github.com/mabrig1/BuildRx/actions/runs/0", repoUrl)).toBe(false);
  });

  it("accepts only public-format HTTPS demo links without credential/query or local hosts", () => {
    expect(validPublicDemoUrl("https://demo.example.com")).toBe(true);
    expect(validPublicDemoUrl("https://app.example.com/booking")).toBe(true);
    for (const bad of [
      "http://demo.example.com",
      "https://localhost:3000",
      "https://localhost",
      "https://127.0.0.1",
      "https://10.1.2.3",
      "https://192.168.1.10",
      "https://172.16.0.1",
      "https://service.internal",
      "https://bad.example.com/?key=secret",
      "https://admin:secret@demo.example.com",
      "javascript:alert('x')",
    ]) expect(validPublicDemoUrl(bad), bad).toBe(false);
  });

  it("discards unknown imported keys and denies oversized, malformed or cross-track packets", () => {
    const sample = newCapstoneRecord("fullstack-web");
    const extra = {
      ...sample,
      unusualPrivateField: "ignored",
      evidence: { ...sample.evidence, secretExtra: "ignored" },
    };
    const valid = parseCapstoneRecord(extra, "fullstack-web");
    expect(valid.ok).toBe(true);
    if (!valid.ok) throw Error(valid.reason);
    expect(valid.record).not.toHaveProperty("unusualPrivateField");
    expect(valid.record.evidence).not.toHaveProperty("secretExtra");
    expect(parseCapstoneRecord(extra, "mobile-app").ok).toBe(false);
    expect(parseCapstoneRecord({ ...sample, version: 2 }).ok).toBe(false);
    expect(parseCapstoneRecord({ ...sample, evidence: [] }).ok).toBe(false);
    expect(parseCapstoneRecord({ ...sample, projectTitle: "z".repeat(CAPSTONE_TITLE_LIMIT + 1) }).ok).toBe(false);
    expect(parseCapstoneRecord({
      ...sample, evidence: { ...sample.evidence, interface: "a".repeat(CAPSTONE_NOTE_LIMIT + 1) },
    }).ok).toBe(false);
    expect(parseCapstoneRecord({
      ...sample, reflection: "github_pat_abc123456789012345",
    }).ok).toBe(false);
  });

  it("keeps per-track evidence isolated in local JSON, never treating it as an assessed grade", () => {
    const web = newCapstoneRecord("fullstack-web");
    const systems = newCapstoneRecord("systems-engineering");
    const all = parseCapstoneStore({
      "fullstack-web": { ...web, projectTitle: "Local web project" },
      "systems-engineering": { ...systems, projectTitle: "Architecture dossier" },
      "mobile-app": { garbage: true },
      "other-track": { ...web },
    });
    expect(Object.keys(all).sort()).toEqual(["fullstack-web", "systems-engineering"]);
    expect(all["fullstack-web"]?.projectTitle).toBe("Local web project");
    expect(all["systems-engineering"]?.projectTitle).toBe("Architecture dossier");
    expect(all["mobile-app"]).toBeUndefined();
  });

  it("labels a complete packet as reviewable only, never automatically verified", () => {
    const sample = newCapstoneRecord("fullstack-web");
    sample.projectTitle = "Booking practice";
    sample.repoUrl = repoUrl;
    sample.commitSha = sha;
    sample.ciRunUrl = ciUrl;
    for (const criterion of CAPSTONE_RUBRICS["fullstack-web"]) {
      sample.evidence[criterion.id] = "Review source and test logs at this commit.";
    }
    const report = capstoneEvidenceReview(sample);
    expect(report).toMatchObject({
      documented: 6, required: 6, missing: [], errors: [], hasReviewableReferences: true,
    });
    expect(report.description).toContain("has not fetched");
    const packet = capstoneReviewMarkdown(sample);
    expect(packet).toContain("NOT INDEPENDENTLY VERIFIED");
    expect(packet).toContain("NOT a certificate");
    expect(packet).toContain("independent instructor");
    expect(packet).toContain(sha);
    expect(packet).not.toMatch(/certificate issued|verification passed/i);
  });

  it("reports missing proof and rejects secret-shaped text instead of fabricating readiness", () => {
    const sample = newCapstoneRecord("software-engineering");
    sample.projectTitle = "Issue Tracker";
    sample.repoUrl = repoUrl;
    sample.commitSha = sha;
    sample.ciRunUrl = "https://github.com/another/repo/actions/runs/123";
    sample.evidence.requirements = "docs/requirements.md";
    const incomplete = capstoneEvidenceReview(sample);
    expect(incomplete.documented).toBe(1);
    expect(incomplete.missing.length).toBe(5);
    expect(incomplete.errors.some(item => item.includes("same repository"))).toBe(true);
    sample.reflection = "mongodb+srv://admin:password@localhost/test";
    expect(containsCapstoneSensitiveText(sample)).toBe(true);
    expect(parseCapstoneRecord(sample).ok).toBe(false);
  });
});
