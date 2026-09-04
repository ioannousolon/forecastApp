import * as duckdb from "@duckdb/duckdb-wasm";
import duckdbWasmMvp from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import mvpWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import duckdbWasmEh from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import ehWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";

export interface ObservedReading {
  time: Date;
  windSpeedKt: number;
  windGustKt: number | null;
  windDirDeg: number | null;
}

let dbPromise: Promise<duckdb.AsyncDuckDB> | null = null;

async function getDb(): Promise<duckdb.AsyncDuckDB> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const bundle = await duckdb.selectBundle({
        mvp: { mainModule: duckdbWasmMvp, mainWorker: mvpWorker },
        eh: { mainModule: duckdbWasmEh, mainWorker: ehWorker },
      });
      const worker = new Worker(bundle.mainWorker!);
      const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING), worker);
      await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

      // Persist to OPFS so readings survive reloads; fall back to the transient in-memory
      // default (still fine within one session) if the browser doesn't support it.
      try {
        await db.open({ path: "opfs://kitesurf-station-history.duckdb", accessMode: duckdb.DuckDBAccessMode.READ_WRITE });
      } catch (err) {
        console.warn("DuckDB OPFS persistence unavailable, falling back to in-memory:", err);
      }

      const conn = await db.connect();
      // observed_at_ms is plain epoch-milliseconds (DOUBLE), not a TIMESTAMP column: DuckDB-Wasm's
      // Arrow TIMESTAMP results don't reliably round-trip through row.toJSON() as a parseable
      // string, so a plain number sidesteps that entirely.
      await conn.query(`
        CREATE TABLE IF NOT EXISTS station_readings (
          spot_id VARCHAR,
          observed_at_ms DOUBLE,
          wind_speed_kt DOUBLE,
          wind_gust_kt DOUBLE,
          wind_dir_deg DOUBLE
        )
      `);
      await conn.close();

      return db;
    })();
  }
  return dbPromise;
}

/** Records a station reading, skipping it if a reading within 10 minutes is already stored (avoids duplicate points on refresh/reload). */
export async function recordStationReading(spotId: string, reading: ObservedReading): Promise<void> {
  const db = await getDb();
  const conn = await db.connect();
  try {
    const ms = reading.time.getTime();
    const existing = await conn.query(`
      SELECT 1 FROM station_readings
      WHERE spot_id = '${spotId}' AND abs(observed_at_ms - ${ms}) < 600000
      LIMIT 1
    `);
    if (existing.numRows > 0) return;

    await conn.query(`
      INSERT INTO station_readings VALUES (
        '${spotId}',
        ${ms},
        ${reading.windSpeedKt},
        ${reading.windGustKt ?? "NULL"},
        ${reading.windDirDeg ?? "NULL"}
      )
    `);
  } finally {
    await conn.close();
  }
}

export async function getStationHistory(spotId: string, since: Date): Promise<ObservedReading[]> {
  const db = await getDb();
  const conn = await db.connect();
  try {
    const result = await conn.query(`
      SELECT observed_at_ms, wind_speed_kt, wind_gust_kt, wind_dir_deg
      FROM station_readings
      WHERE spot_id = '${spotId}' AND observed_at_ms >= ${since.getTime()}
      ORDER BY observed_at_ms
    `);
    return result.toArray().map((row) => {
      const r = row.toJSON() as Record<string, unknown>;
      return {
        time: new Date(Number(r.observed_at_ms)),
        windSpeedKt: Number(r.wind_speed_kt),
        windGustKt: r.wind_gust_kt == null ? null : Number(r.wind_gust_kt),
        windDirDeg: r.wind_dir_deg == null ? null : Number(r.wind_dir_deg),
      };
    });
  } finally {
    await conn.close();
  }
}

/** Drops readings older than the given cutoff, across all spots. Call occasionally to keep the local DB small. */
export async function pruneStationHistory(olderThan: Date): Promise<void> {
  const db = await getDb();
  const conn = await db.connect();
  try {
    await conn.query(`DELETE FROM station_readings WHERE observed_at_ms < ${olderThan.getTime()}`);
  } finally {
    await conn.close();
  }
}
