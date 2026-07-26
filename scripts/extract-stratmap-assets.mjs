import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import sharp from "sharp";

const rootDir = process.cwd();
const upstreamDir = path.join(rootDir, ".tmp", "maps-let-loose");
const pointNamesDir = path.join(rootDir, ".tmp", "hll-default-garrisons");
const dataFile = path.join(upstreamDir, "data.js");
const pointNamesFile = path.join(pointNamesDir, "js", "maps.js");
const outputDataFile = path.join(rootDir, "src", "data", "hll-stratmap-maps.json");
const outputCatalogFile = path.join(rootDir, "src", "data", "hll-stratmap-catalog.json");
const publicMapsDir = path.join(rootDir, "public", "maps");
const publicAssetsDir = path.join(rootDir, "public", "stratmap", "assets");
const publicStrongpointsDir = path.join(rootDir, "public", "stratmap", "strongpoints");

const MAP_ID_BY_UPSTREAM_NAME = {
  Carentan: "carentan",
  Driel: "driel",
  ElAlamein: "el_alamein",
  Elsenborn: "elsenborn_ridge",
  Foy: "foy",
  Hill400: "hill_400",
  HurtgenV2: "hurtgen_forest",
  Juno: "juno_beach",
  Kharkov: "kharkov",
  Kursk: "kursk",
  Mortain: "mortain",
  Omaha: "omaha_beach",
  PHL: "purple_heart_lane",
  Remagen: "remagen",
  SMDMV2: "st_marie_du_mont",
  SME: "st_mere_eglise",
  Smolensk: "smolensk",
  Stalingrad: "stalingrad",
  Tobruk: "tobruk",
  Utah: "utah_beach",
};

const GARRISON_MAP_KEY_BY_MAP_ID = {
  carentan: "CAR",
  driel: "DRI",
  el_alamein: "ELA",
  elsenborn_ridge: "EBR",
  foy: "FOY",
  hill_400: "H4",
  hurtgen_forest: "HUR",
  juno_beach: "JUN",
  kharkov: "KHA",
  kursk: "KUR",
  mortain: "MOR",
  omaha_beach: "OMA",
  purple_heart_lane: "PHL",
  remagen: "REM",
  st_marie_du_mont: "SMM",
  st_mere_eglise: "SME",
  smolensk: "SMO",
  stalingrad: "STA",
  tobruk: "TOB",
  utah_beach: "UTA",
};

const MAP_NAME_BY_ID = {
  carentan: "Carentan",
  driel: "Driel",
  el_alamein: "El Alamein",
  elsenborn_ridge: "Elsenborn Ridge",
  foy: "Foy",
  hill_400: "Hill 400",
  hurtgen_forest: "Hurtgen Forest",
  juno_beach: "Juno Beach",
  kharkov: "Kharkov",
  kursk: "Kursk",
  mortain: "Mortain",
  omaha_beach: "Omaha Beach",
  purple_heart_lane: "Purple Heart Lane",
  remagen: "Remagen",
  st_marie_du_mont: "St. Marie Du Mont",
  st_mere_eglise: "St. Mere Eglise",
  smolensk: "Smolensk",
  stalingrad: "Stalingrad",
  tobruk: "Tobruk",
  utah_beach: "Utah Beach",
};

const IMAGE_NAME_BY_ID = {
  carentan: "carentan.webp",
  driel: "driel.webp",
  el_alamein: "el-alamein.webp",
  elsenborn_ridge: "elsenborn-ridge.webp",
  foy: "foy.webp",
  hill_400: "hill-400.webp",
  hurtgen_forest: "hurtgen-forest.webp",
  juno_beach: "juno-beach.webp",
  kharkov: "kharkov.webp",
  kursk: "kursk.webp",
  mortain: "mortain.webp",
  omaha_beach: "omaha-beach.webp",
  purple_heart_lane: "purple-heart-lane.webp",
  remagen: "remagen.webp",
  st_marie_du_mont: "st-marie-du-mont.webp",
  st_mere_eglise: "st-mere-eglise.webp",
  smolensk: "smolensk.webp",
  stalingrad: "stalingrad.webp",
  tobruk: "tobruk.webp",
  utah_beach: "utah-beach.webp",
};

