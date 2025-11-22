# Zork I Web Terminal

Play the classic Zork I directly in your browser with a Vite-powered CRT terminal UI and an in-page Z-machine interpreter (ifvms). No plugins or server code required—just open the page and start exploring the Great Underground Empire.

## Features
- Authentic green-phosphor CRT styling with scanlines and power-on animation
- In-browser Z-machine interpreter backed by `ifvms` (no downloads)
- Command history with arrow key navigation and click-to-focus input
- Save/restore handled via the browser (use the in-game `save`/`restore` commands)

## Quick start
1. Install dependencies: `npm install`
2. Run the dev server: `npm run dev` (Vite will print the local URL, usually `http://localhost:5173`)
3. Build for production: `npm run build` (outputs to `dist/`)
4. Preview the build locally: `npm run preview`

You can host the contents of `dist/` on any static server.

## Gameplay tips
- Use standard Zork commands (`look`, `inventory`, `north`, `take lamp`, etc.).
- `save` and `restore` work in the browser and persist via local storage.
- The input field auto-focuses; click anywhere in the terminal if focus is lost. Navigate command history with the up/down arrows.

## Project layout
- `index.html` — single-page shell for the terminal UI
- `css/terminal.css` — CRT styling, scanlines, glow, and responsive tweaks
- `js/main.js` — terminal wiring, history handling, and VM bootstrap
- `js/glk-adapter.js` — minimal Glk bridge that connects `ifvms` to the terminal
- `public/zork1.z3` — bundled Zork I story file loaded by the interpreter
