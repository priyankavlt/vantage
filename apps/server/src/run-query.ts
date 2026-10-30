import { QueryError, resolveQueryLimits } from '@vantage/connectors';
import type { QueryResult } from '@vantage/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AppContext } from './context';
import { HttpError } from './errors';
import { findDataSource } from './routes/data-sources';

export const MAX_CONCURRENT_QUERIES_PER_WORKSPACE = 5;

const STATUS_FOR: Record<QueryError['code'], number> = {
  QUERY_FAILED: 400,
  TIMEOUT: 408,
  CANCELLED: 499,
  CONNECTION_FAILED: 502,
};

export interface RunOptions {
  workspaceId: string;
  dataSourceId: string;
  sql: string;
  timeoutMs?: number | undefined;
  maxRows?: number | undefined;
  /** Cancel when the HTTP client disconnects. Off for results shared between requests. */
  cancelOnDisconnect?: boolean;
}

/**
 * The single path for running user SQL: workspace-scoped data source lookup,
 * per-workspace concurrency cap, read-only limits, and cancellation when the
 * HTTP client disconnects. Query failures become typed `HttpError`s.
 */
export async function runForRequest(
  ctx: AppContext,
  request: FastifyRequest,
  reply: FastifyReply,
  options: RunOptions,
): Promise<QueryResult> {
  const row = await findDataSource(ctx, options.workspaceId, options.dataSourceId);
  const release = ctx.queryLimiter.tryAcquire(options.workspaceId);
  if (!release) {
    throw new HttpError(
      429,
      'TOO_MANY_QUERIES',
      `At most ${MAX_CONCURRENT_QUERIES_PER_WORKSPACE} queries can run at once in a workspace`,
    );
  }
  const controller = new AbortController();
  const onClose = () => {
    if (!reply.raw.writableEnded) controller.abort();
  };
  const cancelOnDisconnect = options.cancelOnDisconnect ?? true;
  if (cancelOnDisconnect) request.raw.socket.once('close', onClose);
  try {
    return await ctx.connections.get(row).execute(
      options.sql,
      resolveQueryLimits({
        timeoutMs: options.timeoutMs,
        maxRows: options.maxRows,
        signal: controller.signal,
      }),
    );
  } catch (error) {
    if (error instanceof QueryError) {
      throw new HttpError(
        STATUS_FOR[error.code],
        error.code,
        error.message,
        error.position === undefined ? undefined : { position: error.position },
      );
    }
    throw error;
  } finally {
    request.raw.socket.off('close', onClose);
    release();
  }
}
