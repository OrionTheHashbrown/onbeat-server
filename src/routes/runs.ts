/**
 * RUNS HISTORY – POST /v1/runs, GET /v1/runs, GET /v1/runs/:id, DELETE /v1/runs/:id
 *
 * REFERENCE FROM
 * https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/
 * https://fastify.dev/docs/latest/Reference/Routes/
 * https://fastify.dev/docs/latest/Reference/Hooks/#prehandler
 */

import type { FastifyInstance } from 'fastify';
import { deleteRun, getRun, insertRun, listRuns, type RoutePoint, type RunInput } from '../services/runs-repo.js';

const maxSegments = 200;
const maxPointsPerSegment = 20_000;
const maxPlanSegments = 16;
const maxAdjustments = 250; 
const maxRunsPerPage = 50;
const defaultRunsPerPage = 20;
const tempoSegmentProperties = {
  id: { type: 'string', maxLength: 32 },
  name: { type: 'string', maxLength: 64 },
  targetBpm: { type: 'number' },
  targetEnergy: { type: 'number' },
  startMs: { type: 'integer', minimum: 0 },
  endMs: { type: 'integer', minimum: 0 },
} as const;

const adjustmentProperties = {
  atMs: { type: 'integer', minimum: 0 },
  deltaBpm: { type: 'number' },
  reason: {
    type: 'string',
    enum: ['struggling', 'recovered', 'manual-ease', 'manual-push', 'drop-push'],
  },
  stageId: { type: 'string', maxLength: 32 },
} as const;

const tempoSegmentInputSchema = {
  type: 'object',
  required: ['id', 'name', 'targetBpm', 'targetEnergy', 'startMs', 'endMs'],
  additionalProperties: false,
  properties: tempoSegmentProperties,
} as const;

const adjustmentInputSchema = {
  type: 'object',
  required: ['atMs', 'deltaBpm', 'reason', 'stageId'],
  additionalProperties: false,
  properties: adjustmentProperties,
} as const;

const runSummaryProperties = {
  id: { type: 'string' },
  startedAt: { type: 'string' },
  endedAt: { type: 'string' },
  movingMs: { type: 'number' },
  distanceM: { type: 'number' },
  avgPaceMsPerKm: { type: ['number', 'null'] },
  totalSteps: { type: ['number', 'null'] },
  avgCadenceSpm: { type: ['number', 'null'] },
  goalType: { type: ['string', 'null'] },
  goalAmount: { type: ['number', 'null'] },
  playlistId: { type: ['string', 'null'] },
} as const;

const runIdParams = {
  type: 'object',
  required: ['id'],
  additionalProperties: false,
  properties: {
    id: { type: 'string', format: 'uuid' },
  },
} as const;

const notFoundSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    message: { type: 'string' },
  },
} as const;

const notFoundBody = {
  error: 'run_not_found',
  message: 'That run is not in your history.',
};

const saveRunSchema = {
  tags: ['runs'],
  summary: 'Save one finished run, including its route and the tempo plan it was coached against.',
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['startedAt', 'endedAt', 'movingMs', 'distanceM'],
    additionalProperties: false, 
    properties: {
      startedAt: { type: 'string', format: 'date-time' },
      endedAt: { type: 'string', format: 'date-time' },
      movingMs: { type: 'integer', minimum: 0 },
      distanceM: { type: 'integer', minimum: 0 },
      avgPaceMsPerKm: { type: ['integer', 'null'], minimum: 0 },
      totalSteps: { type: ['integer', 'null'], minimum: 0 },
      avgCadenceSpm: { type: ['integer', 'null'], minimum: 0 },
      goalType: { type: ['string', 'null'], enum: ['time', 'distance', null] },
      goalAmount: { type: ['integer', 'null'] },
      playlistId: { type: ['string', 'null'], maxLength: 64 },
      plan: {
        type: 'array',
        maxItems: maxPlanSegments,
        items: tempoSegmentInputSchema,
      },
      adjustments: {
        type: 'array',
        maxItems: maxAdjustments,
        items: adjustmentInputSchema,
      },
      adaptiveMode: { type: ['boolean', 'null'] },
      trace: { type: ['object', 'null'] },
      route: {
        type: 'array',
        maxItems: maxSegments,
        items: {
          type: 'array',
          maxItems: maxPointsPerSegment,
          items: {
            type: 'array',
            minItems: 3,
            maxItems: 3,
            items: { type: 'number' },
          },
        },
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: { id: { type: 'string' } },
    },
  },
} as const;

