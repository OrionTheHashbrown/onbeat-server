/**
 * TRACK ANALYSIS – POST /v1/tracks/analysis
 *
 * REFERENCE FROM
 * https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/
 * https://fastify.dev/docs/latest/Reference/Routes/
 * https://fastify.dev/docs/latest/Reference/Hooks/
 */

import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
import { getCachedAnalysesByTrackIds, saveCachedAnalyses, type AnalysisStatus, type CachedAnalysis } from '../services/analysis-cache.js';
import { getTrackAnalysisBySpotifyTrackID, SoundNetRateLimitError } from '../services/soundnet.js';
import { readCues, type TrackCue } from '../services/cues-repo.js';
import { env } from '../env.js';

// SET MAX no. of tracks per request
const maxTracksPerRequest = 50;

type TrackInput = {
  id: string;
  title: string;
  artist: string;
  durationMs?: number; 
};

type AnalysisResult = {
  bpm: number | null;
  key: string | null;
  mode: string | null;
  camelot: string | null;
  energy: number | null;
  danceability: number | null;
  happiness: number | null;
  matchedSlug: string | null;
  status: AnalysisStatus;
  cues?: TrackCue[]; 
};

const analysisSchema = {
  tags: ['tracks'],
  summary: 'Fetch BPM and key for up to 50 Spotify tracks.',
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['tracks'],
    additionalProperties: false,
    properties: {
      tracks: {
        type: 'array',
        minItems: 1,
        maxItems: maxTracksPerRequest,
        items: {
          type: 'object',
          required: ['id', 'title', 'artist'],
          additionalProperties: false,
          properties: {
            id: { type: 'string', minLength: 1, maxLength: 64 },
            title: { type: 'string', minLength: 1, maxLength: 300 },
            artist: { type: 'string', minLength: 1, maxLength: 300 },
            durationMs: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        results: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            properties: {
              bpm: { type: ['number', 'null'] },
              key: { type: ['string', 'null'] },
              mode: { type: ['string', 'null'] },
              camelot: { type: ['string', 'null'] },
              energy: { type: ['number', 'null'] },
              danceability: { type: ['number', 'null'] },
              happiness: { type: ['number', 'null'] },
              matchedSlug: { type: ['string', 'null'] },
              status: { type: 'string' },
              cues: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    atMs: { type: 'integer' },
                    kind: { type: 'string' },
                    leadMs: { type: 'integer' },
                    pushBpm: { type: ['integer', 'null'] },
                    holdMs: { type: ['integer', 'null'] },
                    label: { type: ['string', 'null'] },
                  },
                },
              },
            },
          },
        },
        stats: {
          type: 'object',
          properties: {
            cached: { type: 'number' },
            fetched: { type: 'number' },
            notFound: { type: 'number' },
            rateLimited: { type: 'number' },
          },
        },
        cacheWriteFailed: { type: 'boolean' },
        partial: { type: 'boolean' }, 
      },
    },
  },
} as const;

