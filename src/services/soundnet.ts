/**
 * SOUNDNET TRACK ANALYSIS – src/services/soundnet.ts
 *
 * REFERENCE FROM
 * https://rapidapi.com/soundnet-soundnet-default/api/track-analysis
 */

import type { FastifyBaseLogger } from 'fastify';
import { env } from '../env.js';

const timeoutMs = 10_000;
const retryWaitsMs = [400, 1_200, 2_500];

export type SongAnalysis = {
  bpm: number;
  musicKey: string | null;
  mode: string | null;
  camelot: string | null;
  energy: number | null;
  danceability: number | null;
  happiness: number | null;
  matchedSlug: string | null; 
};

export class SoundNetRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SoundNetRateLimitError';
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// GET the analysis from SoundNet for one Spotify track by ID
export async function getTrackAnalysisBySpotifyTrackID(spotifyTrackId: string, log: FastifyBaseLogger): Promise<SongAnalysis | null> {
  const url = 'https://' + env.rapidapiHost + '/pktx/spotify/' + encodeURIComponent(spotifyTrackId);
  const maxTries = retryWaitsMs.length + 1;
  let startedAt: number;
  let response: Response;

  for (let attempt = 0; ; attempt += 1) {
    startedAt = Date.now();
    response = await fetch(url, {
      headers: {
        'x-rapidapi-key': env.rapidapiKey,
        'x-rapidapi-host': env.rapidapiHost,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (response.status !== 429) {
      break;
    }

    const waitMs = retryWaitsMs[attempt];
    if (waitMs === undefined) {
      throw new SoundNetRateLimitError('RapidAPI rate limit hit for ' + spotifyTrackId + '.');
    }
    log.info(
      '[soundnet.ts] ' + spotifyTrackId + ' 429 rate-limited, retrying in ' + waitMs + 'ms ' +
      '(attempt ' + (attempt + 2) + '/' + maxTries + ')',
    );
    await sleep(waitMs);
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    let errorText = '';
    try {
      errorText = await response.text();
    } catch { }
    log.warn('[soundnet.ts] ' + spotifyTrackId + ' HTTP ' + response.status + ': ' + errorText.slice(0, 300));
    throw new Error('[soundnet.ts] ' + response.status + ' from SoundNet: ' + errorText.slice(0, 200));
  }

  const rawBody = await response.text();
  const timeTakenMs = Date.now() - startedAt;

  log.debug('[soundnet.ts] ' + spotifyTrackId + ' raw response: ' + rawBody);

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    log.warn('[soundnet.ts] ' + spotifyTrackId + ' does not look like a valid JSON: ' + rawBody.slice(0, 200));
    return null;
  }

  const analysis = readAnalysis(body);

  if (analysis) {
    log.info(
      '[soundnet.ts] ' + spotifyTrackId + ' -> ' + (analysis.matchedSlug ?? '(no slug)') +
      '  ' + analysis.bpm + ' BPM  ' + (analysis.musicKey ?? '?') + ' ' + (analysis.mode ?? '') +
      ' camelot=' + (analysis.camelot ?? '?') +
      ' energy=' + (analysis.energy ?? '?') +
      ' dance=' + (analysis.danceability ?? '?') +
      '  ' + timeTakenMs + 'ms',
    );
  } else {
    log.info('[soundnet.ts] ' + spotifyTrackId + ' -> NOT FOUND  ' + timeTakenMs + 'ms');
  }

  return analysis;
}

const notFoundMatch = 'page-not-found';

function readAnalysis(body: Record<string, unknown>): SongAnalysis | null {
  const matchedSong = decodeMatchedSong(body['id']);
  if (matchedSong === notFoundMatch) {
    return null;
  }

  const bpm = readNumber(body['tempo']);
  if (bpm === null) {
    return null;
  }

  return {
    bpm,
    musicKey: readText(body['key']),
    mode: readText(body['mode']),
    camelot: readText(body['camelot']),
    energy: readNumber(body['energy']),
    danceability: readNumber(body['danceability']),
    happiness: readNumber(body['happiness']),
    matchedSlug: matchedSong,
  };
}

function decodeMatchedSong(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }
  try {
    const matchedSong = Buffer.from(value, 'base64').toString('utf8').trim();
    if (matchedSong.length === 0) {
      return null;
    }
    return matchedSong;
  } catch {
    return null;
  }
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return null;
}

function readText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmedText = value.trim();
  if (trimmedText.length === 0) {
    return null;
  }
  return trimmedText;
}
