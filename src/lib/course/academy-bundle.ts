import { TRAINING_LABS, TRAINING_TRACKS, type TrainingTrackId } from "@/lib/learn/labs";

export const ACADEMY_MOTTO = "Build Realistic Modern Apps by Chatting with AI";
export const academyLabTracks = TRAINING_TRACKS.map((track) => ({
  id: track.id,
  title: track.title,
  subtitle: track.subtitle,
  outcome: track.outcome,
  labCount: TRAINING_LABS.filter((lab) => lab.trackId === track.id).length,
}));
const mapping: Record<string, TrainingTrackId> = {
  foundation: "software-engineering", frontend: "fullstack-web",
  "backend-data": "fullstack-web", "auth-security": "software-engineering",
  "integrations-ai": "fullstack-web", "testing-devops": "software-engineering",
  "product-monetization": "systems-engineering", capstone: "fullstack-web",
};
export function academyTrackForModule(moduleId: string): TrainingTrackId {
  return mapping[moduleId] ?? "software-engineering";
}
export const academyLabUrl = (moduleId: string) => "/learn/labs?track=" + academyTrackForModule(moduleId);
export const academyStudioUrl = (moduleId: string) => "/learn/studio?track=" + academyTrackForModule(moduleId);

/** Linked source projects, NOT migrated course/learner data. */
export const academyCourseSources = [
  { name: "Full Stack Master Class", repo: "https://github.com/mabrig1/FULL-STACK-MASTER-CLASS", focus: "64-topic software engineering, AI, SaaS and technology entrepreneurship roadmap" },
  { name: "FINTIGEN Academy", repo: "https://github.com/mabrig1/Fintigen", focus: "AI, ML, data science and technology learning tracks" },
  { name: "LearnHub Academy", repo: "https://github.com/mabrig1/learnhub-academy-", focus: "Cybersecurity, machine learning, data analytics, cloud computing; some lesson-data files are stubs" },
  { name: "Destiny Skills Bridge", repo: "https://github.com/mabrig1/DDEI-APP", focus: "Digital skills, AI tutoring, portfolio and career preparation" },
  { name: "MABRIG AccessLearn", repo: "https://github.com/mabrig1/MABRIG-AccessLearn", focus: "Offline-first, accessible education and human-supervised AI prototype" },
  { name: "AI Course Assistant", repo: "https://github.com/mabrig1/AI-Course-Assistant", focus: "Expo mobile learning, offline storage and grounded AI prototypes" },
] as const;
export const academyAppExamples = [
  { name: "BuildRx AI App Builder", repo: "https://github.com/mabrig1/BuildRx", focus: "AI product specification, file editing, previews and releases" },
  { name: "APPTEST / BOSAL Store", repo: "https://github.com/mabrig1/APPTEST", focus: "Modern storefront demos, client proposals and test catalogues" },
  { name: "MABRIG StatLab", repo: "https://github.com/mabrig1/StatLab", focus: "Statistical software design and reproducible computation" },
  { name: "SafeKey Nigeria", repo: "https://github.com/mabrig1/SafeKey-Nigeria", focus: "User data protection, consent and evidence-based risk checks" },
  { name: "MABRIG AgentOS", repo: "https://github.com/mabrig1/MABRIG-AgentOS", focus: "Server-side AI agents, guarded integrations and Cloudflare architecture" },
] as const;
/** Reference index from FULL-STACK-MASTER-CLASS/lib/course.ts; NOT copied full lessons. */
export const masterclassPhases = [
  { name: "Developer Foundations", topics: ["Introduction to Software Development","Professional Developer Setup","HTML5 Master Class","CSS3 Master Class","Responsive UI & UX Design"] },
  { name: "JavaScript Engineering", topics: ["JavaScript Fundamentals","Advanced JavaScript","Data Structures & Algorithmic Thinking","Git & GitHub Master Class","TypeScript Master Class"] },
  { name: "Modern Frontend", topics: ["React Fundamentals","Advanced React","Next.js Master Class"] },
  { name: "Backend & Data", topics: ["Node.js Engineering","Express.js","REST API Engineering","Database Fundamentals","MongoDB Master Class","SQL & PostgreSQL Fundamentals"] },
  { name: "Security, Cloud & Commerce", topics: ["Authentication Systems","Role-Based Access Control","Web Application Security","File Upload Systems","Cloud Storage","Transactional Email","Notification Architecture","Payment Integration","Subscriptions & Billing"] },
  { name: "Production Engineering", topics: ["Admin Dashboard Engineering","Software Testing","Debugging Master Class","Production Deployment","Vercel Master Class","CI/CD","Domains & DNS"] },
  { name: "AI & Agentic Engineering", topics: ["Introduction to AI Applications","Building AI Chat Applications","Document AI","RAG Systems","AI Agents","Research Agents","Business Automation Agents"] },
  { name: "SaaS & System Architecture", topics: ["Real-Time Systems","Building SaaS Products","Multi-Tenant Systems","Usage Tracking","Software Architecture","Design Patterns","Performance Optimization","Observability"] },
  { name: "AI-Native Career Builder", topics: ["Progressive Web Applications","Professional Vibe Coding","AI Code Review","Developer Portfolio","Technical Interviews","Remote Work"] },
  { name: "Tech Entrepreneurship", topics: ["Finding Clients","Software Pricing","Client Management","From Idea to Startup","Software Monetization","Launching Digital Products","Agile Development","Software Documentation"] },
] as const;
export const masterclassTopicCount = masterclassPhases.reduce((sum,p) => sum + p.topics.length, 0);
