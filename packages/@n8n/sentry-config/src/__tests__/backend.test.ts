import { ApplicationError, BaseError } from 'n8n-workflow';

import {
	extractEventDetailsFromN8nError,
	hasIgnoredCause,
	isIgnoredN8nError,
	isIgnoredSqliteError,
	shouldNotReportBaseError,
} from '../filters/backend';
import type { ErrorEvent } from '../types';

describe('backend filters', () => {
	describe('isIgnoredSqliteError', () => {
		it('should return true for SQLITE_FULL error', () => {
			const error = new Error('SQLITE_FULL: database or disk is full');
			Object.defineProperty(error, 'name', { value: 'QueryFailedError' });

			expect(isIgnoredSqliteError(error)).toBe(true);
		});

		it('should return true for SQLITE_IOERR error', () => {
			const error = new Error('SQLITE_IOERR: disk I/O error');
			Object.defineProperty(error, 'name', { value: 'QueryFailedError' });

			expect(isIgnoredSqliteError(error)).toBe(true);
		});

		it('should return false for non-QueryFailedError', () => {
			const error = new Error('SQLITE_FULL: database or disk is full');

			expect(isIgnoredSqliteError(error)).toBe(false);
		});

		it('should return false for QueryFailedError with different message', () => {
			const error = new Error('Some other database error');
			Object.defineProperty(error, 'name', { value: 'QueryFailedError' });

			expect(isIgnoredSqliteError(error)).toBe(false);
		});

		it('should return false for non-Error values', () => {
			expect(isIgnoredSqliteError('string error')).toBe(false);
			expect(isIgnoredSqliteError(null)).toBe(false);
			expect(isIgnoredSqliteError(undefined)).toBe(false);
			expect(isIgnoredSqliteError({ message: 'SQLITE_FULL' })).toBe(false);
		});
	});

	describe('isIgnoredN8nError', () => {
		it('should return true for ApplicationError with warning level', () => {
			const error = new ApplicationError('Warning message', { level: 'warning' });

			expect(isIgnoredN8nError(error)).toBe(true);
		});

		it('should return true for ApplicationError with info level', () => {
			const error = new ApplicationError('Info message', { level: 'info' });

			expect(isIgnoredN8nError(error)).toBe(true);
		});

		it('should return false for ApplicationError with error level', () => {
			const error = new ApplicationError('Error message', { level: 'error' });

			expect(isIgnoredN8nError(error)).toBe(false);
		});

		it('should return false for ApplicationError with default level', () => {
			const error = new ApplicationError('Error message');

			expect(isIgnoredN8nError(error)).toBe(false);
		});

		it('should return true for BaseError with warning level', () => {
			class TestError extends BaseError {
				constructor() {
					super('Test error', { level: 'warning' });
				}
			}
			const error = new TestError();

			expect(isIgnoredN8nError(error)).toBe(true);
		});

		it('should return false for regular Error', () => {
			const error = new Error('Regular error');

			expect(isIgnoredN8nError(error)).toBe(false);
		});

		it('should return false for non-Error values', () => {
			expect(isIgnoredN8nError('string error')).toBe(false);
			expect(isIgnoredN8nError(null)).toBe(false);
			expect(isIgnoredN8nError(undefined)).toBe(false);
		});
	});

	describe('hasIgnoredCause', () => {
		it('should return true when cause has warning level', () => {
			const cause = new Error('Cause error') as Error & { level: string };
			cause.level = 'warning';
			const error = new Error('Main error', { cause });

			expect(hasIgnoredCause(error)).toBe(true);
		});

		it('should return true when cause has info level', () => {
			const cause = new Error('Cause error') as Error & { level: string };
			cause.level = 'info';
			const error = new Error('Main error', { cause });

			expect(hasIgnoredCause(error)).toBe(true);
		});

		it('should return false when cause has error level', () => {
			const cause = new Error('Cause error') as Error & { level: string };
			cause.level = 'error';
			const error = new Error('Main error', { cause });

			expect(hasIgnoredCause(error)).toBe(false);
		});

		it('should return false when cause has no level', () => {
			const cause = new Error('Cause error');
			const error = new Error('Main error', { cause });

			expect(hasIgnoredCause(error)).toBe(false);
		});

		it('should return false when no cause', () => {
			const error = new Error('Main error');

			expect(hasIgnoredCause(error)).toBe(false);
		});

		it('should return false when cause is not an Error', () => {
			const error = new Error('Main error');
			Object.defineProperty(error, 'cause', { value: 'string cause' });

			expect(hasIgnoredCause(error)).toBe(false);
		});

		it('should return false for non-Error values', () => {
			expect(hasIgnoredCause('string error')).toBe(false);
			expect(hasIgnoredCause(null)).toBe(false);
			expect(hasIgnoredCause(undefined)).toBe(false);
		});
	});

	describe('shouldNotReportBaseError', () => {
		it('should return true for BaseError with shouldReport = false', () => {
			class TestError extends BaseError {
				override shouldReport = false;

				constructor() {
					super('Test error');
				}
			}
			const error = new TestError();

			expect(shouldNotReportBaseError(error)).toBe(true);
		});

		it('should return false for BaseError with shouldReport = true', () => {
			class TestError extends BaseError {
				override shouldReport = true;

				constructor() {
					super('Test error');
				}
			}
			const error = new TestError();

			expect(shouldNotReportBaseError(error)).toBe(false);
		});

		it('should return false for BaseError with default shouldReport', () => {
			class TestError extends BaseError {
				constructor() {
					super('Test error');
				}
			}
			const error = new TestError();

			expect(shouldNotReportBaseError(error)).toBe(false);
		});

		it('should return false for regular Error', () => {
			const error = new Error('Regular error');

			expect(shouldNotReportBaseError(error)).toBe(false);
		});

		it('should return false for ApplicationError (extends Error, not BaseError)', () => {
			const error = new ApplicationError('App error');

			expect(shouldNotReportBaseError(error)).toBe(false);
		});

		it('should return false for non-Error values', () => {
			expect(shouldNotReportBaseError('string error')).toBe(false);
			expect(shouldNotReportBaseError(null)).toBe(false);
			expect(shouldNotReportBaseError(undefined)).toBe(false);
		});
	});

	describe('extractEventDetailsFromN8nError', () => {
		it('should set level from ApplicationError', () => {
			const event: ErrorEvent = { type: undefined, event_id: '123' };
			const error = new ApplicationError('Test', { level: 'warning' });

			extractEventDetailsFromN8nError(event, error);

			expect(event.level).toBe('warning');
		});

		it('should set extra from ApplicationError', () => {
			const event: ErrorEvent = { type: undefined, event_id: '123', extra: { existing: 'value' } };
			const error = new ApplicationError('Test', { extra: { custom: 'data' } });

			extractEventDetailsFromN8nError(event, error);

			expect(event.extra).toEqual({ existing: 'value', custom: 'data' });
		});

		it('should set tags from ApplicationError', () => {
			const event: ErrorEvent = { type: undefined, event_id: '123', tags: { existing: 'tag' } };
			const error = new ApplicationError('Test', { tags: { custom: 'tag' } });

			extractEventDetailsFromN8nError(event, error);

			expect(event.tags).toEqual({ existing: 'tag', custom: 'tag' });
		});

		it('should not modify extra when error has no extra', () => {
			const event: ErrorEvent = { type: undefined, event_id: '123', extra: { existing: 'value' } };
			const error = new ApplicationError('Test');

			extractEventDetailsFromN8nError(event, error);

			expect(event.extra).toEqual({ existing: 'value' });
		});

		it('should not modify tags when error has no tags', () => {
			const event: ErrorEvent = { type: undefined, event_id: '123', tags: { existing: 'tag' } };
			const error = new ApplicationError('Test');

			extractEventDetailsFromN8nError(event, error);

			expect(event.tags).toEqual({ existing: 'tag' });
		});

		it('should work with BaseError', () => {
			class TestError extends BaseError {
				constructor() {
					super('Test error', { level: 'info', extra: { key: 'value' } });
				}
			}
			const event: ErrorEvent = { type: undefined, event_id: '123' };
			const error = new TestError();

			extractEventDetailsFromN8nError(event, error);

			expect(event.level).toBe('info');
			expect(event.extra).toEqual({ key: 'value' });
		});
	});
});
