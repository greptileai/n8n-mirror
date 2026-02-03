import { ApplicationError, BaseError } from 'n8n-workflow';
import { createHash } from 'node:crypto';

import type {
	BeforeSendFilterOptions,
	BeforeSend,
	ErrorEvent,
	EventHint,
	IgnoredErrorPattern,
} from '../types';
import {
	extractEventDetailsFromN8nError,
	hasIgnoredCause,
	isIgnoredN8nError,
	isIgnoredSqliteError,
	shouldNotReportBaseError,
} from './backend';
import { DEFAULT_IGNORED_ERRORS, matchesIgnoredPattern } from './frontend';
import { isAxiosError } from './shared';

// Re-export individual filters for direct use if needed
export * from './backend';
export * from './frontend';
export * from './shared';
export * from './task-runner';

/**
 * Creates a beforeSend function for the backend (n8n-core).
 *
 * Filters out:
 * - AxiosErrors (external HTTP errors)
 * - SQLite disk/IO errors
 * - n8n warning/info level errors
 * - Errors with warning/info cause
 * - BaseErrors that shouldn't be reported
 * - Duplicate errors (deduplication by stack trace hash)
 *
 * Also extracts event details from n8n errors.
 *
 * @param options - Configuration options
 * @returns A beforeSend function for Sentry
 */
export function createBackendBeforeSend(options: BeforeSendFilterOptions = {}): BeforeSend {
	const { additionalFilter, seenErrors = new Set<string>() } = options;

	return async function beforeSend(event: ErrorEvent, hint: EventHint): Promise<ErrorEvent | null> {
		let { originalException } = hint;

		if (!originalException) return null;

		// Handle Promise rejections
		if (originalException instanceof Promise) {
			originalException = await originalException.catch((error) => error as Error);
		}

		// Apply additional custom filter if provided
		if (additionalFilter?.(event, { ...hint, originalException })) {
			return null;
		}

		// Filter out AxiosErrors
		if (isAxiosError(originalException)) return null;

		// Filter out BaseErrors that shouldn't be reported
		if (shouldNotReportBaseError(originalException)) return null;

		// Filter out SQLite errors
		if (isIgnoredSqliteError(originalException)) return null;

		// Filter out n8n warning/info errors
		if (isIgnoredN8nError(originalException)) return null;

		// Extract event details from n8n errors
		if (originalException instanceof ApplicationError || originalException instanceof BaseError) {
			extractEventDetailsFromN8nError(event, originalException);
		}

		// Filter out errors with warning/info cause
		if (hasIgnoredCause(originalException)) return null;

		// Deduplicate by stack trace hash
		if (originalException instanceof Error && originalException.stack) {
			const eventHash = createHash('sha1').update(originalException.stack).digest('base64');
			if (seenErrors.has(eventHash)) return null;
			seenErrors.add(eventHash);
		}

		return event;
	};
}

/**
 * Creates a beforeSend function for the frontend (editor-ui).
 *
 * Filters out:
 * - AxiosErrors
 * - ResponseErrors with connection issues
 * - RangeErrors from CodeMirror
 * - ResizeObserver errors
 *
 * @param additionalPatterns - Additional error patterns to ignore
 * @returns A beforeSend function for Sentry
 */
export function createFrontendBeforeSend(
	additionalPatterns: readonly IgnoredErrorPattern[] = [],
): BeforeSend {
	const allPatterns = [...DEFAULT_IGNORED_ERRORS, ...additionalPatterns];

	return function beforeSend(event: ErrorEvent, hint: EventHint): ErrorEvent | null {
		const { originalException } = hint;

		if (!originalException) return null;

		if (matchesIgnoredPattern(originalException, allPatterns)) {
			return null;
		}

		return event;
	};
}
