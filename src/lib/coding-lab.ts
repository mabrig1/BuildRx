/** The existing owner-private Site. Linking here does not widen its access. */
export const codingLab = {
  href: "/lab",
  privateUrl: "https://buildrx-private-coding-lab.mabrig.chatgpt.site",
  modules: [
    { title: "Write and run real code", detail: "Five editable HTML, CSS, JavaScript, data and async exercises with executable checks." },
    { title: "Save a working version", detail: "A Git practice terminal, source checkpoints and a runnable project ZIP." },
    { title: "Choose your deployment path", detail: "Separate GitHub-to-Vercel and GitHub-to-Cloudflare Pages readiness checks." },
    { title: "Troubleshoot and recover", detail: "Provider-budget diagnosis, a broken-release drill and known-good rollback practice." },
  ],
} as const;
