# Separate Code + Preview workbench

This branch separates the **editable source code** from the **interactive
preview**. Earlier versions forced both into a single mutually exclusive tab.

## Desktop (>= 1280px)

The workspace is **Chat | Code | Preview**. The right-hand workbench uses
Split mode by default; use the `Code` or `Preview` focus buttons for a
larger single pane. Drag the eight-pixel separator to resize or focus it and
press Left/Right, Home/End. Double-click resets the divider.

- Code and Preview stay mounted when switching focus, preserving Monaco
  context and the running preview.
- Pane mode and width are stored per project in local browser storage.
  Corrupt or blocked browser storage falls back safely to Split 54/46.
- The file explorer can be hidden for extra editor space.
- The preferred first file is `preview/index.html`, followed by
  `src/app/page.tsx`. Open other generated files from the explorer.
- Existing auto-save and `vfs-changed` refresh are preserved.

## Mobile / tablet (< 1280px)

A separate full-width, always-labelled navigation bar switches between
**Chat**, **Code**, and **Preview**. Nothing requires fitting three small
panes onto a mobile screen.

## Preview truthfulness

- **Instant** is an iframe of `preview/index.html` (self-contained HTML).
- **Sandpack** loads the same prototype source.
- Editing `preview/index.html` saves and refreshes the corresponding
  preview immediately.
- Editing `src/app/**`, APIs or schema saves **source code**, but does
  not magically rebuild the HTML prototype. The UI displays this fact.
- Use the existing **WebContainer** link to boot a real Next.js
  development server in a separate tab for source-level verification.

## Validation

1. Desktop: code and preview visible together. Switch focus then return;
   open file/editor state must remain.
2. Desktop: drag divider, use keyboard arrows and Home/End, double-click
   reset. Reload: selected mode and sane size are restored for the project.
3. Desktop: hide explorer; open it again. Check resizing at 1280px and
   1600px with no horizontal overflow.
4. Mobile: switch Chat -> Code -> Preview and rotate device. Navigation
   remains legible and interactive.
5. Edit `preview/index.html`; confirm auto-save, iframe refresh and
   retained cursor/scroll position in Monaco.
6. Edit a `src/app` file; confirm the truthful static-prototype notice
   and the WebContainer link. Do not claim a React rebuild happened.
7. Fail a save/network request: a visible error must be shown; no false
   saved confirmation.
8. Run `npm run lint`, `npm run typecheck`, `npm test`,
   `npm run build`. Check Vercel preview on an actual browser.

No production deployment, migrations, payments, secrets or cloud settings
were changed by this UI work.
