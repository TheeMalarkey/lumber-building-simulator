export type Vec3 = [number, number, number];
export type Shape =
  | "box"
  | "corner"
  | "corrugated"
  | "corrugated-corner"
  | "fence"
  | "fence-corner"
  | "wedge"
  | "stairs"
  | "door"
  | "ladder"
  | "chair"
  | "table"
  | "cabinet"
  | "cabinet-corner"
  | "sink";
export interface CatalogItem {
  id: string;
  name: string;
  category: string;
  size: Vec3;
  shape: Shape;
  woodCost: number;
}
export const CATEGORIES = [
  "All pieces",
  "Walls",
  "Floors",
  "Doors",
  "Wedges",
  "Furniture",
  "Other",
];
export const CATALOG: CatalogItem[] = [];
const add = (
  name: string,
  category: string,
  size: Vec3,
  shape: Shape = "box",
  woodCost = 0,
) =>
  CATALOG.push({
    id: name
      .toLowerCase()
      .replace(/[()]/g, "")
      .replace(/[^a-z0-9]+/g, "-"),
    name,
    category,
    size,
    shape,
    woodCost,
  });
for (const [family, shape] of [
  ["Smooth Wall", "box"],
  ["Corrugated Wall", "corrugated"],
  ["Fence", "fence"],
] as const) {
  for (const [prefix, h] of [
    ["", 8],
    ["Short ", 4],
    ["Stub ", 2],
  ] as const) {
    if (family === "Fence" && h === 2) continue;
    const name = h === 2 ? `${family} Stub` : `${prefix}${family}`;
    add(name, "Walls", [4, h, 1], shape, family === "Fence" ? (h === 8 ? 8 : 5) : h === 8 ? 10 : h === 4 ? 6 : 4);
    add(
      `(Thin) ${name}`,
      "Walls",
      [2, h, 1],
      shape,
      family === "Fence" ? (h === 8 ? 5 : 3) : h === 8 ? 6 : h === 4 ? 4 : 3,
    );
    add(
      h === 2 ? `${family} Corner Stub` : `${prefix}${family} Corner`,
      "Walls",
      [2, h, 2],
      family === "Smooth Wall"
        ? "corner"
        : family === "Fence"
          ? "fence-corner"
          : "corrugated-corner",
      family === "Fence" ? (h === 8 ? 6 : 4) : h === 8 ? 8 : h === 4 ? 5 : 3,
    );
  }
}
for (const [name, n, cost] of [
  ["Tiny", 1, 1],
  ["Small", 2, 3],
  ["", 4, 6],
  ["Large", 8, 18],
] as const) {
  add(`${name ? name + " " : ""}Floor`, "Floors", [n, 1, n], "box", cost);
  add(
    `${name ? name + " " : ""}Tile`,
    "Floors",
    [n, 0.2, n],
    "box",
    n === 8 ? 6 : n === 4 ? 2 : 1,
  );
}
add("Basic Door", "Doors", [4, 8, 1], "door", 10);
add("Half Door", "Doors", [4, 4, 1], "door", 6);
add("Fat Door", "Doors", [8, 8, 1], "door", 18);
add("Stairs", "Wedges", [4, 2, 4], "stairs", 10);
add("Steep Stairs", "Wedges", [4, 4, 4], "stairs", 14);
const wedgeCosts: Record<number, [number, number][]> = {
  4: [[8,3],[10,3],[12,4],[14,5]], 3: [[6,2],[8,3],[10,3]],
  2: [[6,2],[8,3]], 1: [[4,1]],
};
for (const d of [4, 3, 2, 1])
  for (let h = 1; h <= d; h++) {
    add(`${h}/${d} Wedge`, "Wedges", [4, h, d], "wedge", wedgeCosts[d][h-1][0]);
    add(`${h}/${d} x 1 Wedge`, "Wedges", [1, h, d], "wedge", wedgeCosts[d][h-1][1]);
  }
add("Mundane Chair", "Furniture", [2, 5, 2], "chair", 6);
add("Square Table", "Furniture", [4, 4, 4], "table", 8);
add("Long Table", "Furniture", [8, 4, 4], "table", 14);
add("Thin Cabinet", "Furniture", [4, 2.4, 2], "cabinet", 8);
add("Kitchen Cabinet", "Furniture", [4, 2.4, 4], "cabinet", 15);
add("Kitchen Cabinet Corner", "Furniture", [4, 2.4, 4], "cabinet-corner", 15);
add(
  "Wide Kitchen Cabinet Corner",
  "Furniture",
  [6, 2.4, 6],
  "cabinet-corner",
  22,
);
add("Countertop", "Furniture", [4, 0.4, 4], "box", 18);
add("Thin Countertop", "Furniture", [4, 0.4, 2], "box", 10);
add("Countertop With Sink", "Furniture", [4, 1, 4], "sink", 30);
add("Post", "Other", [1, 4, 1], "box", 3);
add("Ladder", "Other", [4, 4, 1], "ladder", 6);
export const ITEMS = new Map(CATALOG.map((x) => [x.id, x]));
export interface Wood {
  id: string;
  name: string;
  color: string;
  kind: "wood" | "glow" | "ice" | "foil" | "stone" | "smooth";
}
const wood = (
  id: string,
  name: string,
  color: string,
  kind: Wood["kind"] = "wood",
): Wood => ({ id, name, color, kind });
export const WOODS: Wood[] = [
  wood("oak", "Oak", "#cc8e69"),
  wood("elm", "Elm", "#eab892"),
  wood("birch", "Birch", "#cdcdcd"),
  wood("walnut", "Walnut", "#694028"),
  wood("cherry", "Cherry", "#a34b4b"),
  wood("koa", "Koa", "#8f4c2a"),
  wood("fir", "Fir", "#d7c59a"),
  wood("pine", "Pine", "#d7c59a"),
  wood("palm", "Palm", "#e2dcbc"),
  wood("volcano", "Volcano", "#ff0000"),
  wood("gold", "Gold", "#e29b40"),
  wood("zombie", "Zombie", "#348e40"),
  wood("cavecrawler", "Cavecrawler", "#102adc", "glow"),
  wood("frost", "Frost", "#9ff3e9", "ice"),
  wood("phantom", "Phantom", "#f8f8f8", "foil"),
  wood("snowglow", "Snowglow", "#ffff00", "smooth"),
  wood("blue-spruce", "Blue Spruce", "#9fadc0"),
  wood("spooky", "Spooky", "#aa5500", "stone"),
  wood("sinister", "Sinister", "#aa5500", "glow"),
  wood("sign", "Sign", "#eab892"),
];
export const WOOD_MAP = new Map(WOODS.map((w) => [w.id, w]));
export const CATALOG_SOURCE =
  "https://lumber-tycoon-2.fandom.com/wiki/Blueprints";

/** Both the visible mesh and walk collision use the reference tread count. */
export const stairTreadCount = (item: CatalogItem) => item.id === "steep-stairs" ? 4 : 2;