const listRunsSchema = {
  tags: ['runs'],
  summary: 'This user’s runs, newest first. Without the route or the plan.',
  security: [{ bearerAuth: [] }],
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: maxRunsPerPage,
        default: defaultRunsPerPage,
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        runs: {
          type: 'array',
          items: { type: 'object', properties: runSummaryProperties },
        },
      },
    },
  },
} as const;

const getRunSchema = {
  tags: ['runs'],
  summary: 'One run, with its route, its tempo plan and what the coach moved. Without the trace.',
  security: [{ bearerAuth: [] }],
  params: runIdParams,
  response: {
    200: {
      type: 'object',
      properties: {
        ...runSummaryProperties,
        plan: { type: 'array', items: { type: 'object', properties: tempoSegmentProperties } },
        adjustments: { type: 'array', items: { type: 'object', properties: adjustmentProperties } },
        route: {
          type: 'array',
          items: { type: 'array', items: { type: 'array', items: { type: 'number' } } },
        },
        adaptiveMode: { type: ['boolean', 'null'] },
      },
    },
    404: notFoundSchema,
  },
} as const;

const deleteRunSchema = {
  tags: ['runs'],
  summary: 'Delete one of your runs.',
  security: [{ bearerAuth: [] }],
  params: runIdParams,
  response: {
    200: {
      type: 'object',
      properties: { deleted: { type: 'boolean' } },
    },
    404: notFoundSchema,
  },
} as const;

export async function runRoutes(fastify: FastifyInstance) {
  // SAVE one finished run
  fastify.post(
    '/v1/runs',
    {
      preHandler: [fastify.authenticate],
      schema: saveRunSchema,
    },
    async (request) => {
      const body = request.body as RunInput;
      const userId = request.user!.id;
      const route = body.route ?? [];

      const id = await insertRun(request.supabaseAsUser(), userId, {
        ...body,
        plan: body.plan ?? [],
        adjustments: body.adjustments ?? [],
        adaptiveMode: body.adaptiveMode ?? null,
        trace: body.trace ?? null,
        route,
      });

      let traceNote = ' no trace';
      if (body.trace) {
        traceNote =
          ' trace ' + countTraceItems(body.trace, 'samples') + ' sample(s)/' +
          countTraceItems(body.trace, 'events') + ' event(s)';
      }

      request.log.info(
        '[runs.ts] saved ' + id + ' — ' + body.distanceM + ' m in ' + Math.round(body.movingMs / 1000) + 's, ' +
          countRoutePoints(route) + ' point(s) over ' + route.length + ' segment(s),' + traceNote,
      );

      return { id };
    },
  );

  // LIST the user's runs, newest first
  fastify.get(
    '/v1/runs',
    {
      preHandler: [fastify.authenticate],
      schema: listRunsSchema,
    },
    async (request) => {
      const { limit = defaultRunsPerPage } = request.query as { limit?: number };
      const runs = await listRuns(request.supabaseAsUser(), limit);

      return { runs };
    },
  );

  // GET one run for the run detail screen
  fastify.get(
    '/v1/runs/:id',
    {
      preHandler: [fastify.authenticate],
      schema: getRunSchema,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const run = await getRun(request.supabaseAsUser(), id);
      if (!run) {
        return reply.code(404).send(notFoundBody);
      }

      request.log.info(
        '[runs.ts] read ' + id + ' — ' + countRoutePoints(run.route) + ' point(s) over ' +
          run.route.length + ' segment(s), ' + run.plan.length + ' plan stage(s), ' +
          run.adjustments.length + ' adjustment(s)',
      );

      return run;
    },
  );

  // DELETE one run
  fastify.delete(
    '/v1/runs/:id',
    {
      preHandler: [fastify.authenticate],
      schema: deleteRunSchema,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const wasDeleted = await deleteRun(request.supabaseAsUser(), id);
      if (!wasDeleted) {
        return reply.code(404).send(notFoundBody);
      }
      request.log.info('[runs.ts] deleted ' + id);
      return { deleted: true };
    },
  );
}

function countTraceItems(trace: object, key: 'samples' | 'events'): number {
  const value = (trace as Record<string, unknown>)[key];
  if (Array.isArray(value)) {
    return value.length;
  }
  return 0;
}

function countRoutePoints(route: RoutePoint[][]): number {
  let total = 0;
  for (const segment of route) {
    total += segment.length;
  }
  return total;
}