const PLACEABLE_CATALOG = [
  { id: "garry", label: "Garrison", category: "spawns", iconPath: "/stratmap/assets/garry-plain.png" },
  { id: "airhead", label: "Airhead", category: "spawns", iconPath: "/stratmap/assets/airhead-plain.png" },
  { id: "halftrack", label: "Halftrack", category: "spawns", iconPath: "/stratmap/assets/halftrack-plain.png" },
  { id: "outpost-normal", label: "Outpost", category: "spawns", iconPath: "/stratmap/assets/outpost-normal-plain.png" },
  { id: "outpost-recon", label: "Recon Outpost", category: "spawns", iconPath: "/stratmap/assets/outpost-recon-plain.png" },
  { id: "forward", label: "Forward Position", category: "spawns", iconPath: "/stratmap/assets/forward-plain.png" },
  { id: "tank-heavy", label: "Heavy Tank", category: "vehicles", iconPath: "/stratmap/assets/tank-heavy.png" },
  { id: "tank-med", label: "Medium Tank", category: "vehicles", iconPath: "/stratmap/assets/tank-med.png" },
  { id: "tank-light", label: "Light Tank", category: "vehicles", iconPath: "/stratmap/assets/tank-light.png" },
  { id: "tank-recon", label: "Recon Tank", category: "vehicles", iconPath: "/stratmap/assets/tank-recon.png" },
  { id: "truck-jeep", label: "Jeep", category: "vehicles", iconPath: "/stratmap/assets/truck-jeep.png" },
  { id: "truck-supply", label: "Supply Truck", category: "vehicles", iconPath: "/stratmap/assets/truck-supply.png" },
  { id: "truck-transport", label: "Transport Truck", category: "vehicles", iconPath: "/stratmap/assets/truck-transport.png" },
  { id: "class-commander", label: "Commander", category: "classes", iconPath: "/stratmap/assets/class-commander.png" },
  { id: "class-officer", label: "Officer", category: "classes", iconPath: "/stratmap/assets/class-officer.png" },
  { id: "class-rifleman", label: "Rifleman", category: "classes", iconPath: "/stratmap/assets/class-rifleman.png" },
  { id: "class-assault", label: "Assault", category: "classes", iconPath: "/stratmap/assets/class-assault.png" },
  { id: "class-auto-rifleman", label: "Automatic Rifleman", category: "classes", iconPath: "/stratmap/assets/class-auto-rifleman.png" },
  { id: "class-medic", label: "Medic", category: "classes", iconPath: "/stratmap/assets/class-medic.png" },
  { id: "class-support", label: "Support", category: "classes", iconPath: "/stratmap/assets/class-support.png" },
  { id: "class-machine-gunner", label: "Machine Gunner", category: "classes", iconPath: "/stratmap/assets/class-machine-gunner.png" },
  { id: "class-anti-tank", label: "Anti-Tank", category: "classes", iconPath: "/stratmap/assets/class-anti-tank.png" },
  { id: "class-engineer", label: "Engineer", category: "classes", iconPath: "/stratmap/assets/class-engineer.png" },
  { id: "class-spotter", label: "Spotter", category: "classes", iconPath: "/stratmap/assets/class-spotter.png" },
  { id: "class-sniper", label: "Sniper", category: "classes", iconPath: "/stratmap/assets/class-sniper.png" },
  { id: "at-gun", label: "AT Gun", category: "buildables", iconPath: "/stratmap/assets/at-gun-plain.png" },
  { id: "repair-station", label: "Repair Station", category: "buildables", iconPath: "/stratmap/assets/repair-station.png" },
  { id: "node-batch", label: "Batch of Nodes", category: "buildables", iconPath: "/stratmap/assets/node-batch.png" },
  { id: "node-manpower", label: "Manpower Node", category: "buildables", iconPath: "/stratmap/assets/node-manpower.png" },
  { id: "node-munition", label: "Munitions Node", category: "buildables", iconPath: "/stratmap/assets/node-munition.png" },
  { id: "node-fuel", label: "Fuel Node", category: "buildables", iconPath: "/stratmap/assets/node-fuel.png" },
  { id: "supplies-50", label: "Supplies (50)", category: "placeables", iconPath: "/stratmap/assets/supplies-50.png" },
  { id: "supplies-50x2", label: "Supplies (50 x 2)", category: "placeables", iconPath: "/stratmap/assets/supplies-50x2.png" },
  { id: "supplies-100", label: "Supplies (100)", category: "placeables", iconPath: "/stratmap/assets/supplies-100.png" },
  { id: "supplies-150", label: "Supplies (150)", category: "placeables", iconPath: "/stratmap/assets/supplies-150.png" },
  { id: "supplies-150x2", label: "Supplies (150 x 2)", category: "placeables", iconPath: "/stratmap/assets/supplies-150x2.png" },
  { id: "box-ammo", label: "Ammo Box", category: "placeables", iconPath: "/stratmap/assets/box-ammo.png" },
  { id: "box-explosive", label: "Explosive Box", category: "placeables", iconPath: "/stratmap/assets/box-explosive.png" },
  { id: "box-bandage", label: "Bandage Box", category: "placeables", iconPath: "/stratmap/assets/box-bandage.png" },
  { id: "mine-at", label: "AT Mine", category: "placeables", iconPath: "/stratmap/assets/mine-at.png" },
  { id: "mine-ap", label: "AP Mine", category: "placeables", iconPath: "/stratmap/assets/mine-ap.png" },
  { id: "arty-effect", label: "Artillery with Full AOE", category: "markers", iconPath: "/stratmap/assets/arty-effect.png" },
  { id: "enemy-garry", label: "Enemy Garrison", category: "markers", iconPath: "/stratmap/assets/enemy-garry.png" },
  { id: "enemy-infantry", label: "Enemy Infantry", category: "markers", iconPath: "/stratmap/assets/enemy-infantry.png" },
  { id: "enemy-op", label: "Enemy Outpost", category: "markers", iconPath: "/stratmap/assets/enemy-op.png" },
  { id: "enemy-tank", label: "Enemy Tank", category: "markers", iconPath: "/stratmap/assets/enemy-tank.png" },
  { id: "enemy-vehicle", label: "Enemy Light Vehicle", category: "markers", iconPath: "/stratmap/assets/enemy-vehicle.png" },
  { id: "supply-drop", label: "Supply Drop", category: "abilities", iconPath: "/stratmap/assets/supply-drop.png" },
  { id: "ammo-drop", label: "Ammo Drop", category: "abilities", iconPath: "/stratmap/assets/ammo-drop.png" },
  { id: "airhead-drop", label: "Airhead Drop", category: "abilities", iconPath: "/stratmap/assets/airhead-drop.png" },
  { id: "reinforce", label: "Reinforce", category: "abilities", iconPath: "/stratmap/assets/reinforce.png" },
  { id: "precision-strike", label: "Precision Strike", category: "abilities", iconPath: "/stratmap/assets/precision-strike.png" },
  { id: "strafing-run", label: "Strafing Run", category: "abilities", iconPath: "/stratmap/assets/strafing-run.png" },
  { id: "bombing-run", label: "Bombing Run", category: "abilities", iconPath: "/stratmap/assets/bombing-run.png" },
  { id: "katyusha-strike", label: "Katyusha Strike", category: "abilities", iconPath: "/stratmap/assets/katyusha-strike.png" },
  { id: "render-distance-radiuses", label: "Render Distance Radiuses", category: "special", iconPath: "/stratmap/assets/render-distance-radiuses.png" },
  { id: "plain-grid", label: "Plain Grid", category: "special", iconPath: "/stratmap/assets/plain-grid.png" },
  { id: "center-mark", label: "Center Mark", category: "special", iconPath: "/stratmap/assets/center-mark.png" },
  { id: "arty", label: "Artillery", category: "special", iconPath: "/stratmap/assets/arty.png" },
];

