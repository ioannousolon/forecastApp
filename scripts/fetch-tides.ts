/**
 * Pre-fetches tide predictions for all tidal spots into public/tides.json, so the deployed app
 * reads a static file instead of every visitor spending WorldTides credits on every spot click.
 * Run on a schedule via .github/workflows/update-tides.yml (weekly) — see the plan for the
 * credit math. Run locally with: WORLDTIDES_API_KEY=xxx npx tsx scripts/fetch-tides.ts
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { SPOTS } from "../src/lib/spots.ts";

// Not tidal — a river gorge ~150km inland, tide isn't meaningfully relevant there.
const EXCLUDED_SPOT_IDS = new Set(["hood-river"]);

const WINDOW_DAYS = 7; // 1 WorldTides credit per spot at this window size

const OUTPUT_PATH = fileURLToPath(new URL("../public/tides.json", import.meta.url));

interface TideHeight {
  dt: number;
  height: number;
}

interface TidesFile {
  [spotId: string]: {
    fetchedAt: string;
    heights: TideHeight[];
  };
}

async function loadExisting(): Promise<TidesFile> {
  try {
    return JSON.parse(await readFile(OUTPUT_PATH, "utf-8"));
  } catch {
    return {};
  }
}

async function fetchSpotTides(lat: number, lon: number, apiKey: string): Promise<TideHeight[]> {
  const start = Math.floor(Date.now() / 1000);
  const length = WINDOW_DAYS * 86400;
  const url = `https://www.worldtides.info/api/v3?heights&lat=${lat}&lon=${lon}&start=${start}&length=${length}&key=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { heights?: { dt: number; height: number }[]; error?: string };
  if (!data.heights) throw new Error(data.error ?? "no heights in response");
  return data.heights.map((h) => ({ dt: h.dt, height: h.height }));
}

async function main() {
  const apiKey = process.env.WORLDTIDES_API_KEY;
  if (!apiKey) {
    console.error("WORLDTIDES_API_KEY is not set — aborting.");
    process.exit(1);
  }

  const tidalSpots = SPOTS.filter((s) => !EXCLUDED_SPOT_IDS.has(s.id));
  const existing = await loadExisting();
  const result: TidesFile = { ...existing };

  let succeeded = 0;
  let failed = 0;

  for (const spot of tidalSpots) {
    try {
      const heights = await fetchSpotTides(spot.lat, spot.lon, apiKey);
      result[spot.id] = { fetchedAt: new Date().toISOString(), heights };
      succeeded++;
      console.log(`✓ ${spot.id}: ${heights.length} readings`);
    } catch (err) {
      failed++;
      console.warn(`✗ ${spot.id}: ${err instanceof Error ? err.message : err} — keeping previous data if any`);
    }
  }

  await writeFile(OUTPUT_PATH, JSON.stringify(result, null, 2) + "\n");
  console.log(`Done: ${succeeded} updated, ${failed} failed/kept-stale. Wrote ${OUTPUT_PATH}`);
}

main();
