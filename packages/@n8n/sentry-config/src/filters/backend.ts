import { ApplicationError, BaseError } from 'n8n-workflow';

import type { ErrorEvent } from '../types';

/**
 * Filters out SQLite errors that indicate disk/IO issues.
 * These are environmental problems, not application bugs.
 *
 * @returns true if the error should be filtered out
 */
export function isIgnoredSqliteError(originalException: unknown): boolean {
	return (
		originalException instanceof Error &&
		originalException.name === 'QueryFailedError' &&
		typeof originalException.message === 'string' &&
		['SQLITE_FULL', 'SQLITE_IOERR'].some((errMsg) => originalException.message.includes(errMsg))
	);
}

/**
 * Filters out n8n errors that are warnings or info level.
 * These are expected/handled conditions, not bugs.
 *
 * @returns true if the error should be filtered out
 */
export function isIgnoredN8nError(originalException: unknown): boolean {
	if (originalException instanceof ApplicationError || originalException instanceof BaseError) {
		return originalException.level === 'warning' || originalException.level === 'info';
	}
	return false;
}

/**
 * Filters out errors with a cause that has warning/info level.
 * Handles underlying errors propagating from dependencies like ai-assistant-sdk.
 *
 * @returns true if the error should be filtered out
 */
export function hasIgnoredCause(originalException: unknown): boolean {
	if (
		originalException instanceof Error &&
		'cause' in originalException &&
		originalException.cause instanceof Error &&
		'level' in originalException.cause &&
		(originalException.cause.level === 'warning' || originalException.cause.level === 'info')
	) {
		return true;
	}
	return false;
}

/**
 * Checks if a BaseError should not be reported.
 *
 * @returns true if the error should be filtered out
 */
export function shouldNotReportBaseError(originalException: unknown): boolean {
	if (originalException instanceof BaseError) {
		return !originalException.shouldReport;
	}
	return false;
}

/**
 * Extracts event details from n8n errors (ApplicationError or BaseError).
 * Mutates the event to add level, extra, and tags from the error.
 */
export function extractEventDetailsFromN8nError(
	event: ErrorEvent,
	originalException: ApplicationError | BaseError,
): void {
	const { level, extra, tags } = originalException;
	event.level = level;
	if (extra) event.extra = { ...event.extra, ...extra };
	if (tags) event.tags = { ...event.tags, ...tags };
}
