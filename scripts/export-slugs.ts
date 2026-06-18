import { writeFileSync } from "fs";
import { generateInventory } from "../src/lib/data/generate-inventory";

const vehicles = generateInventory();
const slugs = vehicles.map((v) => v.slug);

writeFileSync(
  "scripts/vehicle-slugs.json",
  JSON.stringify(slugs, null, 0),
  "utf8"
);

console.log("Exported", slugs.length, "vehicle slugs");
