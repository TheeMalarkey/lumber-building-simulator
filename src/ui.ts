import { CATALOG, CATEGORIES, WOODS } from "./catalog";
export function icon(name: string) {
  const paths: Record<string, string> = {
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
    rotate: '<path d="M20 7a9 9 0 1 0 1 8M20 3v5h-5"/>',
    tilt: '<path d="m12 3 8 9-8 9-8-9Z"/><path d="M4 12h16"/>',
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
    focus:
      '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><circle cx="12" cy="12" r="3"/>',
    top: '<path d="m3 8 9-5 9 5-9 5ZM3 12l9 5 9-5M3 16l9 5 9-5"/>',
    orbit:
      '<ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-30 12 12)"/><circle cx="12" cy="12" r="3"/>',
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
<div class="view-controls">${button("home", "home", "Home view")}${button("top", "top", "Top view")}${button("focus", "focus", "Focus selection (F)")}${button("grid", "grid", "Toggle grid", "active")}${button("orbit-tool", "orbit", "Orbit camera (O)")}</div>
<div class="placement-bar" id="placement-bar" hidden><strong id="placing-name"></strong><span>Click to place</span><span><kbd>R</kbd> Rotate</span><span><kbd>T</kbd> Tilt</span><span><kbd>Esc</kbd> Cancel</span></div>
<div id="camera-hint" hidden></div><div id="toast" role="status"></div>
</section>
<div class="hud-corner"><button id="menu-tool" aria-label="Project menu" class="hud-tool" aria-expanded="false" aria-controls="project-menu">${icon("cube")}<strong>TIMBER</strong>${icon("chevron")}</button><span id="save-state" class="save-state">Local workspace</span></div>
<aside id="project-menu" class="hud-panel project-menu" aria-label="Project menu" hidden>
<label class="project-label" for="project-name">PROJECT</label><input id="project-name" aria-label="Project name" maxlength="120" value="Woodland studio">
<div class="menu-actions">${tool("save","save","Save project")}${tool("export","download","Export project")}${tool("import","upload","Import project")}${tool("new","plus","New project")}</div>
<div class="menu-actions">${tool("settings","settings","View settings")}${tool("help","help","Controls & about","H")}</div>
<div class="menu-stats"><span id="mode-label">Select mode</span><span id="draw-calls">— draw calls</span><span id="scene-label">Creative workspace</span></div>
</aside>
<aside id="build-panel" class="catalog-panel hud-panel" aria-label="Blueprint library" hidden>
<div class="catalog-heading"><h1>Blueprints <span id="catalog-total">69</span></h1>${button("collapse","close","Close blueprint library")}</div>
<label class="search">${icon("search")}<input id="search" placeholder="Find a building piece…" autocomplete="off" aria-label="Search building pieces"><kbd>/</kbd></label>
<nav id="categories" aria-label="Blueprint categories">${CATEGORIES.map((c,i)=>`<button data-category="${c}" class="category ${i===0?"active":""}">${c==="All pieces"?"All":c}</button>`).join("")}</nav>
<div class="library-caption"><span id="results-count">69 blueprints</span><span>SELECT TO BUILD</span></div><div id="catalog" class="catalog-grid"></div>
</aside>
<aside id="edit-panel" class="inspector hud-panel" aria-label="Blueprint controls" hidden>
<div class="piece-summary"><img id="piece-preview" alt="Selected blueprint preview"><div><span id="piece-category"></span><h3 id="piece-name"></h3><span id="piece-size"></span></div>${button("close-edit","close","Cancel or deselect (Escape)")}</div>
<div class="wood-picker"><button id="wood-toggle" aria-expanded="false" aria-controls="woods"><i id="wood-color"></i><span id="wood-name">Oak</span><span class="wood-caption">Wood</span>${icon("chevron")}</button><div id="woods" class="wood-swatches" aria-label="Wood finishes" hidden>${WOODS.map((w,i)=>`<button data-wood="${w.id}" class="wood-swatch ${i===0?"active":""}" style="--wood:${w.color}" title="${w.name}" aria-label="${w.name} wood finish">${icon("check")}</button>`).join("")}</div></div>
<div class="rotate-buttons"><button id="rotate">${icon("rotate")} Rotate <kbd>R</kbd></button><button id="tilt">${icon("tilt")} Tilt <kbd>T</kbd></button></div>
<label class="setting-row" id="elevation-row"><span>Elevation</span><input id="elevation" type="number" value="0" step="1" aria-label="Build elevation"><span id="snap">1 stud</span></label>
<section id="transform-section" hidden><div class="coordinates">${["X","Y","Z"].map((a,i)=>`<label>${a}<input id="pos-${i}" type="number" step="1" aria-label="Position ${a}"></label>`).join("")}</div></section>
<div id="selection-actions"><button id="place-selected" class="primary-btn">${icon("plus")} Place blueprint</button>${button("duplicate-tool","copy","Duplicate (Ctrl+D)")}${button("delete-tool","trash","Delete selection (Delete)")}</div>
</aside>
<nav class="build-toolbar" aria-label="Building tools">${tool("build-tool","cube","Build","B")}${tool("select-tool","arrow","Select","V")}${tool("move-tool","move","Move","G")}<i></i>${tool("land-tool","grid","Land")}${tool("walk-tool","walk","Walk","C")}<i></i>${button("undo","undo","Undo (Ctrl+Z)")}${button("redo","redo","Redo (Ctrl+Shift+Z)")}</nav>
<div class="hud-status"><span id="piece-count">0 pieces</span><span id="plot-status">1 / 25 plots</span></div><span id="fps" class="hud-fps">— FPS</span>
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
) {
  const items = CATALOG.filter(
    (c) =>
      (category === "All pieces" || c.category === category) &&
      c.name.toLowerCase().includes(search.toLowerCase()),
  );
  document.querySelector("#results-count")!.textContent =
    `${items.length} blueprint${items.length === 1 ? "" : "s"}`;
  document.querySelector("#catalog")!.innerHTML = items.length
    ? items
        .map(
          (c) =>
            `<button class="catalog-card ${c.id === selected ? "selected" : ""}" data-item="${c.id}" title="${c.name} · ${c.size.join(" × ")} studs"><div class="card-image"><img loading="lazy" src="${thumbnails.get(c.id)}" alt=""><span class="card-add">+</span></div><span class="card-name">${c.name}</span><span class="card-size">${c.size.join(" × ")}</span></button>`,
        )
        .join("")
    : '<div class="empty-results">No pieces found.<br>Try a different name.</div>';
}
