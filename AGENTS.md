<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Mobile-first rule (ALWAYS verify before any release/update)

Every change that touches UI MUST be checked for mobile fit before committing/pushing. The site is used primarily on phones.

Checklist for any UI change:
- New/changed layouts must collapse to a single column on mobile (use existing `.m-grid-collapse`, `.m-page`, etc.)
- No horizontal overflow at 360px / 480px / 768px widths (`body` has `overflow-x: hidden` — don't rely on it as a crutch)
- Touch targets ≥ ~40px; tap-critical buttons not crammed
- Inputs/textareas keep `font-size: 16px` on mobile (prevents iOS auto-zoom — already enforced globally)
- New components: add a class hook and matching rules in the mobile media queries in `app/globals.css` (breakpoints already structured: 900 → 768 → 480 → 360)
- Respect bottom nav: pages need bottom padding so content isn't hidden behind the fixed `.bottom-nav` (handled via `main` padding — verify new fixed/sticky elements don't collide)
- Modals: full-width with breathing room, scrollable, close button reachable with thumb
- Keep mobile sizing proportional to the rest of the page (don't oversize one section)

When finishing any task that changed UI, explicitly state that the mobile check was done and what was verified.
