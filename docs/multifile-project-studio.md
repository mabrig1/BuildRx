# BuildRx Multi-file Project Studio — safe training workspace

This PR builds on the interactive coding lab in PR #56, the Knowledge Center in PR #55 and the beginner launch flow in PR #54.

## Browser-only studio: /learn/studio

- Four reviewed starter kits: TypeScript/Vitest issues, OpenAPI system design, Next.js App Router, React Native/Expo.
- File navigator, simple text editing (default), and locally bundled Monaco syntax editor on demand.
- Add/delete safe relative source files: max 16 files, 16,000 characters each, 120,000 project characters.
- Autosave locally per training track, reset to reviewed starter, JSON backup and local restore.
- Export source ZIP with a training README using BuildRx's existing JSZip package.
- Strict paths disallow traversal, hidden .env files, build output and unexpected extensions.
- Credential detection prevents autosave and export until tokens/private connection strings are removed.
- Honest structural diagnostics identify file presence and likely next steps. They do not certify or execute source.
- Links to real isolated small JavaScript coding challenges, full workshops, and the GitHub/deployment guide.

## Security boundaries and limitations

The Studio does not execute source, install npm packages, run Vitest, compile Node/Next.js/Expo, create GitHub repositories, deploy apps, or issue course certificates. The ZIP contains *training snippets* and requires a real local framework/project with its dependencies.

Monaco uses the existing locally bundled setupMonaco and is opt-in so beginner mobile devices can use the plain textarea.

JSON imports use strict shape, track, size, content and relative filename checks before they are stored; imported code is never executed. ZIP exports contain only permitted files plus a short README. Backups are local to the browser and can be evicted or lost.

The isolated single-function JavaScript runner continues to live at /learn/playground, separate from this multi-file editor. Future full-stack execution requires properly isolated tenant sandboxes, CPU/memory/time budgets, egress controls, strict file system permissions and audited evidence.

## Verification

Automated tests cover starter copies, path traversal, hidden secret file rejection, bounded source sizes and file counts, wrong-track import, credential detection, immutable updates and honest diagnostic classifications.

Before release, confirm lint, TypeScript, tests, build, generated app certification and DevShield. Also perform manual mobile (320px), browser storage disabled/full, Monaco loading, JSON import and ZIP inspection checks.
