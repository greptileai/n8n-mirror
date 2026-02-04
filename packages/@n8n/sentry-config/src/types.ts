import type { ErrorEvent, EventHint, Exception } from '@sentry/node';

/** Returns true if the error should be filtered out (not sent to Sentry) */
export type ErrorFilter = (event: ErrorEvent, hint: EventHint) => boolean;

/** Returns event to send, or null to filter out */
export type BeforeSend = (
	event: ErrorEvent,
	hint: EventHint,
) => ErrorEvent | null | Promise<ErrorEvent | null>;

export interface IgnoredErrorPattern {
	instanceof: new (
		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Constructor args can be anything
		...args: any[]
	) => Error;
	message?: string | RegExp;
}

export interface BeforeSendFilterOptions {
	additionalFilter?: ErrorFilter;
	seenErrors?: Set<string>;
}

export type { ErrorEvent, EventHint, Exception };
