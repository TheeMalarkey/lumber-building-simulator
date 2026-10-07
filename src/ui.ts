import { CATALOG, CATEGORIES, WOODS } from "./catalog";
const WIRE_TOOLS = [
  { kind: "wire", name: "Wire", limit: 20 },
  { kind: "neon", name: "Neon Wire", limit: 16 },
] as const;
const catalogTotal = CATALOG.length + WIRE_TOOLS.length;
export function icon(name: string) {
  const paths: Record<string, string> = {
    wire: '<circle cx="4" cy="6" r="2"/><circle cx="20" cy="18" r="2"/><path d="M6 6h6v12h6"/>',
    cube: '<path d="m12 3 9 5v8l-9 5-9-5V8Z"/><path d="m3 8 9 5 9-5M12 13v8M7.5 5.5l9 5"/>',
    arrow: '<path d="m5 3 15 9-7 2-3 7Z"/>',
    move: '<path d="M12 3v18M3 12h18m-12-6 3-3 3 3m-6 12 3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
    trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
    undo: '<path d="M3 10h11a6 6 0 0 1 0 12M3 10l5-5m-5 5 5 5" transform="translate(0,-3)"/>',
    redo: '<path d="M21 7H10a6 6 0 0 0 0 12M21 7l-5-5m5 5-5 5"/>',
    save: '<path d="M5 3h12l4 4v14H3V3h2Z"/><path d="M7 3v6h10V3M7 21v-8h10v8"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
    chevron: '<path d="m8 10 4 4 4-4"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-3.7c-.8-.5-.5-1.8.5-1.8H17a4 4 0 0 0 4-4c0-5-4-8.5-9-8.5Z"/><circle cx="7.5" cy="10" r=".9"/><circle cx="10" cy="6.8" r=".9"/><circle cx="14.2" cy="6.8" r=".9"/><circle cx="17" cy="10" r=".9"/>',
    left: '<path d="m14 5-7 7 7 7"/>',
    right: '<path d="m10 5 7 7-7 7"/>',
    forward: '<path d="m5 14 7-7 7 7"/>',
    back: '<path d="m5 10 7 7 7-7"/>',
    up: '<path d="M12 17V3m-5 5 5-5 5 5M4 21h16"/>',
    down: '<path d="M12 3v14m-5-5 5 5 5-5M4 21h16"/>',
    grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18m6-18v18M3 9h18M3 15h18"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    walk: '<circle cx="13" cy="4" r="2"/><path d="m10 9 3-2 3 5 4 1M5 13l4-4 3 5-3 7m3-7 4 6M13 7l-1 7"/>',
    home: '<path d="m3 10 9-7 9 7v11h-7v-7h-4v7H3Z"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3h.01"/>',
    settings:
      '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    leaf: '<path d="M20 3C7 2 2 7 5 15s17 5 15-12ZM5 20 16 9"/>',
    panel:
      '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    folder: '<path d="M3 6h7l2 3h9v12H3Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.cube}</svg>`;
}
const button = (id: string, ico: string, title: string, extra = "") =>
  `<button id="${id}" class="icon-btn ${extra}" title="${title}" aria-label="${title}">${icon(ico)}</button>`;
export function shell() {
  const tool = (id: string, ico: string, label: string, key = "") => `<button id="${id}" class="hud-tool" title="${label}${key ? ` (${key})` : ""}">${icon(ico)}<span>${label}</span>${key ? `<kbd>${key}</kbd>` : ""}</button>`;
  return `
<main class="workspace game-hud">
<section class="viewport" id="viewport" aria-label="Building world">
<div class="view-controls" role="toolbar" aria-label="World controls">${button("home", "home", "Home view")}${button("walk-tool", "walk", "Switch to walk camera (C)", "camera-toggle")}${button("land-tool", "grid", "Land")}${button("undo", "undo", "Undo (Ctrl+Z)")}${button("redo", "redo", "Redo (Ctrl+Shift+Z)")}</div>
<div class="placement-bar" id="placement-bar" hidden><strong id="placing-name"></strong><span id="placing-instruction">Click to place · Drag a straight run</span><span id="placement-rotate"><kbd>R</kbd> Rotate</span><span id="placement-tilt"><kbd>T</kbd> Tilt</span><span id="placing-hold"><kbd>L</kbd> Hold</span><span><kbd>Esc</kbd> Cancel</span></div>
<div id="selection-marquee" hidden aria-hidden="true"></div>
<div id="logic-hover" role="status" hidden><kbd>E</kbd><span id="logic-hover-click" hidden>or click</span><span id="logic-hover-label"></span></div>
<div id="camera-hint" hidden></div><div id="toast" role="status"></div>
</section>
<div class="hud-corner"><button id="menu-tool" aria-label="Project menu" class="hud-tool" aria-expanded="false" aria-controls="project-menu">${icon("cube")}<strong>TIMBER</strong>${icon("chevron")}</button><span id="save-state" class="save-state">Local workspace</span></div>
<aside id="project-menu" class="hud-panel project-menu" aria-label="Project menu" hidden>
<label class="project-label" for="project-name">PROJECT</label><input id="project-name" aria-label="Project name" maxlength="120" value="Woodland studio">
<div class="menu-actions">${tool("save","save","Save project")}${tool("export","download","Export project")}${tool("import","upload","Import project")}${tool("new","plus","New project")}${tool("example","home","Workshop example")}</div>
<div class="menu-actions">${tool("settings","settings","View settings")}${tool("help","help","Controls & about","H")}</div>
<div class="menu-stats"><span id="mode-label">Select mode</span><span id="draw-calls">— draw calls</span><span id="scene-label">Creative workspace</span></div>
</aside>
<aside id="build-panel" class="catalog-panel hud-panel" aria-label="Blueprint library" hidden>
<div class="catalog-heading"><label class="search">${icon("search")}<input id="search" placeholder="Search items…" autocomplete="off" aria-label="Search building pieces"></label><span id="results-count" role="status">${catalogTotal} items</span>${button("collapse","close","Close blueprint library")}</div>
<nav id="categories" aria-label="Blueprint categories">${CATEGORIES.map((c,i)=>`<button data-category="${c}" class="category ${i===0?"active":""}">${c==="All pieces"?"All":c}</button>`).join("")}</nav>
<div id="catalog" class="catalog-grid"></div>
</aside>
<aside id="edit-panel" class="inspector hud-panel" aria-label="Blueprint controls" hidden>
<div class="piece-summary"><img id="piece-preview" alt="Selected blueprint preview"><div class="piece-caption"><span id="piece-category"></span><h3 id="piece-name"></h3><span id="piece-size"></span></div><div class="wood-picker" id="wood-picker"><button id="wood-toggle" class="icon-btn" aria-label="Wood finish: Oak" title="Wood finish: Oak" aria-expanded="false" aria-controls="woods">${icon("palette")}</button></div>${button("close-edit","close","Cancel or deselect (Escape)")}</div>
<div class="inspector-body">
<div id="woods" class="wood-swatches" aria-label="Wood finishes" hidden>${WOODS.map((w,i)=>`<button data-wood="${w.id}" class="wood-swatch ${i===0?"active":""}" style="--wood:${w.color}" aria-label="${w.name} wood finish">${icon("check")}</button>`).join("")}</div>
<section id="logic-controls" hidden><p id="logic-status" class="nudge-hint" role="status"></p><button id="logic-action" class="primary-btn">Switch on</button><label id="logic-timer-row" class="setting-row"><span>Timing</span><select id="logic-timing" aria-label="Timer setting">${Array.from({length:12},(_,i)=>`<option value="${i+1}">Setting ${i+1}</option>`).join('')}</select></label><span class="nudge-hint">Wire from socket</span><div id="logic-ports" class="logic-ports"></div></section>
<label id="light-controls" class="setting-row" hidden><span id="light-label">Light on</span><input id="light-toggle" type="checkbox" aria-label="Selected lights on"></label>
<label class="setting-row overlap-option" title="Allow blueprints to intersect while keeping ground and active-land boundaries"><span>Allow overlaps</span><input id="overlap-toggle" type="checkbox" aria-label="Allow blueprint overlaps"></label>
<label class="setting-row axis-copy-option" id="axis-copy-row" hidden title="Create a copy when you release an X, Y or Z arrow drag"><span>Copy with arrows</span><input id="axis-copy-toggle" type="checkbox" aria-label="Copy selection with axis arrows"></label>
<section id="path-controls" hidden>
<p id="path-status" role="status" hidden></p>
<div id="path-actions" hidden><button id="path-build" class="primary-btn">Build run</button><button id="path-cancel" title="Cancel run (Escape)">Cancel</button></div>
</section>
<div id="preview-controls"><button id="hold-position" aria-pressed="false">Hold position (L)</button><button id="commit-preview" class="primary-btn" hidden>Place here</button></div>
</div>
<div id="selection-footer" class="selection-footer" hidden><section id="transform-section" hidden><div id="nudge-buttons" class="nudge-buttons" role="group" aria-label="Move held placement by one stud">${["left","up","forward","right","down","back"].map(d=>`<button data-nudge="${d}" title="Move ${d} one stud" aria-label="Move ${d} one stud">${icon(d)}</button>`).join("")}</div></section><div id="selection-actions">${button("duplicate-tool","copy","Duplicate (Ctrl+D)")}${button("delete-tool","trash","Delete selection (Delete)")}</div></div>
</aside>
<nav class="build-toolbar" aria-label="Building tools">${tool("build-tool","cube","Build","B")}${tool("select-tool","arrow","Select","V")}${tool("move-tool","move","Move","G")}</nav>
<aside id="wire-selection-panel" class="hud-panel" hidden aria-label="Selected wires"><div class="wire-selection-body"><strong id="wire-selection-name"></strong><p id="wire-selection-length"></p><div class="wire-actions"><button id="move-wires">Move</button><button id="copy-wires">Duplicate</button><button id="delete-wire">Delete wire</button><button id="close-wire-selection">Done</button></div><label class="setting-row axis-copy-option"><span>Copy with arrows</span><input id="wire-axis-copy-toggle" type="checkbox" aria-label="Copy wires with axis arrows"></label></div></aside>
<aside id="wiring-panel" class="hud-panel" hidden aria-label="Wire placement">
<div class="wire-types" role="group" aria-label="Wire type"><button data-wire-kind="wire" aria-pressed="true">Wire <small>20 studs</small></button><button data-wire-kind="neon" aria-pressed="false">Neon <small>16 studs</small></button></div>
<div id="wire-colors" role="group" aria-label="Neon color" hidden></div>
<strong id="wire-status"></strong><div class="wire-meter"><span id="wire-length">0 / 20 studs</span><progress id="wire-budget" max="20" value="0" aria-label="Wire length used"></progress></div>
<p id="wire-feedback" aria-live="polite"></p><p>Click a surface to start or add a bend. Click a socket or wire to finish. <b>Only touching end caps share power.</b> <b>Shift-click a wire</b> to bend over it and keep building. <b>Enter</b> finishes at the last point. <b>Backspace</b> undoes a point · <b>Esc</b> cancels. In <b>Select</b>, Ctrl-click or Ctrl-drag groups of wires and blueprints to move, copy or delete them.</p>
<div class="wire-actions"><button id="wire-finish" disabled>Finish wire</button><button id="wire-done">Done</button><button id="wire-remove" hidden>Delete selected wire</button></div><p id="wire-count"></p></aside>
<div class="hud-status"><span id="selection-count" hidden aria-live="polite"></span><span id="piece-count">0 pieces</span><span id="plot-status">1 / 25 plots</span></div><span id="fps" class="hud-fps">— FPS</span>
<div id="wood-tooltip" role="tooltip" hidden></div>
<div id="welcome-note" hidden><button id="blank-start">Start a new build</button><button id="dismiss-welcome">Dismiss</button></div>
</main>
<input id="file-input" type="file" accept=".timber,.json" hidden>
<dialog id="modal"><div id="modal-content"></div></dialog>`;
}
export function renderCatalog(
  thumbnails: Map<string, string>,
  category: string,
  search: string,
  selected: string,
  selectedWire: "wire" | "neon" | null = null,
) {
  const items = CATALOG.filter(
    (c) =>
      (category === "All pieces" || c.category === category) &&
      c.name.toLowerCase().includes(search.toLowerCase()),
  );
  const wires = WIRE_TOOLS.filter(w => (category === "All pieces" || category === "Wires") && w.name.toLowerCase().includes(search.toLowerCase()));
  const count = items.length + wires.length;
  document.querySelector("#results-count")!.textContent = `${count} item${count === 1 ? "" : "s"}`;
  document.querySelector("#catalog")!.innerHTML = count
    ? items
        .map(
          (c) =>
            `<button class="catalog-card ${c.id === selected ? "selected" : ""}" data-item="${c.id}" title="${c.name} · ${c.dimensionsEstimated ? 'Estimated dimensions: ' : ''}${c.size.join(" × ")} studs"><div class="card-image"><img loading="lazy" src="${thumbnails.get(c.id)}" alt=""><span class="card-add">+</span></div><span class="card-name">${c.name}</span><span class="card-size">${c.dimensionsEstimated ? '≈ ' : ''}${c.size.join(" × ")}</span></button>`,
        )
        .join("") + wires.map(w => `<button class="catalog-card wire-card ${selectedWire === w.kind ? "selected" : ""}" data-wire-item="${w.kind}" title="${w.name} · ${w.limit} studs per wire"><div class="card-image"><svg viewBox="0 0 140 80" aria-hidden="true"><path d="M28 58h34V25h49" fill="none" stroke="${w.kind === "neon" ? "#f5f5f5" : "#59727c"}" stroke-width="${w.kind === "neon" ? 7 : 5}"/><path d="M28 58h6m72-33h6" stroke="${w.kind === "neon" ? "#d6d6d6" : "#7d939d"}" stroke-width="${w.kind === "neon" ? 11 : 9}"/></svg><span class="card-add">+</span></div><span class="card-name">${w.name}</span><span class="card-size">${w.limit} studs per wire</span></button>`).join("")
    : '<div class="empty-results">No pieces found.<br>Try a different name.</div>';
}
