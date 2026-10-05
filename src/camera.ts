import { PerspectiveCamera, Vector3, Euler } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { World } from "./world";
import { WalkController, WALK_EYE_HEIGHT } from "./walk";
export class CameraController {
  camera = new PerspectiveCamera(45, 1, 0.1, 4000);
  controls: OrbitControls;
  keys = new Set<string>();
  flying = false;
  speedLevel = 3;
  get speed() { return this.speedLevel * 8; }
  walking = false;
  selecting = false;
  walker: WalkController;
  walkDistance = 12;
  onModeChange = (_walking: boolean) => {};
  private jumpPending = false;
  private freeFov = 45;
  private yaw = 0;
  private pitch = 0;
  private element: HTMLElement;
  private dragPointer:number|null=null;
  private dragPosition:[number,number]=[0,0];
  private lookChanged=false;
  private panDelta=new Vector3();
  private panUp=new Vector3();
  constructor(element: HTMLElement, world = new World()) {
    this.element = element;
    try {
      const saved=Number(localStorage.getItem('timber-camera-speed'));
      if(Number.isInteger(saved)&&saved>=1&&saved<=5)this.speedLevel=saved;
    } catch { /* Camera controls still work when browser storage is unavailable. */ }
    this.walker = new WalkController(world);
    this.camera.position.set(40, 30, 44);
    this.controls = new OrbitControls(this.camera, element);
    this.controls.target.set(0, 4, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.maxPolarAngle = Math.PI;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 1500;
    this.controls.mouseButtons = {
      LEFT: null as any,
      MIDDLE: 0,
      RIGHT: null as any,
    };
    this.controls.update();
    element.addEventListener("contextmenu", (e) => e.preventDefault());
    element.addEventListener("pointerdown", (e) => {
      element.focus({ preventScroll: true });
      if (this.selecting) return;
      if (e.button !== 2) return;
      this.dragPointer=e.pointerId;this.dragPosition=[e.clientX,e.clientY];this.lookChanged=false;
      this.flying = true;
      this.controls.enabled = false;
      if (!this.walking) {
        const a = new Euler().setFromQuaternion(this.camera.quaternion, "YXZ");
        this.pitch = a.x;
        this.yaw = a.y;
      }
      element.setPointerCapture(e.pointerId);
    });
    element.addEventListener("pointermove", (e) => {
      if (!this.flying||e.pointerId!==this.dragPointer) return;
      const dx=e.clientX-this.dragPosition[0],dy=e.clientY-this.dragPosition[1];
      this.dragPosition=[e.clientX,e.clientY];
      if(e.shiftKey&&!this.walking){
        this.camera.updateMatrixWorld();
        const scale=2*Math.max(2,this.camera.position.distanceTo(this.controls.target))*Math.tan(this.camera.fov*Math.PI/360)
          /Math.max(1,element.clientHeight)*this.speedLevel/3;
        this.panDelta.setFromMatrixColumn(this.camera.matrixWorld,0).multiplyScalar(-dx*scale);
        this.panUp.setFromMatrixColumn(this.camera.matrixWorld,1).multiplyScalar(dy*scale);
        this.panDelta.add(this.panUp);this.camera.position.add(this.panDelta);this.controls.target.add(this.panDelta);
        return;
      }
      this.lookChanged=true;
      this.yaw -= e.movementX * 0.003;
      this.pitch = Math.max(
        -1.5,
        Math.min(1.5, this.pitch - e.movementY * 0.003),
      );
      if (!this.walking) this.camera.quaternion.setFromEuler(new Euler(this.pitch, this.yaw, 0, "YXZ"));
    });
    const releaseLook = () => {
      if (this.flying && !this.walking && this.lookChanged) {
        const v = new Vector3();
        this.camera.getWorldDirection(v);
        this.controls.target.copy(this.camera.position).addScaledVector(v, 30);
      }
      this.flying = false;
      const pointer=this.dragPointer;this.dragPointer=null;
      if(pointer!==null&&element.hasPointerCapture(pointer))element.releasePointerCapture(pointer);
      this.controls.enabled = !this.walking;
    };
    const release = () => {
      releaseLook();
      this.keys.clear();
      this.jumpPending = false;
    };
    element.addEventListener("pointerup", (e) => {
      if (e.button === 2) releaseLook();
    });
    element.addEventListener("lostpointercapture", releaseLook);
    element.addEventListener("pointercancel", release);
    window.addEventListener("blur", release);
    document.addEventListener("focusin", () => {
      if (this.keyboardBlocked()) { this.keys.clear(); this.jumpPending = false; }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) release();
    });
    window.addEventListener("keydown", (e) => {
      if (this.keyboardBlocked() || e.ctrlKey || e.metaKey || e.altKey) {
        this.keys.clear();
        this.jumpPending = false;
        return;
      }
      if (this.walking && e.code === "Space") {
        if (!e.repeat) this.jumpPending = true;
        e.preventDefault();
      }
      this.keys.add(e.code);
      if (["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE"].includes(e.code))
        e.preventDefault();
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    element.addEventListener(
      "wheel",
      (e) => {
        if (this.walking) {
          e.preventDefault();
          const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
          this.walkDistance = Math.max(0, Math.min(40, this.walkDistance + delta * 0.02));
        } else if (this.flying) {
          e.preventDefault();
          this.setSpeedLevel(this.speedLevel-Math.sign(e.deltaY));
        }
      },
      { passive: false },
    );
  }
  setSpeedLevel(level:number) {
    if(!Number.isFinite(level))return;
    this.speedLevel=Math.max(1,Math.min(5,Math.round(level)));
    try { localStorage.setItem('timber-camera-speed',String(this.speedLevel)); } catch { /* Session setting remains usable. */ }
  }
  private keyboardBlocked() {
    return (
      !!document.querySelector("dialog[open]") ||
      !!document.activeElement?.closest(
        'input,select,textarea,[contenteditable]:not([contenteditable="false"])',
      )
    );
  }
  update(dt: number) {
    if (this.selecting) return;
    if ((this.keys.size || this.jumpPending) && this.keyboardBlocked()) { this.keys.clear(); this.jumpPending = false; }
    if (this.walking) {
      this.updateWalk(dt);
      return;
    }
    if (!this.flying) this.controls.update();
    if (this.keys.size) {
      const direction = new Vector3(
        Number(this.keys.has("KeyD")) - Number(this.keys.has("KeyA")),
        0,
        Number(this.keys.has("KeyS")) - Number(this.keys.has("KeyW")),
      );
      direction.applyQuaternion(this.camera.quaternion);
      direction.y +=
        Number(this.keys.has("KeyE")) - Number(this.keys.has("KeyQ"));
      if (direction.lengthSq()) {
        const delta = direction
          .normalize()
          .multiplyScalar(
            dt *
              this.speed *
              (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight")
                ? 3
                : 1),
          );
        this.camera.position.add(delta);
        // Keep orbit's target in step so releasing WASD never turns the view.
        this.controls.target.add(delta);
      }
    }
  }
  toggleWalk() { this.setWalking(!this.walking); }
  setWalking(enabled: boolean) {
    if (enabled === this.walking) return;
    if (enabled) {
      if (!this.walker.spawn(this.camera.position)) return;
      const a = new Euler().setFromQuaternion(this.camera.quaternion, "YXZ");
      this.yaw = a.y;
      this.pitch = Math.max(-1.2, Math.min(0.6, a.x));
      this.walkDistance = 12;
      this.walker.avatar.rotation.y = this.yaw;
      this.freeFov = this.camera.fov;
      this.camera.fov = 70;
    } else {
      const direction = this.camera.getWorldDirection(new Vector3());
      this.controls.target.copy(this.camera.position).addScaledVector(direction, 30);
      this.camera.fov = this.freeFov;
    }
    this.camera.updateProjectionMatrix();
    this.walking = enabled;
    this.flying = false;
    this.keys.clear();
    this.jumpPending = false;
    this.controls.enabled = !enabled;
    this.walker.avatar.visible = enabled;
    this.walker.velocity.set(0, 0, 0);
    if (enabled) this.updateWalk(0);
    this.onModeChange(enabled);
  }
  private updateWalk(dt: number) {
    const direction = new Vector3(
      Number(this.keys.has("KeyD")) - Number(this.keys.has("KeyA")), 0,
      Number(this.keys.has("KeyS")) - Number(this.keys.has("KeyW")),
    );
    if (direction.lengthSq()) direction.normalize().applyAxisAngle(new Vector3(0, 1, 0), this.yaw);
    this.walker.update(dt, direction, this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"), this.jumpPending);
    this.jumpPending = false;
    this.walker.animate(Math.min(dt, 0.1), direction);
    const target = this.walker.position.clone().add(new Vector3(0, WALK_EYE_HEIGHT, 0));
    const look = new Vector3(0, 0, -1).applyEuler(new Euler(this.pitch, this.yaw, 0, "YXZ"));
    const desired = target.clone().addScaledVector(look, -this.walkDistance);
    this.camera.position.copy(this.walker.cameraPosition(target, desired));
    this.camera.quaternion.setFromEuler(new Euler(this.pitch, this.yaw, 0, "YXZ"));
    this.controls.target.copy(target);
    this.walker.avatar.visible = this.camera.position.distanceTo(target) > 1.25;
  }
  focus(position: Vector3, distance = 24) {
    this.setWalking(false);
    const dir = this.camera.position
      .clone()
      .sub(this.controls.target)
      .normalize();
    this.controls.target.copy(position);
    this.camera.position.copy(position).addScaledVector(dir, distance);
    this.controls.update();
  }
  home() {
    this.setWalking(false);
    this.camera.position.set(40, 30, 44);
    this.controls.target.set(0, 4, 0);
    this.controls.update();
  }
  top() {
    this.setWalking(false);
    this.camera.position
      .copy(this.controls.target)
      .add(new Vector3(0, 65, 0.01));
    this.controls.update();
  }
  orbitMode(enabled: boolean) {
    if (enabled) this.setWalking(false);
    this.controls.mouseButtons.LEFT = enabled ? 0 : (null as any);
    this.element.style.cursor = enabled ? "grab" : "";
  }
}
