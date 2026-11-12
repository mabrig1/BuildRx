# BuildRx Project Studio: executable starter ZIPs (Nov 2026)

This upgrade extends the opt-in React preview in PR #58 and the multi-file editor in PR #57. It focuses on making **exported learning materials useful outside BuildRx** without executing student code on BuildRx's servers.

## Supported ZIP types

| Training track | ZIP contents | Actual supported next step | Not included |
| --- | --- | --- | --- |
| Full-stack web | Edited Next.js pages, reviewed root layout/CSS, `package.json`, `tsconfig.json`, `.gitignore`, teaching README | Locally run `npm install`, `npm run typecheck`, `npm run dev`; visit `http://localhost:3000` | Auth, database, bookings, validated deployment |
| Software engineering | Edited TypeScript + Vitest files, minimal reviewed package/tsconfig, ignore file, README | `npm install`, `npm run typecheck`, `npm test` locally | UI/backend/real user authorization |
| Mobile apps | Student-edited Expo Router screen and instructions | Install a **fresh current Expo project**, then copy the screen and run using its matching Expo SDK | Standalone installable Expo project, APK/IPA, device verification |
| Systems engineering | OpenAPI design and architecture documents | Validate contract and add missing security/failure schemas using an external trusted validator | A server implementation |

The web starter uses the reviewed BuildRx application dependency baseline (Next.js 15.5.20, React 19.1.0). The TypeScript test starter uses Vitest 4.1.10. These versions must be reviewed and updated responsibly as new security advisories or framework upgrades emerge.

**BuildRx does not run npm, import these packages onto GitHub, create a live app, or verify user-edited ZIPs.** Actual local install, compilation, and functional testing are still required. The web package displays a frontend skeleton and is not a production booking platform.

## Download safety

- Only the selected local workspace's source files are exported, with generated reviewed configuration and a `README-TRAINING.md` describing the exact next actions.
- No HTTP requests, server-side execution, package installation or deployment happens during the packaging operation.
- The existing strict project validator rejects traversal, unexpected extensions, oversized content and recognizable credentials.
- The export refuses to silently overwrite students' own `package.json`, `tsconfig.json`, `src/app/layout.tsx`, or generated style paths. Students can rename/remove conflicting files and retry.
- The generated `.gitignore` excludes `.env`, local framework output and dependencies. It is never a substitute for secret scanning.
- A lockfile is intentionally absent: first `npm install` generates a lockfile locally. Reproducible release work should review and commit that lockfile after dependency review.

## Verified in automated tests

- Each training track produces the correct ZIP file manifest with a clear category and instructions.
- Web package manifest scripts and pinned framework versions, TypeScript Next.js configuration, and TS/TSX source parse checks.
- TypeScript/Vitest scripts and test sources.
- No fake package manifest for mobile/system design overlays.
- Secrets, reserved filename collisions and missing required entrypoints reject export.
- No self-assessed lab status is converted into verified production status.

**Limitations:** Tests inspect the package and parse TypeScript syntax, but **do not perform npm installs or actual framework builds** of these exported packages. A future sandboxed starter-export CI fixture could build the exact output and report signed evidence; that is separate from shipping a local ZIP.

## Beginner acceptance walkthrough

1. Sign in and navigate to `/learn/studio?track=fullstack-web`.
2. Edit `src/app/page.tsx` and keep `src/app/book/page.tsx`.
3. Review the stack-specific next steps and download the training ZIP.
4. Unzip on your **own machine**, verify `package.json`, `tsconfig.json`, root `layout.tsx`, and README.
5. Review dependencies and run `npm install` followed by `npm run typecheck` and `npm run dev`.
6. Use the Next.js app at `http://localhost:3000` as a learning skeleton. Do **not** assert that bookings or persistent storage work.
7. To progress to GitHub → Cloudflare/Vercel, first implement/tests real backend requirements and use BuildRx's guided launch flow.

Do not paste or upload real API keys, customer information or secret .env files into learning tools.
