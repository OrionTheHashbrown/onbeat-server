/**
 * RUNS – src/services/runs-repo.ts
 *
 * REFERENCE FROM
 * https://supabase.com/docs/reference/javascript/upsert
 * https://supabase.com/docs/reference/javascript/select
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const runsTable = 'runs';

const summaryColumns =
  'id, started_at, ended_at, moving_ms, distance_m, avg_pace_ms_per_km, total_steps, avg_cadence_spm, goal_type, goal_amount, playlist_id';
const detailColumns = `${summaryColumns}, plan, adjustments, route, adaptive_mode`;

export type TempoSegment = {
  id: string;
  name: string;
  targetBpm: number;
  targetEnergy: number;
  startMs: number;
  endMs: number;
};

export type RoutePoint = [number, number, number];

export type Adjustment = {
  atMs: number;
  deltaBpm: number;
  reason: 'struggling' | 'recovered' | 'manual-ease' | 'manual-push' | 'drop-push';
  stageId: string;
};

export type RunInput = {
  startedAt: string;
  endedAt: string;
  movingMs: number;
  distanceM: number;
  avgPaceMsPerKm: number | null;
  totalSteps: number | null;
  avgCadenceSpm: number | null;
  goalType: 'time' | 'distance' | null;
  goalAmount: number | null;
  playlistId: string | null;
  plan: TempoSegment[];
  adjustments: Adjustment[];
  route: RoutePoint[][];
  adaptiveMode: boolean | null; 
  trace: object | null; 
};

export type RunSummary = {
  id: string;
  startedAt: string;
  endedAt: string;
  movingMs: number;
  distanceM: number;
  avgPaceMsPerKm: number | null;
  totalSteps: number | null;
  avgCadenceSpm: number | null;
  goalType: 'time' | 'distance' | null;
  goalAmount: number | null;
  playlistId: string | null;
};

export type RunDetail = RunSummary & {
  plan: TempoSegment[];
  adjustments: Adjustment[];
  route: RoutePoint[][];
  adaptiveMode: boolean | null;
};

type RunRow = {
  id: string;
  started_at: string;
  ended_at: string;
  moving_ms: number;
  distance_m: number;
  avg_pace_ms_per_km: number | null;
  total_steps: number | null;
  avg_cadence_spm: number | null;
  goal_type: 'time' | 'distance' | null;
  goal_amount: number | null;
  playlist_id: string | null;
};

type RunDetailRow = RunRow & {
  plan: TempoSegment[];
  adjustments: Adjustment[];
  route: RoutePoint[][];
  adaptive_mode: boolean | null;
};

// INSERT and SAVE a run
export async function insertRun(client: SupabaseClient, userId: string, input: RunInput): Promise<string> {
  const { data, error } = await client
    .from(runsTable)
    .upsert(toRunRow(userId, input), {
      onConflict: 'user_id,started_at',
      ignoreDuplicates: true,
    })
    .select('id');
  if (error) {
    throw new Error('[runs-repo.ts] could not save the run: ' + error.message);
  }

  const insertedRow = data?.[0];
  if (insertedRow) {
    return insertedRow.id;
  }

  // CHECKS if run was already saved before
  const existing = await client
    .from(runsTable)
    .select('id')
    .eq('user_id', userId)
    .eq('started_at', input.startedAt)
    .single();

  if (existing.error) {
    throw new Error('[runs-repo.ts] the run was already saved but could not be read back: ' + existing.error.message);
  }

  return existing.data.id;
}

// LIST down all the user's runs, newest first
export async function listRuns(client: SupabaseClient, limit: number): Promise<RunSummary[]> {
  const { data, error } = await client
    .from(runsTable)
    .select(summaryColumns)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error('[runs-repo.ts] could not read the history: ' + error.message);
  }

  const runs: RunSummary[] = [];
  for (const row of data ?? []) {
    runs.push(toRunSummary(row));
  }
  return runs;
}

// GET one run details by ID
export async function getRun(client: SupabaseClient, id: string): Promise<RunDetail | null> {
  // maybeSingle() and NOT single(), single() treats "no row" as an error
  const { data, error } = await client
    .from(runsTable)
    .select(detailColumns)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error('[runs-repo.ts] could not read the run: ' + error.message);
  }

  if (!data) {
    return null;
  }
  return toRunDetail(data);
}

// DELETE one run by ID
export async function deleteRun(client: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await client.from(runsTable).delete().eq('id', id).select('id');

  if (error) {
    throw new Error('[runs-repo.ts] could not delete the run: ' + error.message);
  }

  if (!data || data.length === 0) {
    return false;
  }
  return true;
}

function toRunSummary(row: RunRow): RunSummary {
  return {
    id: row.id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    movingMs: row.moving_ms,
    distanceM: row.distance_m,
    avgPaceMsPerKm: row.avg_pace_ms_per_km,
    totalSteps: row.total_steps,
    avgCadenceSpm: row.avg_cadence_spm,
    goalType: row.goal_type,
    goalAmount: row.goal_amount,
    playlistId: row.playlist_id,
  };
}

function toRunDetail(row: RunDetailRow): RunDetail {
  return {
    ...toRunSummary(row),
    plan: row.plan,
    adjustments: row.adjustments,
    route: row.route,
    adaptiveMode: row.adaptive_mode,
  };
}

// CONVERT the input into a row for the database
function toRunRow(userId: string, input: RunInput) {
  return {
    user_id: userId, 
    started_at: input.startedAt,
    ended_at: input.endedAt,
    moving_ms: input.movingMs,
    distance_m: input.distanceM,
    avg_pace_ms_per_km: input.avgPaceMsPerKm,
    total_steps: input.totalSteps,
    avg_cadence_spm: input.avgCadenceSpm,
    goal_type: input.goalType,
    goal_amount: input.goalAmount,
    playlist_id: input.playlistId,
    plan: input.plan,
    adjustments: input.adjustments,
    route: input.route,
    adaptive_mode: input.adaptiveMode,
    trace: input.trace,
  };
}
