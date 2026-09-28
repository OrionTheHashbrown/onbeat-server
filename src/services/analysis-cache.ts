/**
 * ANALYSIS CACHE – src/services/analysis-cache.ts
 *
 * REFERENCE FROM
 * https://supabase.com/docs/reference/javascript/upsert
 * https://supabase.com/docs/reference/javascript/select
 * https://supabase.com/docs/guides/database/postgres/row-level-security
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const analysisTable = 'track_analysis';

export type AnalysisStatus = 'ok' | 'not_found' | 'error';

export type CachedAnalysis = {
  spotifyTrackId: string;
  title: string;
  artist: string;
  durationMs: number | null; 
  bpm: number | null;
  musicKey: string | null;
  mode: string | null;
  camelot: string | null;
  energy: number | null;
  danceability: number | null;
  happiness: number | null;
  matchedSlug: string | null;
  status: AnalysisStatus;
  analyzedAt: string;
};

type AnalysisRow = {
  spotify_track_id: string;
  title: string;
  artist: string;
  duration_ms: number | null;
  bpm: number | null;
  music_key: string | null;
  mode: string | null;
  camelot: string | null;
  energy: number | null;
  danceability: number | null;
  happiness: number | null;
  matched_slug: string | null;
  status: AnalysisStatus;
  analyzed_at: string;
};

// GET the cache rows by Spotify Track ID
export async function getCachedAnalysesByTrackIds(supabaseAdmin: SupabaseClient, spotifyTrackIds: string[]): Promise<Map<string, CachedAnalysis>> {
  const cached = new Map<string, CachedAnalysis>();
  if (spotifyTrackIds.length === 0) {
    return cached;
  }

  const { data, error } = await supabaseAdmin
    .from(analysisTable)
    .select('*')
    .in('spotify_track_id', spotifyTrackIds);

  if (error) {
    throw new Error('[analysis-cache.ts] could not read the cache: ' + error.message);
  }

  for (const row of (data ?? []) as AnalysisRow[]) {
    cached.set(row.spotify_track_id, toCachedAnalysis(row));
  }
  return cached;
}

// SAVE the cache rows by Spotify Track ID
export async function saveCachedAnalyses(supabaseAdmin: SupabaseClient, rows: CachedAnalysis[]): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const databaseRows: AnalysisRow[] = [];
  for (const row of rows) {
    databaseRows.push(toAnalysisRow(row));
  }

  const { error } = await supabaseAdmin
    .from(analysisTable)
    .upsert(databaseRows, { onConflict: 'spotify_track_id' });

  if (error) {
    throw new Error('[analysis-cache.ts] could not write the cache: ' + error.message);
  }
}

function toNumberOrNull(value: number | string | null): number | null {
  if (value === null) {
    return null;
  }
  return Number(value);
}

function toCachedAnalysis(row: AnalysisRow): CachedAnalysis {
  return {
    spotifyTrackId: row.spotify_track_id,
    title: row.title,
    artist: row.artist,
    durationMs: row.duration_ms,
    bpm: toNumberOrNull(row.bpm),
    musicKey: row.music_key,
    mode: row.mode,
    camelot: row.camelot,
    energy: toNumberOrNull(row.energy),
    danceability: toNumberOrNull(row.danceability),
    happiness: toNumberOrNull(row.happiness),
    matchedSlug: row.matched_slug,
    status: row.status,
    analyzedAt: row.analyzed_at,
  };
}

function toAnalysisRow(analysis: CachedAnalysis): AnalysisRow {
  return {
    spotify_track_id: analysis.spotifyTrackId,
    title: analysis.title,
    artist: analysis.artist,
    duration_ms: analysis.durationMs,
    bpm: analysis.bpm,
    music_key: analysis.musicKey,
    mode: analysis.mode,
    camelot: analysis.camelot,
    energy: analysis.energy,
    danceability: analysis.danceability,
    happiness: analysis.happiness,
    matched_slug: analysis.matchedSlug,
    status: analysis.status,
    analyzed_at: analysis.analyzedAt,
  };
}
