import type { Span, StartSpanOpts, Tracer } from './tracing';

/**
 * Tracing implementation that does not trace anything
 */
export class NoopTracing implements Tracer {
	async startSpan<T>(_options: StartSpanOpts, spanCb: (span?: Span) => Promise<T>): Promise<T> {
		return await spanCb(undefined);
	}
}
