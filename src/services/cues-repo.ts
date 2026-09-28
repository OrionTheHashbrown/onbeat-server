/**
 * TRACK CUES – src/services/cues-repo.ts
 *
 * REFERENCE FROM
 * https://supabase.com/docs/reference/javascript/select
 * https://supabase.com/docs/reference/javascript/using-filters
 */

import type { FastifyBaseLogger } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';

const cuesTable = 'track_cues';

// SET limit for MAX cues per track
const maxCuesPerTrack = 12;

export type TrackCueKind = 'drop' | 'build' | 'chorus' | 'breakdown' | 'outro';

export type TrackCue = {
  atMs: number;
  kind: TrackCueKind;
  leadMs: number;
  pushBpm: number | null;
  holdMs: number | null;
  label: string | null;
};

type TrackCueRow = {
  spotify_track_id: string;
  at_ms: number;
  kind: TrackCueKind;
  lead_ms: number;
  push_bpm: number | null;
  hold_ms: number | null;
  label: string | null;
};

// GET the cues for these songs by Spotify ID
export async function readCues(
  supabase: SupabaseClient,
  spotifyTrackIds: string[],
  log: FastifyBaseLogger,
): Promise<Map<string, TrackCue[]>> {
  const cues = new Map<string, TrackCue[]>();
  if (spotifyTrackIds.length === 0) {
    return cues;
  }

  const { data, error } = await supabase
    .from(cuesTable)
    .select('spotify_track_id, at_ms, kind, lead_ms, push_bpm, hold_ms, label')
    .in('spotify_track_id', spotifyTrackIds)
    .order('at_ms', { ascending: true }); 
  if (error) {
    log.warn('[cues-repo.ts] could not read cues: ' + error.message);
    return cues;
  }

  for (const row of (data ?? []) as TrackCueRow[]) {
    let songCues = cues.get(row.spotify_track_id);
    if (!songCues) {
      songCues = [];
      cues.set(row.spotify_track_id, songCues);
    }

    if (songCues.length >= maxCuesPerTrack) {
      continue;
    }

    songCues.push(toTrackCue(row));
  }

  return cues;
}

function toTrackCue(row: TrackCueRow): TrackCue {
  let pushBpm: number | null = null;
  if (row.push_bpm !== null) {
    pushBpm = Number(row.push_bpm);
  }

  let holdMs: number | null = null;
  if (row.hold_ms !== null) {
    holdMs = Number(row.hold_ms);
  }

  return {
    atMs: row.at_ms,
    kind: row.kind,
    leadMs: Number(row.lead_ms),
    pushBpm,
    holdMs,
    label: row.label,
  };
}
