import { ApplicationError, BaseError } from 'n8n-workflow';

import type { ErrorEvent } from '../types';

/** SQLite disk/IO errors - environmental problems, not application bugs */
export function isIgnoredSqliteError(originalException: unknown): boolean {
	return (
		originalException instanceof Error &&
		originalException.name === 'QueryFailedError' &&
		typeof originalException.message === 'string' &&
		['SQLITE_FULL', 'SQLITE_IOERR'].some((errMsg) => originalException.message.includes(errMsg))
	);
}

/** n8n errors at warning/info level - expected conditions, not bugs */
export function isIgnoredN8nError(originalException: unknown): boolean {
	if (originalException instanceof ApplicationError || originalException instanceof BaseError) {
		return originalException.level === 'warning' || originalException.level === 'info';
	}
	return false;
}

/** Errors with a cause at warning/info level (e.g. from ai-assistant-sdk) */
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

export function shouldNotReportBaseError(originalException: unknown): boolean {
	if (originalException instanceof BaseError) {
		return !originalException.shouldReport;
	}
	return false;
}

/** Extracts level, extra, and tags from n8n errors onto the Sentry event */
export function extractEventDetailsFromN8nError(
	event: ErrorEvent,
	originalException: ApplicationError | BaseError,
): void {
	const { level, extra, tags } = originalException;
	event.level = level;
	if (extra) event.extra = { ...event.extra, ...extra };
	if (tags) event.tags = { ...event.tags, ...tags };
}
