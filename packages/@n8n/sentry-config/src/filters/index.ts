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

export { createTaskRunnerFilter } from './task-runner';

export function createBackendBeforeSend(options: BeforeSendFilterOptions = {}): BeforeSend {
	const { additionalFilter, seenErrors = new Set<string>() } = options;

	return async function beforeSend(event: ErrorEvent, hint: EventHint): Promise<ErrorEvent | null> {
		let { originalException } = hint;

		if (!originalException) return null;

		if (originalException instanceof Promise) {
			originalException = await originalException.catch((error) => error as Error);
		}

		if (additionalFilter?.(event, { ...hint, originalException })) return null;
		if (isAxiosError(originalException)) return null;
		if (shouldNotReportBaseError(originalException)) return null;
		if (isIgnoredSqliteError(originalException)) return null;
		if (isIgnoredN8nError(originalException)) return null;

		if (originalException instanceof ApplicationError || originalException instanceof BaseError) {
			extractEventDetailsFromN8nError(event, originalException);
		}

		if (hasIgnoredCause(originalException)) return null;

		if (originalException instanceof Error && originalException.stack) {
			const eventHash = createHash('sha1').update(originalException.stack).digest('base64');
			if (seenErrors.has(eventHash)) return null;
			seenErrors.add(eventHash);
		}

		return event;
	};
}

export function createFrontendBeforeSend(
	additionalPatterns: readonly IgnoredErrorPattern[] = [],
): BeforeSend {
	const allPatterns = [...DEFAULT_IGNORED_ERRORS, ...additionalPatterns];

	return function beforeSend(event: ErrorEvent, hint: EventHint): ErrorEvent | null {
		const { originalException } = hint;

		if (!originalException) return null;
		if (matchesIgnoredPattern(originalException, allPatterns)) return null;

		return event;
	};
}
