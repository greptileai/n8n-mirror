import {
	SPAN_STATUS_ERROR,
	SPAN_STATUS_OK,
	type StartSpanOptions as SentryStartSpanOptions,
	type SpanContextData as SentrySpanContextData,
} from '@sentry/core';
import type Sentry from '@sentry/node';

import { NoopTracing } from './noop-tracing';

export type StartSpanOpts = SentryStartSpanOptions;
export type Span = Sentry.Span;
export type SpanContextData = SentrySpanContextData;

/**
 * Interface for concrete tracing implementations
 */
export interface Tracer {
	startSpan<T>(options: StartSpanOpts, spanCb: (span: Span) => Promise<T>): Promise<T>;
}

const COMMON_TRACE_ATTRIBUTES = {
	workflow: {
		id: 'n8n.workflow.id',
		name: 'n8n.workflow.name',
	},
	node: {
		id: 'n8n.node.id',
		name: 'n8n.node.name',
		type: 'n8n.node.type',
		typeVersion: 'n8n.node.type_version',
	},
} as const;

export const enum SpanStatus {
	ok = SPAN_STATUS_OK,
	error = SPAN_STATUS_ERROR,
}

/**
 * Class to instrument the application with tracing. This class is a
 * singleton that delegates to the actual tracing implementation. The
 * tracing is active only if Sentry has been configured and tracing sampling
 * is enabled.
 *
 * @example
 * ```ts
 * Tracing.startSpan({
 * 	 name: "My Operation",
 *   attributes: {
 *     [Tracing.commonAttrs.workflow.id]: workflow.id,
 *   }
 * }, async (span) => {
 *   // Do the operation that is then traced
 * });
 * ```
 */
export class Tracing {
	private static instance: Tracer = new NoopTracing();

	/** Common n8n specific attribute names */
	static commonAttrs = COMMON_TRACE_ATTRIBUTES;

	/** Set the concrete tracing implementation to use */
	static setTracingImplementation(tracing: Tracer): void {
		Tracing.instance = tracing;
	}

	/** Start a span and execute the callback with the span */
	static async startSpan<T>(
		options: StartSpanOpts,
		spanCb: (span: Span) => Promise<T>,
	): Promise<T> {
		return await Tracing.instance.startSpan(options, spanCb);
	}
}
