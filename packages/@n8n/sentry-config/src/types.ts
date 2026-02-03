import type { ErrorEvent, EventHint, Exception } from '@sentry/node';

/**
 * Filter function that determines whether an error should be filtered out.
 * Returns true if the error should be filtered (not sent to Sentry).
 */
export type ErrorFilter = (event: ErrorEvent, hint: EventHint) => boolean;

/**
 * BeforeSend function for Sentry. Returns the event if it should be sent,
 * or null if it should be filtered out.
 */
export type BeforeSend = (
	event: ErrorEvent,
	hint: EventHint,
) => ErrorEvent | null | Promise<ErrorEvent | null>;

/**
 * Configuration for ignored error patterns used by frontend.
 */
export interface IgnoredErrorPattern {
	/** The error class to match */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	instanceof: new (
		...args: any[]
	) => Error;
	/** Optional message pattern to match */
	message?: string | RegExp;
}

/**
 * Options for beforeSend filter composition.
 * Used by createBackendBeforeSend.
 */
export interface BeforeSendFilterOptions {
	/**
	 * Additional custom filter to apply.
	 * Return true if the error should be filtered out.
	 */
	additionalFilter?: ErrorFilter;

	/**
	 * Set of hashes already seen, for deduplication.
	 * If not provided, a new Set will be created.
	 */
	seenErrors?: Set<string>;
}

/**
 * Re-export Sentry types for convenience.
 */
export type { ErrorEvent, EventHint, Exception };
