interface CatalogLayout { x: number; y: number; width: number; height: number }
type EditKind = "move" | "resize";
interface PanelGesture {
  kind: EditKind;
  control: HTMLElement;
  pointer: number;
  start: [number, number];
  initial: CatalogLayout;
  previous: CatalogLayout | null;
  changed: boolean;
}

const STORAGE_KEY = "timber-catalog-layout";
const GEOMETRY = ["position", "left", "top", "right", "bottom", "width", "height"] as const;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Local UI geometry only: no renderer or project state enters the saved layout. */
export function initFloatingCatalog(panel: HTMLElement): () => void {
  const move = panel.querySelector<HTMLElement>("#catalog-move");
  const resize = panel.querySelector<HTMLElement>("#catalog-resize");
  if (!move || !resize) return () => {};
  const events = new AbortController();
  const initialStyles = GEOMETRY.map(property => [property, panel.style.getPropertyValue(property)] as const);
  let preferred: CatalogLayout | null = null;
  let gesture: PanelGesture | null = null;

  const viewport = () => {
    const width = Math.max(1, document.documentElement.clientWidth || innerWidth);
    const height = Math.max(1, innerHeight);
    const margin = Math.min(8, width / 4, height / 4);
    return { width, height, margin };
  };
  const bounded = (layout: CatalogLayout): CatalogLayout => {
    const view = viewport(), availableWidth = view.width - view.margin * 2, availableHeight = view.height - view.margin * 2;
    const width = clamp(layout.width, Math.min(280, availableWidth), availableWidth);
    const height = clamp(layout.height, Math.min(220, availableHeight), availableHeight);
    return {
      x: clamp(layout.x, view.margin, view.width - view.margin - width),
      y: clamp(layout.y, view.margin, view.height - view.margin - height),
      width, height,
    };
  };
  const current = (): CatalogLayout => {
    const bounds = panel.getBoundingClientRect();
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
  };
  const render = () => {
    if (!preferred) {
      for (const [property, value] of initialStyles)
        if (value) panel.style.setProperty(property, value); else panel.style.removeProperty(property);
      delete panel.dataset.floatingLayout;
      return;
    }
    const layout = bounded(preferred);
    panel.style.position = "absolute";
    panel.style.left = `${layout.x}px`;
    panel.style.top = `${layout.y}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    panel.style.width = `${layout.width}px`;
    panel.style.height = `${layout.height}px`;
    panel.dataset.floatingLayout = "custom";
  };
  const save = () => {
    try { if (preferred) localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...preferred })); }
    catch { /* Layout remains available for this session when storage is unavailable. */ }
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved?.version === 1 && [saved.x, saved.y, saved.width, saved.height].every(value => typeof value === "number" && Number.isFinite(value)) && saved.width > 0 && saved.height > 0)
      preferred = { x: saved.x, y: saved.y, width: saved.width, height: saved.height };
  } catch { /* Invalid or unavailable preferences keep the original responsive layout. */ }
  render();

  const edit = (kind: EditKind, initial: CatalogLayout, dx: number, dy: number) => {
    if (kind === "move") preferred = bounded({ ...initial, x: initial.x + dx, y: initial.y + dy });
    else {
      const view = viewport();
      const maximumWidth = view.width - view.margin - initial.x, maximumHeight = view.height - view.margin - initial.y;
      preferred = bounded({ ...initial,
        width: clamp(initial.width + dx, Math.min(280, maximumWidth), maximumWidth),
        height: clamp(initial.height + dy, Math.min(220, maximumHeight), maximumHeight),
      });
    }
    render();
  };
  const finish = (commit: boolean) => {
    const active = gesture; gesture = null;
    if (!active) return;
    panel.classList.remove("catalog-adjusting");
    if (!commit) { preferred = active.previous; render(); }
    else if (active.changed) save();
    if (active.control.hasPointerCapture(active.pointer)) active.control.releasePointerCapture(active.pointer);
  };
  const consume = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); };
  for (const [control, kind] of [[move, "move"], [resize, "resize"]] as const) {
    control.addEventListener("pointerdown", event => {
      if (event.button !== 0 || gesture) return;
      consume(event);
      gesture = { kind, control, pointer: event.pointerId, start: [event.clientX, event.clientY], initial: current(), previous: preferred && { ...preferred }, changed: false };
      control.focus({ preventScroll: true });
      control.setPointerCapture(event.pointerId);
      panel.classList.add("catalog-adjusting");
    }, { signal: events.signal });
    control.addEventListener("pointermove", event => {
      if (!gesture || event.pointerId !== gesture.pointer) return;
      consume(event);
      const dx = event.clientX - gesture.start[0], dy = event.clientY - gesture.start[1];
      if (!dx && !dy && !gesture.changed) return;
      gesture.changed = true;
      edit(gesture.kind, gesture.initial, dx, dy);
    }, { signal: events.signal });
    control.addEventListener("pointerup", event => {
      if (!gesture || event.pointerId !== gesture.pointer || event.button !== 0) return;
      consume(event);
      const dx = event.clientX - gesture.start[0], dy = event.clientY - gesture.start[1];
      if (dx || dy || gesture.changed) { gesture.changed = true; edit(gesture.kind, gesture.initial, dx, dy); }
      finish(true);
    }, { signal: events.signal });
    control.addEventListener("pointercancel", event => { if (gesture?.pointer === event.pointerId) { consume(event); finish(false); } }, { signal: events.signal });
    control.addEventListener("lostpointercapture", event => { if (gesture?.pointer === event.pointerId) finish(false); }, { signal: events.signal });
    control.addEventListener("keydown", event => {
      if (event.code === "Escape" && gesture) { consume(event); finish(false); return; }
      const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      const direction = directions[event.code]; if (!direction) return;
      consume(event); finish(false);
      const step = event.shiftKey ? 32 : 8;
      edit(kind, current(), direction[0] * step, direction[1] * step); save();
    }, { signal: events.signal });
  }
  const fit = () => { finish(false); render(); };
  window.addEventListener("resize", fit, { signal: events.signal });
  window.addEventListener("blur", () => finish(false), { signal: events.signal });
  const visibility = new MutationObserver(() => { if (panel.hidden) finish(false); });
  visibility.observe(panel, { attributes: true, attributeFilter: ["hidden"] });
  document.addEventListener("visibilitychange", () => { if (document.hidden) finish(false); }, { signal: events.signal });
  return () => { finish(false); events.abort(); visibility.disconnect(); };
}
