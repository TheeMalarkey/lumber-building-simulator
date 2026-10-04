import {LogicTools} from "./logic-tools";
import { Vector3 } from "three";
import { CATALOG, ITEMS, WOOD_MAP, type Vec3 } from "./catalog";
import { World, type Piece } from "./world";
import { Viewport } from "./renderer";
import {
  round,
  snapMovement,
  turnRotation,
} from "./placement";
import { shell, renderCatalog, icon } from "./ui";
import { createDemo, createBenchmark } from "./demo";
import { loadProject, saveProject } from "./storage";
import { parseProject, type Project } from "./project";
import { ALL_PLOTS, inferPlots } from "./plots";
import { pieceBounds } from "./world";
import { placeSelectionOnSurface, selectionBounds, selectInRectangle, translateSelection, rotateSelection } from "./selection";
import { snapBlueprintOnSurface } from "./collision";
import type { AxisDrag } from "./move-gizmo";
import { PathBuilder } from "./path-builder";
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id)! as T;
const BELOW_GROUND_MESSAGE = "No part of a blueprint can go below ground.";
const OUTSIDE_PLOTS_MESSAGE = "The entire blueprint must stay inside active plots. Expand your land first.";
export class Editor {
  world = new World();
  view: Viewport;
  paths: PathBuilder;
  logicTools:LogicTools;
  logicConfig:{logicOn?:boolean;timing?:number}={};
  thumbnails: Map<string, string>;
  item = "smooth-wall";
  wood = "oak";
  lightOn = true;
  rotation: Vec3 = [0, 0, 0];
  category = "All pieces";
  search = "";
  selection = new Set<string>();
  get selected(): string | null { return this.selection.values().next().value ?? null; }
  set selected(id: string | null) { this.selection.clear(); if (id) this.selection.add(id); }
  get selectedPieces(): Piece[] {
    return [...this.selection].map(id => this.world.pieces.get(id)).filter((p): p is Piece => !!p);
  }
  groupPlacement: { source: Piece[]; copy: boolean; ignore: Set<string> } | null = null;
  groupPreview: Piece[] = [];
  placing = false;
  moving: string | null = null;
  ghost: Piece | null = null;
  held = false;
  copyWithArrows = false;
  orbit = false;
  pointer: [number, number] | null = null;
  dirty = false;
  private toastTimer = 0;
  private saveTimer = 0;
  private saving = false;
  private saveAgain = false;
  private lastPointer = "";
  private initialized = false;
  private savedRevision = 0;
  private generation = 0;
  constructor() {
    $("app").innerHTML = shell();
    this.view = new Viewport($("viewport"), this.world);
    this.paths = new PathBuilder(this);
    this.logicTools=new LogicTools(this);
    this.thumbnails = this.view.thumbnails();
    this.catalog();
    this.inspect();
    this.bind();
    this.view.camera.onModeChange = () => this.updateCameraUI();
    this.updateCameraUI();
    this.world.onChange = () => {
      this.updateWorldUI();
      if (this.initialized) {
        this.dirty = true;
        $("save-state").textContent = "Unsaved changes";
        window.clearTimeout(this.saveTimer);
        this.saveTimer = window.setTimeout(() => this.save(), 1200);
      }
    };
    this.view.onStats = () => {
      $("fps").textContent = `${this.view.fps} FPS`;
      $("draw-calls").textContent = `${this.view.stats.drawCalls} draw calls`;
    };
    this.view.onFrame = () => {
      this.paths.tick();this.logicTools.tick();
      if (this.placing && this.pointer && !this.view.camera.flying) {
        const key =
          this.pointer.join(",") +
          this.view.camera.camera.position.toArray().join(",") +
          this.view.camera.camera.quaternion.toArray().join(",") +
          this.world.revision;
        if (key !== this.lastPointer) {
          this.lastPointer = key;
          this.updateGhost();
        }
      }
    };
  }
  async start() {
    const params = new URLSearchParams(location.search);
    const benchmark = Number(params.get("benchmark"));
    try {
      const saved = await loadProject();
      if (saved.project) {
        this.world.load(saved.project.pieces, saved.project.plots ?? [12],saved.project.wires??[]);
        $("project-name").setAttribute("value", saved.project.name);
        $("welcome-note").hidden = true;
        if (saved.recovered)
          this.toast("Recovered the previous saved project.");
      } else {
        this.world.load(createDemo(), [12]);
        $("save-state").textContent = "Editable example";
      }
    } catch (error) {
      this.world.load(createDemo(), [12]);
      this.toast(`Local save unavailable: ${(error as Error).message}`);
      $("save-state").textContent = "Export to keep your work";
    }
    if (benchmark > 0 && benchmark <= 100000) {
      this.world.load(createBenchmark(benchmark, params.has("mixed")));
      ($("project-name") as HTMLInputElement).value = "Performance scene";
      $("welcome-note").hidden = true;
      this.view.camera.focus(new Vector3(75, 4, 75), 140);
    }
    this.initialized = !benchmark;
    this.savedRevision = this.world.revision;
    this.view.sync(true);
    this.updateWorldUI();
  }
  get project(): Project {
    const pieces=[...this.world.pieces.values()];
    return {
      version: 1,
      name:
        ($("project-name") as HTMLInputElement).value.trim() ||
        "Untitled build",
      pieces,
      ...(pieces.some(p=>p.item==='lever')?{logicModelVersion:2 as const}:{}),
      plots: [...(this.world.plots ?? [12])],
      ...(this.world.wires.length?{wires:this.world.wires}:{}),
    };
  }
  toast(message: string) {
    $("toast").textContent = message;
    $("toast").classList.add("visible");
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(
      () => $("toast").classList.remove("visible"),
      4000,
    );
  }
  catalog() {
    renderCatalog(this.thumbnails, this.category, this.search, this.item);
  }
  panel(id: "build-panel" | "project-menu" | "woods", open: boolean) {
    const triggers = { "build-panel": "build-tool", "project-menu": "menu-tool", woods: "wood-toggle" };
    if (open) {
      for (const other of ["build-panel", "project-menu", "woods"] as const)
        if (other !== id) this.panel(other, false);
    }
    $(id).hidden = !open;
    $(triggers[id]).setAttribute("aria-expanded", String(open));
    $(triggers[id]).classList.toggle("active", open);
    if (id === "build-panel") {
      $("edit-panel").hidden = open || !(this.placing || this.selected);
      $("placement-bar").hidden = open || !this.placing;
    }
    if (open && id === "build-panel") $("search").focus();
    if (!open && $(id).contains(document.activeElement))
      this.view.renderer.domElement.focus({ preventScroll: true });
  }
  inspect() {
    const pieces = this.selectedPieces;
    const multi = pieces.length > 1;
    const finishPieces=this.groupPlacement
      ? this.groupPreview.length ? this.groupPreview : this.groupPlacement.source : pieces;
    const woodPieces=finishPieces.filter(p=>!ITEMS.get(p.item)!.fixedMaterial);
    const mixedWood=multi && new Set(woodPieces.map(p=>p.wood)).size>1;
    const p = this.selected ? this.world.pieces.get(this.selected) : null;
    if (p && !this.placing) {
      this.item = p.item;
      this.wood = p.wood;
      this.rotation = [...p.rotation];
    }
    $("edit-panel").hidden = !(p || this.placing) || !$("build-panel").hidden;
    $("selection-actions").hidden = !p || this.placing;
    $("elevation-row").hidden = !this.placing || this.held;
    $("preview-controls").hidden = !this.placing;
    $("hold-position").textContent = this.held ? "Release position (L)" : "Hold position (L)";
    $("hold-position").setAttribute("aria-pressed", String(this.held));
    $("commit-preview").hidden = !this.held;
    $("nudge-label").textContent = this.placing ? "Adjust preview · 1 stud" : this.copyWithArrows ? "Copy with arrows · 1 stud" : "Move selection · 1 stud";
    $("axis-copy-row").hidden=this.placing || !p;
    $<HTMLInputElement>("axis-copy-toggle").checked=this.copyWithArrows;
    $("axis-hint").innerHTML=this.copyWithArrows && !this.placing
      ? "Drag an X, Y or Z arrow to copy your selection.<br>Release to place; Esc cancels."
      : "Drag the X, Y or Z arrow on your selection.<br>Hold a placement with L to adjust it in the air.";
    $("step-buttons-details").querySelector("summary")!.textContent=this.copyWithArrows && !this.placing ? "Move step buttons" : "Step buttons";
    const displayedWood=multi ? woodPieces[0]?.wood ?? this.wood : this.wood;
    $("wood-color").style.background = mixedWood
      ? "linear-gradient(135deg, #d7c59a 50%, #694028 50%)" : WOOD_MAP.get(displayedWood)!.color;
    if (!(p || this.placing)) this.panel("woods", false);
    const item = ITEMS.get(this.item)!;
    ($("piece-preview") as HTMLImageElement).src = this.thumbnails.get(
      item.id,
    )!;
    $("piece-name").textContent = multi ? `${pieces.length} blueprints selected` : item.name;
    $("piece-size").textContent = multi ? "Rotate, tilt, move or finish together" : (item.dimensionsEstimated ? "≈ " : "") + item.size.join(" × ") + " studs";
    $("piece-category").textContent = multi ? "GROUP SELECTION" : item.category.toUpperCase();
    $("piece-preview").hidden = multi;
    const fixedFinish=multi ? !woodPieces.length : !!item.fixedMaterial;
    $("wood-picker").hidden = fixedFinish;
    const lights=pieces.filter(p=>ITEMS.get(p.item)!.fixedMaterial==='lighting');
    $("light-controls").hidden=this.placing || !lights.length;
    this.logicTools.inspect();
    if(fixedFinish) this.panel("woods",false);
    $("rotate-controls").hidden = false;
    $<HTMLInputElement>("overlap-toggle").checked=this.world.allowOverlaps;
    $("place-selected").hidden = multi;
    $("selection-hint").hidden = !multi;
    $("selection-count").hidden = !pieces.length;
    $("selection-count").textContent = `${pieces.length} selected`;
    $("wood-name").textContent = mixedWood ? "Mixed woods" : WOOD_MAP.get(displayedWood)!.name;
    document
      .querySelectorAll<HTMLElement>("[data-wood]")
      .forEach((b) =>
        b.classList.toggle("active", !mixedWood && b.dataset.wood === displayedWood),
      );
    $("transform-section").hidden = !(p || this.placing);
    $("coordinates-details").hidden = !p || multi || this.placing;
    if (p)
      for (let i = 0; i < 3; i++) {
        const input = $<HTMLInputElement>(`pos-${i}`);
        // Anchor native number-input steps to the piece's surface offset.
        input.defaultValue = String(p.position[i]);
        input.value = String(p.position[i]);
      }
    this.view.selectMany(pieces);
    this.syncGizmo();
    this.paths.syncUI();
    $("place-selected").innerHTML = icon("plus") + " Place blueprint";
  }
  updateWorldUI() {
    this.view.setPlots(this.world.plots ?? [12]);
    $("plot-status").textContent = `${this.world.plots?.length ?? 1} / 25 plots`;
    for (const id of this.selection) if (!this.world.pieces.has(id)) this.selection.delete(id);
    $("piece-count").textContent =
      `${this.world.pieces.size.toLocaleString()} pieces`;
    ($("undo") as HTMLButtonElement).disabled = !this.world.canUndo;
    ($("redo") as HTMLButtonElement).disabled = !this.world.canRedo;
    for (const id of ["move-tool", "duplicate-tool", "delete-tool"])
      $<HTMLButtonElement>(id).disabled = !this.selected;
    this.inspect();
  }
  setMode(placing: boolean) {
    if(this.logicTools?.wiring)this.logicTools.toggle(false);
    this.paths.cancel();
    this.held = false;
    this.placing = placing;
    this.orbit = false;
    this.view.camera.orbitMode(false);
    $("orbit-tool").classList.remove("active");
    $("select-tool").classList.toggle("active", !placing);
    $("placement-bar").hidden = !placing;
    $("mode-label").innerHTML =
      icon(placing ? "cube" : "arrow") +
      (placing ? "Place mode" : "Select mode");
    if (placing) {
      $("placing-name").textContent = this.groupPlacement
        ? `${this.groupPlacement.copy ? "Copy" : "Move"} ${this.groupPlacement.source.length} blueprints`
        : ITEMS.get(this.item)!.name;
      $("welcome-note").hidden = true;
    } else {
      this.ghost = null;
      this.view.showGhost(null);
      this.view.showGroupGhosts([]);
      this.groupPlacement = null;
      this.groupPreview = [];
      this.moving = null;
    }
    this.lastPointer = "";
    this.inspect();
  }
  updateCameraUI() {
    const walking = this.view.camera.walking;
    $("walk-tool").classList.toggle("active", walking);
    $("walk-tool").setAttribute("aria-pressed", String(walking));
    $("walk-tool").innerHTML =
      icon(walking ? "eye" : "walk") +
      `<span>${walking ? "Free cam" : "Walk"}</span><kbd>C</kbd>`;
    $("camera-hint").innerHTML = walking
      ? "<span><kbd>W A S D</kbd> Walk · RMB Look</span><span><kbd>Space</kbd> Jump · <kbd>Shift</kbd> Run</span><span>Wheel Zoom · <kbd>C</kbd> Free camera</span>"
      : "<span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Fly · RMB Look</span><span><kbd>Q</kbd><kbd>E</kbd> Elevate</span><span>MMB Orbit · Wheel Zoom</span>";
  }
  toggleWalk() {
    const entering = !this.view.camera.walking;
    this.pickSelection(null);
    this.view.camera.setWalking(entering);
    $("welcome-note").hidden = true;
    this.view.renderer.domElement.focus({ preventScroll: true });
    this.toast(
      entering
        ? "Walk with WASD. Space jumps; hold right mouse to look."
        : "Free camera. WASD to fly; Q/E to rise and descend.",
    );
  }
  choose(id: string) {
    this.logicConfig={};this.logicTools.toggle(false);
    this.setMode(false);
    this.panel("build-panel", false);
    this.item = id;
    this.lightOn = true;
    this.selected = null;
    this.moving = null;
    this.rotation = [0, 0, 0];
    this.setMode(true);
    this.inspect();
    this.catalog();
    this.updateGhost();
    this.updateWorldUI();
  }
  pickSelection(id: string | null) {
    this.pickSelections(id ? [id] : []);
  }
  pickSelections(ids: Iterable<string>) {
    this.setMode(false);
    this.selection = new Set([...ids].filter(id => this.world.pieces.has(id)));
    const id = this.selected;
    const p = id ? this.world.pieces.get(id) : null;
    if (p) {
      this.item = p.item;
      this.wood = p.wood;
      this.rotation = [...p.rotation];
      $("welcome-note").hidden = true;
    }
    this.inspect();
    this.catalog();
    this.updateWorldUI();
  }
  updateGhost() {
    if (!this.placing) return;
    if (this.paths.hasDraft) {this.paths.refresh();return;}
    if (this.held) {
      if (this.groupPlacement) this.view.showGroupGhosts(this.groupPreview, !this.groupIssue());
      else if (this.ghost) {
        this.ghost = {...this.ghost,wood:this.wood,rotation:[...this.rotation]};
        this.view.showGhost(this.ghost,this.valid(this.ghost));
      }
      this.syncGizmo();
      return;
    }
    if (this.groupPlacement) {
      if (this.pointer) {
        const hit = this.view.pick(...this.pointer, this.groupPlacement.ignore);
        this.groupPreview = hit ? placeSelectionOnSurface(this.groupPlacement.source, hit.point, hit.normal,
          snapMovement(Number($<HTMLInputElement>("elevation").value) || 0)) : [];
      }
      this.view.showGroupGhosts(this.groupPreview, !this.groupIssue());
      return;
    }
    if (!this.pointer) return;
    const pick = this.view.pick(...this.pointer, this.moving);
    if (!pick) {
      this.ghost = null;
      this.view.showGhost(null);
      return;
    }
    const pos = snapBlueprintOnSurface(pick.point, pick.normal, this.item, this.rotation);
    const elevation = snapMovement(
      Number($<HTMLInputElement>("elevation").value) || 0,
    );
    pos[1] = round(pos[1] + elevation);
    this.ghost = {
      id: this.moving ?? "ghost",
      item: this.item,
      wood: this.wood,
      ...this.logicConfig,
      ...(ITEMS.get(this.item)!.fixedMaterial === "lighting" ? {lightOn:this.lightOn} : {}),
      position: pos,
      rotation: [...this.rotation],
    };
    this.view.showGhost(this.ghost, this.valid(this.ghost));
  }
  valid(p: Piece) {
    return this.world.canPlace(p, this.moving);
  }
  syncGizmo() {
    if (this.paths.syncGizmo()) return;
    this.view.gizmo.setPieces(this.orbit ? [] : this.placing
      ? this.held ? this.groupPlacement ? this.groupPreview : this.ghost ? [this.ghost] : [] : []
      : this.selectedPieces);
  }
  holdPosition() {
    if (!this.placing) return;
    if (this.held) { this.held=false;this.lastPointer="";this.inspect();this.updateGhost();return; }
    if (this.groupPlacement && !this.groupPreview.length) this.groupPreview=structuredClone(this.groupPlacement.source);
    if (!this.groupPlacement && !this.ghost && this.selectedPieces[0]) this.ghost=structuredClone(this.selectedPieces[0]);
    if (this.groupPlacement ? !this.groupPreview.length : !this.ghost) {
      this.toast("Point at a starting position first, then hold it to build in the air.");return;
    }
    this.held=true;this.inspect();this.updateGhost();
  }
  nudge(direction: string) {
    const view=this.view.camera.camera.getWorldDirection(new Vector3());
    const forward:Vec3=Math.abs(view.x)>Math.abs(view.z) ? [Math.sign(view.x),0,0] : [0,0,Math.sign(view.z)||-1];
    const right:Vec3=[-forward[2],0,forward[0]];
    const steps:Record<string,Vec3>={up:[0,1,0],down:[0,-1,0],forward,back:forward.map(v=>-v) as Vec3,
      right,left:right.map(v=>-v) as Vec3};
    const delta=steps[direction];if (!delta) return;
    if (this.placing) {
      if (!this.held) this.holdPosition();
      if (!this.held) return;
      if (this.groupPlacement) this.groupPreview=translateSelection(this.groupPreview,delta);
      else this.ghost=translateSelection([this.ghost!],delta)[0];
      this.updateGhost();return;
    }
    const before=this.selectedPieces, after=translateSelection(before,delta), ignore=new Set(this.selection);
    if (!before.length) return;
    const issue=after.map(p=>this.world.placementIssue(p,ignore)).find(Boolean);
    if (issue) {
      this.toast(issue==="below-ground" ? BELOW_GROUND_MESSAGE : issue==="outside-plots" ? OUTSIDE_PLOTS_MESSAGE : "Cannot move here: the selection would overlap another blueprint.");return;
    }
    this.world.execute(after.map((p,i)=>({before:before[i],after:p})));
  }
  groupIssue() {
    for (const p of this.groupPreview) {
      const issue = this.world.placementIssue(p, this.groupPlacement!.ignore);
      if (issue) return issue;
    }
    return null;
  }
  place() {
    if (this.groupPlacement) {
      if (!this.groupPreview.length) return;
      const issue = this.groupIssue();
      if (issue) {
        this.toast(issue === "below-ground" ? BELOW_GROUND_MESSAGE : issue === "outside-plots"
          ? OUTSIDE_PLOTS_MESSAGE : "This selection would overlap another blueprint.");
        return;
      }
      const copy = this.groupPlacement.copy;
      const changes = this.groupPreview.map(p => ({
        before: copy ? null : this.world.pieces.get(p.id)!,
        after: { ...structuredClone(p), id: copy ? crypto.randomUUID() : p.id },
      }));
      this.world.execute(changes,copy?[...this.world.wires,...this.world.copyWires(this.groupPlacement.source.map(p=>this.world.pieces.get(p.id)!),changes.map(c=>c.after))]:undefined);
      this.pickSelections(changes.map(c => c.after.id));
      return;
    }
    if (!this.ghost) return;
    const issue = this.world.placementIssue(this.ghost, this.moving);
    if (issue) {
      this.toast(
        issue === "below-ground"
          ? BELOW_GROUND_MESSAGE
          : issue === "outside-plots" ? OUTSIDE_PLOTS_MESSAGE : "This piece overlaps another. Choose a clear position.",
      );
      return;
    }
    const p = {
      ...structuredClone(this.ghost),
      id: this.moving ?? crypto.randomUUID(),
    };
    if (this.moving) {
      this.world.execute([
        { before: this.world.pieces.get(this.moving)!, after: p },
      ]);
      this.pickSelection(p.id);
    } else {
      this.world.execute([{ before: null, after: p }]);
      this.lastPointer = "";
      if (this.held) this.updateGhost();
    }
  }
  rotate(axis: number) {
    if (this.groupPlacement) {
      this.groupPlacement.source=rotateSelection(this.groupPlacement.source,axis);
      this.groupPreview=rotateSelection(this.groupPreview,axis);
      this.lastPointer="";
      this.updateGhost();this.inspect();
      return;
    }
    if (this.selectedPieces.length>1 && !this.placing) {
      const before=this.selectedPieces,after=rotateSelection(before,axis),ignore=new Set(this.selection);
      const issue=after.map(p=>this.world.placementIssue(p,ignore)).find(Boolean);
      if (issue) {
        this.toast(issue==="below-ground" ? BELOW_GROUND_MESSAGE : issue==="outside-plots" ? OUTSIDE_PLOTS_MESSAGE
          : "Cannot rotate here: the selection would overlap another blueprint.");return;
      }
      this.world.execute(after.map((p,i)=>({before:before[i],after:p})));
      return;
    }
    if (this.placing) {
      this.rotation = turnRotation(this.rotation, axis);
      this.updateGhost();
      return;
    }
    const p = this.selected ? this.world.pieces.get(this.selected) : null;
    if (p) {
      const q = structuredClone(p);
      q.rotation = turnRotation(q.rotation, axis);
      const issue = this.world.placementIssue(q, p.id);
      if (issue) {
        this.toast(
          issue === "below-ground"
            ? BELOW_GROUND_MESSAGE
            : issue === "outside-plots" ? OUTSIDE_PLOTS_MESSAGE : "Cannot rotate here: this piece would overlap another.",
        );
        return;
      }
      this.rotation = [...q.rotation];
      this.world.execute([{ before: p, after: q }]);
    } else {
      this.rotation = turnRotation(this.rotation, axis);
      this.toast("Choose a blueprint to place it.");
    }
  }
  changeWood(wood: string) {
    if (!WOOD_MAP.has(wood)) return;
    if(!this.groupPlacement && (this.placing ? !!ITEMS.get(this.item)!.fixedMaterial : this.selectedPieces.every(p=>!!ITEMS.get(p.item)!.fixedMaterial))) return;
    this.wood=wood;
    if (this.groupPlacement) {
      this.groupPlacement.source=this.groupPlacement.source.map(p=>ITEMS.get(p.item)!.fixedMaterial ? p : {...p,wood});
      this.groupPreview=this.groupPreview.map(p=>ITEMS.get(p.item)!.fixedMaterial ? p : {...p,wood});
    } else if (!this.placing) {
      const changes=this.selectedPieces.filter(p=>!ITEMS.get(p.item)!.fixedMaterial && p.wood!==wood).map(p=>({before:p,after:{...p,wood}}));
      this.world.execute(changes);
    }
    this.panel("woods",false);this.inspect();this.updateGhost();
  }
  move(copy = false) {
    if (this.groupPlacement) return;
    const pieces = this.selectedPieces;
    if (pieces.length > 1) {
      this.groupPlacement = { source: structuredClone(pieces), copy,
        ignore: new Set(copy ? [] : pieces.map(p => p.id)) };
      this.ghost = null;
      this.moving = null;
      this.setMode(true);
      this.updateGhost();
      this.toast(`Place to ${copy ? "copy" : "move"} ${pieces.length} blueprints. Escape cancels.`);
      return;
    }
    const p = this.selected ? this.world.pieces.get(this.selected) : null;
    if (!p) {
      this.toast("Select a placed piece first.");
      return;
    }
    this.item = p.item;
    this.wood = p.wood;
    this.rotation = [...p.rotation];
    this.lightOn = p.lightOn !== false;
    this.logicConfig={...(p.logicOn===undefined?{}:{logicOn:p.logicOn}),...(p.timing===undefined?{}:{timing:p.timing})};
    this.moving = copy ? null : p.id;
    this.setMode(true);
    this.moving = copy ? null : p.id;
    this.updateGhost();
    this.toast(
      copy
        ? "Place the duplicate."
        : "Place to move. Escape keeps the original.",
    );
  }
  remove() {
    const pieces = this.selectedPieces;
    if (!pieces.length) return;
    this.setMode(false);
    this.world.execute(pieces.map(p => ({ before: p, after: null })));
    this.pickSelection(null);
  }
  async save() {
    if (this.saving) {
      this.saveAgain = true;
      return;
    }
    this.saving = true;
    const revision = this.world.revision;
    const gen = this.generation;
    $("save-state").textContent = "Saving…";
    try {
      await saveProject(this.project);
      if (gen === this.generation && revision === this.world.revision) {
        this.dirty = false;
        this.savedRevision = revision;
        $("save-state").textContent = "Saved on this device";
      }
    } catch (e) {
      $("save-state").textContent = "Save failed · export";
      this.toast(
        `Could not save: ${(e as Error).message}. Export your project.`,
      );
    } finally {
      this.saving = false;
      if (this.saveAgain) {
        this.saveAgain = false;
        void this.save();
      }
    }
  }
  async confirm(title: string, message: string, action = "Continue") {
    return new Promise<boolean>((resolve) => {
      const modal = $<HTMLDialogElement>("modal");
      $("modal-content").innerHTML =
        `<h2></h2><p></p><div class="dialog-actions"><button id="cancel-action">Cancel</button><button class="confirm" id="confirm-action"></button></div>`;
      $("modal-content").querySelector("h2")!.textContent = title;
      $("modal-content").querySelector("p")!.textContent = message;
      $("confirm-action").textContent = action;
      const done = (value: boolean) => {
        modal.close();
        modal.removeEventListener("cancel", cancel);
        resolve(value);
      };
      const cancel = (e: Event) => {
        e.preventDefault();
        done(false);
      };
      modal.addEventListener("cancel", cancel);
      $("cancel-action").onclick = () => done(false);
      $("confirm-action").onclick = () => done(true);
      modal.showModal();
    });
  }
  async replace(p: Project) {
    if (
      this.world.pieces.size &&
      !(await this.confirm(
        "Replace this project?",
        "Export the current project first if you want to keep a separate copy. The new project will become your local autosave.",
        "Replace project",
      ))
    )
      return;
    this.generation++;
    this.pickSelection(null);
    this.world.load(p.pieces, p.plots ?? inferPlots(p.pieces.map(pieceBounds)),p.wires??[]);
    $<HTMLInputElement>("project-name").value = p.name;
    $("welcome-note").hidden = true;
    this.view.camera.home();
    this.view.sync(true);
    void this.save();
  }
  async import(file: File) {
    try {
      if (file.size > 256 * 1024 * 1024)
        throw new Error("This file exceeds the 256 MB import safety budget.");
      const project = parseProject(await file.text());
      await this.replace(project);
    } catch (e) {
      this.toast((e as Error).message);
    } finally {
      $<HTMLInputElement>("file-input").value = "";
    }
  }
  export() {
    const blob = new Blob([JSON.stringify(this.project)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      (this.project.name.replace(/[^a-z0-9 _-]/gi, "") || "build") + ".timber";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    this.toast("Project exported. Keep this file as a backup.");
  }
  help() {
    this.setMode(false);
    const modal = $<HTMLDialogElement>("modal");
    $("modal-content").innerHTML =
      `<h2>Room for your imagination.</h2><p>Choose a blueprint, then click in the world to place it. Everything in the starter studio is editable.</p><div class="control-list"><span>Blueprint library</span><span><kbd>B</kbd> or Build button</span><span>Search blueprints</span><span><kbd>/</kbd></span><span>Walk / free camera</span><span><kbd>C</kbd> or Walk camera button</span><span>Move</span><span><kbd>W A S D</kbd></span><span>Walk: jump / run</span><span><kbd>Space</kbd> / <kbd>Shift</kbd></span><span>Look around</span><span>Hold <kbd>RMB</kbd></span><span>Up / down · faster</span><span><kbd>E Q</kbd> · <kbd>Shift</kbd></span><span>Orbit / zoom</span><span>Middle drag / wheel</span><span>Rotate / tilt</span><span><kbd>R</kbd> / <kbd>T</kbd></span><span>Select / move</span><span><kbd>V</kbd> / <kbd>G</kbd></span><span>Add / remove a selection</span><span><kbd>Ctrl</kbd> + click</span><span>Select a group (Select mode)</span><span><kbd>Ctrl</kbd> + left drag</span><span>Build a straight run (Build mode)</span><span><kbd>Ctrl</kbd> + left drag</span><span>Move selection on an axis</span><span>Drag X / Y / Z arrows</span><span>Hold / release placement</span><span><kbd>L</kbd> · arrows adjust preview</span><span>Pick up a placed piece</span><span>Double-click</span><span>Duplicate / delete</span><span><kbd>Ctrl D</kbd> / <kbd>Del</kbd></span><span>Undo / redo</span><span><kbd>Ctrl Z</kbd> / <kbd>Ctrl Shift Z</kbd></span><span>Focus / cancel</span><span><kbd>F</kbd> / <kbd>Esc</kbd></span></div><p>100 items include wood blueprints, glass, store furniture, lighting and 12 logic components. Use Wire to join sockets; click surfaces for bends, Backspace removes a bend, and Escape cancels. Select a logic component to operate it or change its timing. Walk onto pressure plates to activate them. Wood blueprint names and dimensions follow the <a href="https://lumber-tycoon-2.fandom.com/wiki/Blueprints" target="_blank" rel="noreferrer">LT2 community reference</a>. Model details, finishes, and snapping are reconstructed and have not been verified against a live LT2 client. An independent fan building tool.</p><p>Build on up to 25 connected plots, each 40 × 40 studs. There is no piece-count cap. Available memory and browser storage determine practical capacity. Export important projects as backups.</p><div class="dialog-actions"><button class="confirm" id="close-modal">Let’s build</button></div>`;
    $("close-modal").onclick = () => modal.close();
    modal.showModal();
  }
  settings() {
    const modal = $<HTMLDialogElement>("modal");
    const stats = this.view.stats;
    $("modal-content").innerHTML =
      `<h2>Your view, your pace.</h2><label class="setting-row"><span>Night preview</span><input id="night-preview" type="checkbox"></label><label class="setting-row"><span>Visual quality</span><select id="quality"><option value="performance">Performance</option><option value="balanced">Balanced</option><option value="quality">Quality</option></select></label><label class="setting-row"><span>Adaptive resolution</span><input type="checkbox" id="adaptive" ${this.view.adaptive ? "checked" : ""}></label><label class="setting-row"><span>View distance</span><select id="distance"><option value="192">192 studs</option><option value="384">384 studs</option><option value="640">640 studs</option><option value="896">896 studs</option></select></label><div class="stats-grid"><div>Rendering<strong>${stats.backend}</strong></div><div>Draw calls<strong>${stats.drawCalls}</strong></div><div>Resident chunks<strong>${stats.visibleChunks}</strong></div><div>Triangles<strong>${stats.triangles.toLocaleString()}</strong></div></div><p style="margin-top:16px">Lower view distance and quality keep large builds responsive. Distant pieces stay in your project.</p><div class="dialog-actions"><button id="load-demo">Load example studio</button><button class="confirm" id="close-modal">Done</button></div>`;
    $<HTMLInputElement>('night-preview').checked=this.view.night;
    $('night-preview').onchange=e=>this.view.setNight((e.target as HTMLInputElement).checked);
    $<HTMLSelectElement>("quality").value = this.view.quality;
    $<HTMLSelectElement>("distance").value = String(this.view.renderDistance);
    $("quality").onchange = (e) =>
      this.view.setQuality((e.target as HTMLSelectElement).value);
    $("adaptive").onchange = (e) =>
      (this.view.adaptive = (e.target as HTMLInputElement).checked);
    $("distance").onchange = (e) => {
      this.view.renderDistance = Number((e.target as HTMLSelectElement).value);
      this.view.sync(true);
    };
    $("close-modal").onclick = () => modal.close();
    $("load-demo").onclick = () => {
      modal.close();
      void this.replace({
        version: 1,
        name: "Woodland studio",
        pieces: createDemo(),
      });
    };
    modal.showModal();
  }
  land() {
    this.setMode(false);
    const modal = $<HTMLDialogElement>("modal");
    $("modal-content").innerHTML = `<span class="eyebrow">YOUR LAND</span><h2>Room to grow.</h2><p>Each plot is 40 × 40 studs. Expand from the center by connecting edges. Your full build must stay on active land.</p><div class="plot-summary"><strong id="land-count"></strong><span>Up to 200 × 200 studs</span></div><div class="plot-picker" id="plot-picker" role="group" aria-label="Building plots"></div><p id="land-feedback" class="land-feedback" role="status">Choose an adjoining plot to expand.</p><div class="plot-legend"><span>■ Active land</span><span>+ Available expansion</span><span>· Not connected</span></div><label class="setting-row"><span>Stud placement grid</span><input id="land-grid" type="checkbox" ${this.view.grid.visible ? "checked" : ""}></label><label class="setting-row"><span>40-stud plot borders</span><input id="land-borders" type="checkbox" ${this.view.terrain.borders.visible ? "checked" : ""}></label><div class="dialog-actions"><button id="land-focus">View all land</button><button class="confirm" id="close-modal">Done</button></div>`;
    const reasons = { center: "The starter plot always stays active.", occupied: "Move or delete the blueprints on this plot before turning it off.", disconnected: "Every active plot must connect by edges to the center. This change would leave disconnected land.", invalid: "Choose a plot inside the 5 × 5 layout." };
    const render = () => {
      const plots = this.world.plots ?? [12];
      $("land-count").textContent = `${plots.length} / 25 active · ${(plots.length * 1600).toLocaleString()} studs²`;
      $("plot-picker").innerHTML = ALL_PLOTS.map(id => {
        const active = plots.includes(id), issue = this.world.plotIssue(id);
        const label = `Plot ${Math.floor(id / 5) + 1}, ${id % 5 + 1}`;
        return `<button class="plot-cell ${active ? "owned" : issue ? "unavailable" : "available"}" data-plot="${id}" aria-label="${label}${id === 12 ? ", starter" : ""}" aria-pressed="${active}" aria-disabled="${!!issue}" title="${issue ? reasons[issue] : active ? "Deactivate plot" : "Activate plot"}"><strong>${id === 12 ? icon("home") : active ? icon("check") : issue ? "·" : "+"}</strong><span>${id === 12 ? "START" : "40 × 40"}</span></button>`;
      }).join("");
    };
    render();
    $("plot-picker").onclick = e => {
      const cell = (e.target as HTMLElement).closest<HTMLElement>("[data-plot]");
      if (!cell) return;
      const id = Number(cell.dataset.plot), active = this.world.plots?.includes(id);
      const issue = this.world.togglePlot(id);
      $("land-feedback").textContent = issue ? reasons[issue] : active ? "Plot returned to grass." : "Plot activated. Ready to build.";
      render();
      $("plot-picker").querySelector<HTMLElement>(`[data-plot="${id}"]`)?.focus();
    };
    $("land-grid").onchange = e => {
      this.view.grid.visible = (e.target as HTMLInputElement).checked;
      $("grid").classList.toggle("active", this.view.grid.visible);
    };
    $("land-borders").onchange = e => { this.view.terrain.borders.visible = (e.target as HTMLInputElement).checked; };
    $("land-focus").onclick = () => { this.view.camera.focus(new Vector3(0, 0, 0), 265); modal.close(); };
    $("close-modal").onclick = () => modal.close();
    modal.showModal();
  }
  bind() {
    $("catalog").onclick = (e) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>(
        "[data-item]",
      );
      if (card) this.choose(card.dataset.item!);
    };
    $("categories").onclick = (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>(
        "[data-category]",
      );
      if (!b) return;
      this.category = b.dataset.category!;
      document
        .querySelectorAll(".category")
        .forEach((el) => el.classList.toggle("active", el === b));
      this.catalog();
    };
    $("search").oninput = (e) => {
      this.search = (e.target as HTMLInputElement).value;
      this.catalog();
    };
    $("woods").onclick = (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-wood]");
      if (!b) return;
      this.changeWood(b.dataset.wood!);
    };
    const actions: Record<string, () => unknown> = {
      "select-tool": () => this.pickSelection(null),
      "orbit-tool": () => {
        this.setMode(false);
        this.orbit = true;
        this.syncGizmo();
        this.view.camera.orbitMode(true);
        $("orbit-tool").classList.add("active");
        $("select-tool").classList.remove("active");
        $("mode-label").innerHTML = icon("orbit") + "Orbit mode";
      },
      "move-tool": () => this.move(),
      "hold-position": () => this.holdPosition(),
      "commit-preview": () => this.place(),
      "walk-tool": () => this.toggleWalk(),
      "duplicate-tool": () => this.move(true),
      "delete-tool": () => this.remove(),
      undo: () => {
        this.setMode(false);
        this.world.undo();
      },
      redo: () => {
        this.setMode(false);
        this.world.redo();
      },
      rotate: () => this.rotate(1),
      tilt: () => this.rotate(0),
      home: () => this.view.camera.home(),
      top: () => this.view.camera.top(),
      focus: () => this.focus(),
      grid: () => {
        this.view.grid.visible = !this.view.grid.visible;
        $("grid").classList.toggle("active", this.view.grid.visible);
      },
      "place-selected": () => {
        this.setMode(false);
        this.selected = null;
        this.moving = null;
        this.setMode(true);
        this.updateWorldUI();
        this.updateGhost();
      },
      "build-tool": () => {if(this.logicTools.wiring)this.logicTools.toggle(false);this.panel("build-panel", !!$("build-panel").hidden);},
      "menu-tool": () => this.panel("project-menu", !!$("project-menu").hidden),
      "wood-toggle": () => this.panel("woods", !!$("woods").hidden),
      "close-edit": () => this.pickSelection(null),
      collapse: () => this.panel("build-panel", false),
      help: () => this.help(),
      settings: () => this.settings(),
      "land-tool": () => this.land(),
      "dismiss-welcome": () => {
        $("welcome-note").hidden = true;
      },
      new: () =>
        this.replace({ version: 1, name: "Untitled build", pieces: [] }),
      "blank-start": () =>
        this.replace({ version: 1, name: "Untitled build", pieces: [] }),
      save: () => this.save(),
      export: () => this.export(),
      import: () => $<HTMLInputElement>("file-input").click(),
    };
    for (const [id, action] of Object.entries(actions))
      $(id).onclick = () => {
        if ($(id).closest("#project-menu")) this.panel("project-menu", false);
        if (["land-tool", "walk-tool", "select-tool"].includes(id)) this.panel("build-panel", false);
        void action();
      };
    $("nudge-buttons").onclick = e => {
      const b=(e.target as HTMLElement).closest<HTMLElement>("[data-nudge]");
      if (b) this.nudge(b.dataset.nudge!);
    };
    $('light-toggle').onchange=e=>{
      const lightOn=(e.target as HTMLInputElement).checked;
      this.world.execute(this.selectedPieces.filter(p=>ITEMS.get(p.item)!.fixedMaterial==='lighting'&&!this.view.logic.circuit.connected(p.id)).map(p=>({before:p,after:{...p,lightOn}})));
      this.inspect();
    };
    $("overlap-toggle").onchange = e => {
      this.world.allowOverlaps=(e.target as HTMLInputElement).checked;
      this.lastPointer="";this.updateGhost();
      // A retained preview must also refresh while the pointer is over the panel.
      if (this.placing && !this.pointer && !this.paths.hasDraft) {
        if (this.groupPlacement) this.view.showGroupGhosts(this.groupPreview,!this.groupIssue());
        else if (this.ghost) this.view.showGhost(this.ghost,this.valid(this.ghost));
      }
      this.inspect();
    };
    $("axis-copy-toggle").onchange=e=>{this.copyWithArrows=(e.target as HTMLInputElement).checked;this.inspect();};
    $("elevation").oninput = () => this.updateGhost();
    $("elevation").onchange = () => {
      const input = $<HTMLInputElement>("elevation");
      input.value = String(snapMovement(Number(input.value) || 0));
      this.updateGhost();
    };
    $("project-name").onchange = () => {
      this.dirty = true;
      this.world.revision++;
      void this.save();
    };
    $("file-input").onchange = () => {
      const f = $<HTMLInputElement>("file-input").files?.[0];
      if (f) void this.import(f);
    };
    for (let i = 0; i < 3; i++)
      $(`pos-${i}`).onchange = () => {
        if (this.selection.size > 1) return;
        const p = this.selected ? this.world.pieces.get(this.selected) : null;
        if (!p) return;
        const n = Number($<HTMLInputElement>(`pos-${i}`).value);
        if (
          !Number.isFinite(n) ||
          Math.abs(n) > Number.MAX_SAFE_INTEGER / 10000
        ) {
          this.inspect();
          return;
        }
        const q = structuredClone(p);
        q.position[i] = snapMovement(n, p.position[i]);
        const issue = this.world.placementIssue(q, p.id);
        if (issue) {
          this.toast(
            issue === "below-ground"
              ? BELOW_GROUND_MESSAGE
              : issue === "outside-plots" ? OUTSIDE_PLOTS_MESSAGE : "Cannot move here: this piece would overlap another.",
          );
          this.inspect();
          return;
        }
        this.world.execute([{ before: p, after: q }]);
      };
    const canvas = this.view.renderer.domElement;
    let down: [number, number] | null = null;
    let selectionClicks: string[] = [];
    let gesture: { pointerId: number; start: [number, number]; dragged: boolean } | null = null;
    type ArrowDrag = {
      pointerId:number; math:AxisDrag; source:Piece[]; preview:Piece[]; placing:boolean; copy:boolean;
      ignore:ReadonlySet<string>; internalOverlap:boolean|null; delta:Vec3|null; revision:number; allowOverlaps:boolean;
    };
    let moveDrag: ArrowDrag | null = null;
    const arrowIssue=(drag:ArrowDrag)=>{
      for(const piece of drag.preview) {
        const issue=this.world.placementIssue(piece,drag.copy ? undefined : drag.ignore);if(issue) return issue;
      }
      if(drag.copy && !this.world.allowOverlaps) {
        drag.internalOverlap ??= this.world.hasInternalOverlaps(drag.source);
        if(drag.internalOverlap) return "overlap";
      }
      return null;
    };
    const endMove = (commit=false) => {
      const drag=moveDrag;if (!drag) return;
      moveDrag=null;down=null;selectionClicks=[];
      this.pointer=null;this.lastPointer="";
      if (drag.placing) {
        if (!commit) {
          if (this.groupPlacement) this.groupPreview=drag.source;
          else this.ghost=drag.source[0];
        }
        this.updateGhost();
      } else {
        this.view.showGroupGhosts([]);
        if(commit && drag.preview.some((p,i)=>p.position.some((v,j)=>v!==drag.source[i].position[j]))) {
          // Recheck the full final batch before assigning copy IDs and committing.
          const issue=drag.copy ? this.world.placementBatchIssue(drag.preview) : arrowIssue(drag);
          if(issue) this.toast(issue==="below-ground" ? BELOW_GROUND_MESSAGE : issue==="outside-plots" ? OUTSIDE_PLOTS_MESSAGE
            : `Cannot ${drag.copy ? "copy" : "move"} here: the selection would overlap another blueprint.`);
          else {
            const changes=drag.preview.map((p,i)=>({before:drag.copy ? null : drag.source[i],after:drag.copy ? {...p,id:crypto.randomUUID()} : p}));
            this.world.execute(changes,drag.copy?[...this.world.wires,...this.world.copyWires(drag.source,changes.map(c=>c.after))]:undefined);
            if(drag.copy) this.pickSelections(changes.map(c=>c.after.id));
          }
        }
      }
      this.view.camera.selecting=false;
      this.view.camera.controls.enabled=!this.view.camera.walking && !this.view.camera.flying;
      this.view.camera.keys.clear();canvas.style.cursor="";
      if (canvas.hasPointerCapture(drag.pointerId)) canvas.releasePointerCapture(drag.pointerId);
      this.inspect();
    };
    const endGesture = () => {
      const previous = gesture;
      gesture = null;
      down = null;
      selectionClicks = [];
      $("selection-marquee").hidden = true;
      this.view.camera.selecting = false;
      this.view.camera.controls.enabled = !this.view.camera.walking && !this.view.camera.flying;
      this.view.camera.keys.clear();
      if (previous && canvas.hasPointerCapture(previous.pointerId)) canvas.releasePointerCapture(previous.pointerId);
    };
    canvas.addEventListener("pointermove", (e) => {
      if (moveDrag) {
        e.preventDefault();e.stopImmediatePropagation();
        const delta=this.view.gizmo.delta(moveDrag.math,e.clientX,e.clientY,this.view.camera.camera,canvas.getBoundingClientRect());
        if (!delta) return;
        if(moveDrag.delta?.every((v,i)=>v===delta[i]) && moveDrag.revision===this.world.revision && moveDrag.allowOverlaps===this.world.allowOverlaps) return;
        moveDrag.delta=delta;moveDrag.revision=this.world.revision;moveDrag.allowOverlaps=this.world.allowOverlaps;
        moveDrag.preview=translateSelection(moveDrag.source,delta);
        if (moveDrag.placing) {
          if (this.groupPlacement) this.groupPreview=moveDrag.preview;
          else this.ghost=moveDrag.preview[0];
          this.updateGhost();
        } else {
          this.view.showGroupGhosts(moveDrag.preview,!arrowIssue(moveDrag));
          this.view.gizmo.setPieces(moveDrag.preview);
        }
        return;
      }
      this.pointer = [e.clientX, e.clientY];
      if (!gesture && !this.orbit && !this.view.camera.flying)
        canvas.style.cursor=this.view.gizmo.hit(e.clientX,e.clientY,this.view.camera.camera,canvas.getBoundingClientRect())!==null ? "grab" : "";
      if (!gesture || gesture.pointerId !== e.pointerId) return;
      gesture.dragged ||= Math.hypot(e.clientX - gesture.start[0], e.clientY - gesture.start[1]) > 5;
      if (!gesture.dragged) return;
      const rect = canvas.getBoundingClientRect(), marquee = $("selection-marquee");
      const x = Math.max(rect.left, Math.min(rect.right, e.clientX));
      const y = Math.max(rect.top, Math.min(rect.bottom, e.clientY));
      marquee.hidden = false;
      marquee.style.left = `${Math.min(x, gesture.start[0]) - rect.left}px`;
      marquee.style.top = `${Math.min(y, gesture.start[1]) - rect.top}px`;
      marquee.style.width = `${Math.abs(x - gesture.start[0])}px`;
      marquee.style.height = `${Math.abs(y - gesture.start[1])}px`;
    }, true);
    canvas.addEventListener("pointerleave", () => {
      if (gesture || moveDrag) return;
      this.pointer = null;
      // Keep the last preview available while the pointer operates its controls.
      this.lastPointer = "";
    });
    canvas.addEventListener("pointerdown", (e) => {
      if (moveDrag) { e.preventDefault();e.stopImmediatePropagation();return; }
      if (e.button===0 && !e.ctrlKey && !e.metaKey && !this.orbit && !this.view.camera.flying) {
        const rect=canvas.getBoundingClientRect(),gizmo=this.view.gizmo;
        const axis=gizmo.hit(e.clientX,e.clientY,this.view.camera.camera,rect);
        const math=axis!==null ? gizmo.begin(axis,e.clientX,e.clientY,this.view.camera.camera,rect) : null;
        if (math) {
          const source=structuredClone(this.placing ? this.groupPlacement ? this.groupPreview : this.ghost ? [this.ghost] : [] : this.selectedPieces);
          if (source.length) {
            e.preventDefault();e.stopImmediatePropagation();down=null;selectionClicks=[];
            moveDrag={pointerId:e.pointerId,math,source,preview:source,placing:this.placing,copy:!this.placing && this.copyWithArrows,
              ignore:new Set(source.map(p=>p.id)),internalOverlap:null,delta:null,revision:this.world.revision,allowOverlaps:this.world.allowOverlaps};
            this.view.camera.selecting=true;this.view.camera.controls.enabled=false;this.view.camera.keys.clear();
            canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);canvas.style.cursor="grabbing";
            return;
          }
        }
      }
      if (e.button === 0 && (e.ctrlKey || e.metaKey) && !this.view.camera.flying) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.setMode(false);
        selectionClicks = [];
        down = null;
        gesture = { pointerId: e.pointerId, start: [e.clientX, e.clientY], dragged: false };
        this.view.camera.selecting = true;
        this.view.camera.controls.enabled = false;
        this.view.camera.keys.clear();
        canvas.focus({ preventScroll: true });
        canvas.setPointerCapture(e.pointerId);
        return;
      }
      if (this.placing || this.orbit || this.view.camera.flying)
        selectionClicks = [];
      if (e.button === 0) down = [e.clientX, e.clientY];
    }, true);
    canvas.addEventListener("pointercancel", () => {
      endMove();
      endGesture();
    });
    canvas.addEventListener("lostpointercapture", () => { if (moveDrag) endMove(); if (gesture) endGesture(); });
    window.addEventListener("blur", () => { endMove();endGesture(); });
    document.addEventListener("visibilitychange", () => { if (document.hidden) {endMove();endGesture();} });
    canvas.addEventListener("wheel", e => {if (moveDrag) {e.preventDefault();e.stopImmediatePropagation();}}, {capture:true,passive:false});
    canvas.addEventListener("pointerup", (e) => {
      if (moveDrag) {
        e.preventDefault();e.stopImmediatePropagation();
        if (e.button===0 && e.pointerId===moveDrag.pointerId) endMove(true);
        return;
      }
      if (e.button !== 0 || !gesture || e.pointerId !== gesture.pointerId) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const { start, dragged } = gesture;
      endGesture();
      const ids = new Set(this.selection);
      if (dragged) {
        for (const id of selectInRectangle(this.world, this.view.camera.camera,
          canvas.getBoundingClientRect(), start, [e.clientX, e.clientY], this.view.renderDistance)) ids.add(id);
      } else {
        const hit = this.view.pick(e.clientX, e.clientY);
        if (hit?.id) { if (ids.has(hit.id)) ids.delete(hit.id); else ids.add(hit.id); }
      }
      this.pickSelections(ids);
    }, true);
    canvas.addEventListener("pointerup", (e) => {
      if (e.button !== 0 || !down) return;
      const delta = Math.hypot(e.clientX - down[0], e.clientY - down[1]);
      down = null;
      if (delta > 5 || this.orbit || this.view.camera.flying) {
        selectionClicks = [];
        return;
      }
      this.pointer = [e.clientX, e.clientY];
      if (this.placing) {
        selectionClicks = [];
        this.updateGhost();
        this.place();
      } else {
        const hit = this.view.pick(e.clientX, e.clientY);
        selectionClicks = hit?.id ? [...selectionClicks.slice(-1), hit.id] : [];
        this.pickSelection(hit?.id ?? null);
      }
    });
    canvas.addEventListener("dblclick", (e) => {
      // Only two selection clicks may start a move; placement clicks must not.
      const samePiece =
        selectionClicks.length === 2 &&
        selectionClicks.every((id) => id === this.selected);
      selectionClicks = [];
      if (
        e.button !== 0 ||
        !samePiece ||
        this.placing ||
        this.orbit ||
        this.view.camera.flying
      )
        return;
      e.preventDefault();
      this.pointer = [e.clientX, e.clientY];
      this.move();
    });
    window.addEventListener("keydown", (e) => {
      if (moveDrag) {
        e.preventDefault();
        if (e.code==="Escape") endMove();
        return;
      }
      if (gesture) {
        if (e.code === "Escape") { e.preventDefault(); endGesture(); }
        return;
      }
      if (e.code === "Escape" && !document.querySelector("dialog[open]")) {
        for (const id of ["woods", "build-panel", "project-menu"] as const) {
          if (!$(id).hidden) { e.preventDefault(); this.panel(id, false); return; }
        }
      }
      if (
        (e.target as HTMLElement).matches("input,textarea,select") ||
        document.querySelector("dialog[open]")
      )
        return;
      if (this.view.camera.flying) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl) {
        if (e.code === "KeyZ") {
          e.preventDefault();
          this.setMode(false);
          e.shiftKey ? this.world.redo() : this.world.undo();
        } else if (e.code === "KeyY") {
          e.preventDefault();
          this.setMode(false);
          this.world.redo();
        } else if (e.code === "KeyD") {
          e.preventDefault();
          this.move(true);
        } else if (e.code === "KeyS") {
          e.preventDefault();
          void this.save();
        }
        return;
      }
      if (e.repeat) return;
      switch (e.code) {
        case "KeyB":
          e.preventDefault();
          this.panel("build-panel", !!$("build-panel").hidden);
          break;
        case "KeyC":
          this.toggleWalk();
          break;
        case "Escape":
          this.pickSelection(null);
          break;
        case "KeyV":
          this.pickSelection(null);
          break;
        case "KeyO":
          void actions["orbit-tool"]();
          break;
        case "KeyR":
          this.rotate(1);
          break;
        case "KeyT":
          this.rotate(0);
          break;
        case "KeyG":
          this.move();
          break;
        case "KeyL":
          this.holdPosition();
          break;
        case "KeyF":
          this.focus();
          break;
        case "Delete":
        case "Backspace":
          e.preventDefault();
          this.remove();
          break;
        case "Slash":
          e.preventDefault();
          this.panel("build-panel", true);
          break;
        case "KeyH":
          this.help();
          break;
      }
    });
    window.addEventListener("beforeunload", (e) => {
      if (this.dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.dirty) void this.save();
    });
    $("viewport").addEventListener("graphicslost", () =>
      this.toast(
        "Graphics context lost. Your build is retained; export or reload to recover the view.",
      ),
    );
  }
  focus() {
    if (this.selection.size > 1) {
      const b = selectionBounds(this.selectedPieces);
      this.view.camera.focus(new Vector3(...b.center), Math.max(...b.size) * 2);
      return;
    }
    const p = this.selected ? this.world.pieces.get(this.selected) : null;
    if (p)
      this.view.camera.focus(
        new Vector3(...p.position),
        Math.max(...ITEMS.get(p.item)!.size) * 3,
      );
    else this.view.camera.home();
  }
}