async function ensureDirectory(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function copyFileIfPresent(source, target) {
  try {
    await fs.copyFile(source, target);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
}

function normalizeStrongpointName(mapId, rowIndex, columnIndex) {
  return `${MAP_NAME_BY_ID[mapId] ?? mapId} ${String.fromCharCode(65 + columnIndex)}${rowIndex + 1}`;
}

function toPixelCoordinate(value, totalMeters) {
  const totalUnits = totalMeters * 100;
  const halfUnits = totalUnits / 2;
  return Math.round(((value + halfUnits) / totalUnits) * 1920);
}

function getActualStrongpointNames(mapDatabase, mapId) {
  const databaseKey = GARRISON_MAP_KEY_BY_MAP_ID[mapId];
  if (!databaseKey) {
    return [];
  }

  const entry = mapDatabase[databaseKey];
  if (!entry) {
    return [];
  }

  return (entry.strongpoints ?? [])
    .filter((point) => point.type === "strongpoint")
    .map((point) => ({
      label: point.label,
      x: toPixelCoordinate(point.gameX, entry.widthMeters),
      y: toPixelCoordinate(-point.gameY, entry.heightMeters),
    }));
}

function mergeStrongpointLabels(mapId, strongpoints, actualStrongpoints) {
  if (!actualStrongpoints.length) {
    return strongpoints;
  }

  const unmatched = [...actualStrongpoints];

  return strongpoints.map((point) => {
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;

    unmatched.forEach((actualPoint, index) => {
      const distance = Math.hypot(point.center.x - actualPoint.x, point.center.y - actualPoint.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    if (bestIndex === -1) {
      return point;
    }

    const [match] = unmatched.splice(bestIndex, 1);
    return {
      ...point,
      label: match?.label ?? normalizeStrongpointName(mapId, 0, 0),
    };
  });
}

function toStrongpoint(mapId, rowIndex, columnIndex, rectGroups) {
  const rects = rectGroups.map(([x, y, width, height]) => ({ x, y, width, height }));
  const bounds = getStrongpointBounds(rects);
  const centerX = rects.reduce((sum, rect) => sum + rect.x + rect.width / 2, 0) / rects.length;
  const centerY = rects.reduce((sum, rect) => sum + rect.y + rect.height / 2, 0) / rects.length;

  return {
    id: `${String.fromCharCode(65 + columnIndex)}${rowIndex + 1}`.toLowerCase(),
    label: normalizeStrongpointName(mapId, rowIndex, columnIndex),
    grid: `${String.fromCharCode(65 + columnIndex)}${rowIndex + 1}`,
    center: {
      x: Math.round(centerX),
      y: Math.round(centerY),
    },
    bounds,
    rects,
    spritePath: `/stratmap/strongpoints/${mapId}/${String.fromCharCode(65 + columnIndex)}${rowIndex + 1}.png`,
  };
}

function getStrongpointBounds(rects) {
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

async function extractStrongpointSprite(sourceImagePath, rects, targetPath) {
  const bounds = getStrongpointBounds(rects);
  const composites = await Promise.all(
    rects.map(async (rect) => ({
      input: await sharp(sourceImagePath)
        .extract({ left: rect.x, top: rect.y, width: rect.width, height: rect.height })
        .png()
        .toBuffer(),
      left: rect.x - bounds.x,
      top: rect.y - bounds.y,
    })),
  );

  await ensureDirectory(path.dirname(targetPath));
  await sharp({
    create: {
      width: bounds.width,
      height: bounds.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toFile(targetPath);
}

function normalizePlacedDefaults(list = []) {
  return list.map((item) => ({
    type: item.type,
    modifier: item.modifier ?? null,
    x: Math.round(item.left ?? 0),
    y: Math.round(item.top ?? 0),
    angle: typeof item.angle === "number" ? item.angle : 0,
  }));
}

async function main() {
  const source = await fs.readFile(dataFile, "utf8");
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.__exports = { POINT_COORDS, DEFAULT_ELEMENTS };`, context);

  const { POINT_COORDS, DEFAULT_ELEMENTS } = context.__exports;
  const pointNamesSource = await fs.readFile(pointNamesFile, "utf8");
  const pointNamesContext = {};
  vm.createContext(pointNamesContext);
  vm.runInContext(`${pointNamesSource}\nthis.__mapDatabase = MAP_DATABASE;`, pointNamesContext);
  const mapDatabase = pointNamesContext.__mapDatabase;

  const maps = Object.entries(POINT_COORDS).map(([upstreamName, rows]) => {
    const mapId = MAP_ID_BY_UPSTREAM_NAME[upstreamName];
    if (!mapId) {
      throw new Error(`Missing map id mapping for ${upstreamName}`);
    }

    const strongpoints = [];
    rows.forEach((row, rowIndex) => {
      row.forEach((entry, columnIndex) => {
        if (!entry) {
          return;
        }

        strongpoints.push(toStrongpoint(mapId, rowIndex, columnIndex, entry));
      });
    });
    const mergedStrongpoints = mergeStrongpointLabels(mapId, strongpoints, getActualStrongpointNames(mapDatabase, mapId));

    const defaults = DEFAULT_ELEMENTS[upstreamName] ?? {};
    return {
      id: mapId,
      name: MAP_NAME_BY_ID[mapId] ?? upstreamName,
      upstreamName,
      imagePath: `/maps/${IMAGE_NAME_BY_ID[mapId]}`,
      mapSize: 1920,
      strongpoints: mergedStrongpoints,
      defaultElements: {
        offensiveGarrisons: {
          a: normalizePlacedDefaults(defaults.offensive_garrisons?.a),
          b: normalizePlacedDefaults(defaults.offensive_garrisons?.b),
        },
        artillery: {
          a: normalizePlacedDefaults(defaults.artillery?.a),
          b: normalizePlacedDefaults(defaults.artillery?.b),
        },
        tanks: {
          a: normalizePlacedDefaults(defaults.tank?.a),
          b: normalizePlacedDefaults(defaults.tank?.b),
        },
        trucks: {
          a: normalizePlacedDefaults(defaults.truck?.a),
          b: normalizePlacedDefaults(defaults.truck?.b),
        },
        commandSpawns: {
          a: normalizePlacedDefaults(defaults.command_spawn?.a),
          b: normalizePlacedDefaults(defaults.command_spawn?.b),
        },
        repairStations: {
          a: normalizePlacedDefaults(defaults.repair_stations?.a),
          b: normalizePlacedDefaults(defaults.repair_stations?.b),
        },
      },
    };
  });

  await ensureDirectory(path.dirname(outputDataFile));
  await ensureDirectory(publicMapsDir);
  await ensureDirectory(publicAssetsDir);
  await ensureDirectory(publicStrongpointsDir);

  await fs.writeFile(outputDataFile, `${JSON.stringify(maps, null, 2)}\n`, "utf8");
  await fs.writeFile(outputCatalogFile, `${JSON.stringify(PLACEABLE_CATALOG, null, 2)}\n`, "utf8");

  const upstreamMapDir = path.join(upstreamDir, "assets", "no-grid");
  for (const [mapId, fileName] of Object.entries(IMAGE_NAME_BY_ID)) {
    const upstreamName = Object.entries(MAP_ID_BY_UPSTREAM_NAME).find(([, id]) => id === mapId)?.[0];
    if (!upstreamName) {
      continue;
    }

    const sourceFileName = fileName
      .replace("el-alamein", "ElAlamein")
      .replace("elsenborn-ridge", "Elsenborn")
      .replace("hill-400", "Hill400")
      .replace("hurtgen-forest", "HurtgenV2")
      .replace("juno-beach", "Juno")
      .replace("omaha-beach", "Omaha")
      .replace("purple-heart-lane", "PHL")
      .replace("st-marie-du-mont", "SMDMV2")
      .replace("st-mere-eglise", "SME")
      .replace("utah-beach", "Utah");
    await copyFileIfPresent(
      path.join(upstreamMapDir, `${sourceFileName.replace(".webp", "")}_NoGrid.webp`),
      path.join(publicMapsDir, fileName),
    );
  }

  const upstreamStrongpointDir = path.join(upstreamDir, "assets", "points");
  for (const map of maps) {
    const strongpointSourceFile = path.join(upstreamStrongpointDir, `${map.upstreamName}_SP_NoMap2.png`);

    for (const point of map.strongpoints) {
      await extractStrongpointSprite(
        strongpointSourceFile,
        point.rects,
        path.join(publicStrongpointsDir, map.id, `${point.grid}.png`),
      );
    }
  }

  const assetFileNames = [...new Set(
    PLACEABLE_CATALOG
      .map((item) => item.iconPath.split("/").pop())
      .filter(Boolean),
  )];

  for (const assetFileName of assetFileNames) {
    await copyFileIfPresent(
      path.join(upstreamDir, "assets", assetFileName),
      path.join(publicAssetsDir, assetFileName),
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