export async function trackRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/v1/tracks/analysis',
    {
      preHandler: [fastify.authenticate],
      schema: analysisSchema,
    },
    async (request) => {
      const { tracks } = request.body as { tracks: TrackInput[] };

      // ENSURES that tracks are the ones we have NOT cached yet
      const uniqueTracks = new Map<string, TrackInput>();
      for (const track of tracks) {
        uniqueTracks.set(track.id, track);
      }
      const ids = [...uniqueTracks.keys()];

      // SPLIT the songs into "already cached tracks" and "new tracks"
      const cached = await getCachedAnalysesByTrackIds(fastify.supabaseAdmin, ids);
      const results: Record<string, AnalysisResult> = {};
      const newTracks: TrackInput[] = [];
      const needsDuration: CachedAnalysis[] = [];
      let cachedCount = 0;

      for (const [id, track] of uniqueTracks) {
        const row = cached.get(id);

        if (!row) {
          newTracks.push(track);
          continue;
        }

        if (row.durationMs === null && track.durationMs !== undefined) {
          needsDuration.push({ ...row, durationMs: track.durationMs });
        }

        results[id] = toAnalysisResult(row);
        cachedCount += 1;
      }

      let durationNote = '';
      if (needsDuration.length > 0) {
        durationNote = ' (' + needsDuration.length + ' backfilling duration)';
      }
      request.log.info(
        '[tracks.ts] ' + ids.length + ' track(s) asked for: ' + cachedCount + ' already cached' + durationNote +
          ', ' + newTracks.length + ' to look up at ' + env.soundnetChunkSize + ' at a time',
      );

      const fetched: CachedAnalysis[] = [];
      let rateLimitedCount = 0;
      const startedAt = Date.now();

      for (const group of splitIntoGroups(newTracks, env.soundnetChunkSize)) {
        const lookups: Promise<CachedAnalysis | null>[] = [];
        for (const track of group) {
          lookups.push(analyseTrack(track, request.log));
        }
        const groupResults = await Promise.all(lookups);
        for (const row of groupResults) {
          if (row) {
            fetched.push(row);
          } else {
            rateLimitedCount += 1;
          }
        }
      }

      if (rateLimitedCount > 0) {
        request.log.warn(
          '[tracks.ts] ' + rateLimitedCount + ' track(s) rate-limited after retries — left uncached to retry next load',
        );
      }

      // SAVE to the cache
      let cacheWriteFailed = false;
      try {
        await saveCachedAnalyses(fastify.supabaseAdmin, [...fetched, ...needsDuration]);
      } catch (error) {
        cacheWriteFailed = true;
        request.log.error(
          { err: String(error) },
          '[tracks.ts] CACHE WRITE FAILED.',
        );
      }

      for (const row of fetched) {
        results[row.spotifyTrackId] = toAnalysisResult(row);
      }

      const cues = await readCues(fastify.supabaseAdmin, ids, request.log);
      for (const [id, songCues] of cues) {
        const result = results[id];
        if (result) {
          result.cues = songCues;
        }
      }

      if (cues.size > 0) {
        request.log.info('[tracks.ts] ' + cues.size + ' track(s) carry hand-tagged cues');
      }

      // COUNT how many were found vs not found
      let okCount = 0;
      for (const row of fetched) {
        if (row.status === 'ok') {
          okCount += 1;
        }
      }
      const notFoundCount = fetched.length - okCount;

      if (newTracks.length > 0) {
        const secondsTaken = ((Date.now() - startedAt) / 1000).toFixed(1);
        let cacheNote = '';
        if (cacheWriteFailed) {
          cacheNote = ', NOT CACHED';
        }
        request.log.info(
          '[tracks.ts] looked up ' + newTracks.length + ' in ' + secondsTaken + 's — ' +
            okCount + ' ok, ' + notFoundCount + ' not found, ' + rateLimitedCount + ' rate-limited' + cacheNote,
        );
      }

      return {
        results,
        stats: {
          cached: cachedCount,
          fetched: okCount,
          notFound: notFoundCount,
          rateLimited: rateLimitedCount,
        },
        partial: rateLimitedCount > 0 || cacheWriteFailed,
        cacheWriteFailed,
      };
    },
  );
}

// LOOKUP one track at a time
async function analyseTrack(track: TrackInput, log: FastifyBaseLogger): Promise<CachedAnalysis | null> {
  const baseRow = {
    spotifyTrackId: track.id,
    durationMs: track.durationMs ?? null,
    title: track.title,
    artist: track.artist,
    analyzedAt: new Date().toISOString(),
  };

  const emptyAnalysis = {
    bpm: null,
    musicKey: null,
    mode: null,
    camelot: null,
    energy: null,
    danceability: null,
    happiness: null,
    matchedSlug: null,
  };

  try {
    const analysis = await getTrackAnalysisBySpotifyTrackID(track.id, log);

    if (!analysis) {
      return { ...baseRow, ...emptyAnalysis, status: 'not_found' };
    }
    return { ...baseRow, ...analysis, status: 'ok' };
  } catch (error) {
    if (error instanceof SoundNetRateLimitError) {
      return null;
    }
    return { ...baseRow, ...emptyAnalysis, status: 'error' };
  }
}

function toAnalysisResult(row: CachedAnalysis): AnalysisResult {
  return {
    bpm: row.bpm,
    key: row.musicKey,
    mode: row.mode,
    camelot: row.camelot,
    energy: row.energy,
    danceability: row.danceability,
    happiness: row.happiness,
    matchedSlug: row.matchedSlug,
    status: row.status,
  };
}

function splitIntoGroups<Item>(items: Item[], size: number): Item[][] {
  const groups: Item[][] = [];
  for (let start = 0; start < items.length; start += size) {
    groups.push(items.slice(start, start + size));
  }
  return groups;
}
