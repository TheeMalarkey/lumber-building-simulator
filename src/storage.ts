import { parseProject, type Project } from "./project";
const DATABASE = "timber-studio-v1";
function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("projects");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function loadProject(): Promise<{
  project: Project | null;
  recovered: boolean;
}> {
  const db = await open();
  try {
    const values = await new Promise<any[]>((resolve, reject) => {
      const tx = db.transaction("projects", "readonly"),
        store = tx.objectStore("projects");
      const a = store.get("current"),
        b = store.get("previous");
      tx.oncomplete = () => resolve([a.result, b.result]);
      tx.onerror = () => reject(tx.error);
    });
    for (let i = 0; i < values.length; i++)
      if (values[i]) {
        try {
          return { project: parseProject(values[i]), recovered: i === 1 };
        } catch {
          /* Attempt the previous atomic snapshot. */
        }
      }
    if (values.some(Boolean))
      throw new Error(
        "Saved project could not be read. Import an exported backup to recover it.",
      );
    return { project: null, recovered: false };
  } finally {
    db.close();
  }
}
export async function saveProject(project: Project) {
  const text = JSON.stringify(project);
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("projects", "readwrite"),
        store = tx.objectStore("projects");
      const old = store.get("current");
      old.onsuccess = () => {
        if (old.result) store.put(old.result, "previous");
        store.put(text, "current");
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(
          tx.error ??
            new Error(
              "Local storage is unavailable. Export your project to keep your work.",
            ),
        );
      tx.onabort = () =>
        reject(tx.error ?? new Error("Save interrupted. Export your project."));
    });
  } finally {
    db.close();
  }
}
