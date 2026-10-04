import "./style.css";
import "./hud.css";
import { Editor } from "./editor";
import { createBenchmark } from "./demo";
import { preloadMaterials } from "./materials";
async function main() {
  try {
    await preloadMaterials();
    const editor = new Editor();
    await editor.start();
    document.documentElement.dataset.ready = "true";
    if (import.meta.env.DEV)
      Object.assign(window, {
        timber: {
          editor,
          benchmark: (count: number, mixed = true) => {
            editor.world.load(createBenchmark(count, mixed));
            editor.view.sync(true);
            return editor.view.stats;
          },
          stats: () => editor.view.stats,
        },
      });
  } catch (error) {
    console.error(error);
    document.getElementById("app")!.innerHTML =
      '<div style="padding:60px;max-width:650px"><h1>Timber Studio could not start</h1><p>Please use a browser with WebGL 2 and hardware acceleration enabled.</p><pre id="startup-error"></pre></div>';
    document.getElementById("startup-error")!.textContent = (
      error as Error
    ).message;
  }
}
void main();
