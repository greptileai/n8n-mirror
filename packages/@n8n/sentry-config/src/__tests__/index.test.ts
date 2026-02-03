import { AxiosError } from 'axios';
import { ApplicationError, BaseError } from 'n8n-workflow';

import { createBackendBeforeSend, createFrontendBeforeSend } from '../filters';
import type { ErrorEvent, EventHint } from '../types';

describe('createBackendBeforeSend', () => {
	const createEvent = (overrides: Partial<ErrorEvent> = {}): ErrorEvent => ({
		type: undefined,
		event_id: 'test-event-id',
		...overrides,
	});

	const createHint = (originalException: unknown): EventHint => ({
		originalException,
	});

	describe('filtering', () => {
		it('should filter out null originalException', async () => {
			const beforeSend = createBackendBeforeSend();
			const event = createEvent();
			const hint = createHint(null);

			const result = await beforeSend(event, hint);

			expect(result).toBeNull();
		});

		it('should filter out undefined originalException', async () => {
			const beforeSend = createBackendBeforeSend();
			const event = createEvent();
			const hint = createHint(undefined);

			const result = await beforeSend(event, hint);

			expect(result).toBeNull();
		});

		it('should filter out AxiosError', async () => {
			const beforeSend = createBackendBeforeSend();
			const event = createEvent();
			const hint = createHint(new AxiosError('Request failed'));

			const result = await beforeSend(event, hint);

			expect(result).toBeNull();
		});

		it('should filter out SQLite SQLITE_FULL error', async () => {
			const beforeSend = createBackendBeforeSend();
			const event = createEvent();
			const error = new Error('SQLITE_FULL: database is full');
			Object.defineProperty(error, 'name', { value: 'QueryFailedError' });
			const hint = createHint(error);

			const result = await beforeSend(event, hint);

			expect(result).toBeNull();
		});

		it('should filter out ApplicationError with warning level', async () => {
			const beforeSend = createBackendBeforeSend();
			const event = createEvent();
			const hint = createHint(new ApplicationError('Warning', { level: 'warning' }));

			const result = await beforeSend(event, hint);

			expect(result).toBeNull();
		});

		it('should filter out BaseError with shouldReport = false', async () => {
			class NonReportableError extends BaseError {
				override shouldReport = false;

				constructor() {
					super('Non-reportable error');
				}
			}
			const beforeSend = createBackendBeforeSend();
			const event = createEvent();
			const hint = createHint(new NonReportableError());

			const result = await beforeSend(event, hint);

			expect(result).toBeNull();
		});

		it('should filter out error with warning level cause', async () => {
			const beforeSend = createBackendBeforeSend();
			const event = createEvent();
			const cause = new Error('Cause') as Error & { level: string };
			cause.level = 'warning';
			const error = new Error('Main error', { cause });
			const hint = createHint(error);

			const result = await beforeSend(event, hint);

			expect(result).toBeNull();
		});
	});

	describe('event details extraction', () => {
		it('should extract level, extra, and tags from ApplicationError', async () => {
			const beforeSend = createBackendBeforeSend();
			const event = createEvent();
			const error = new ApplicationError('Test', {
				level: 'error',
				extra: { key: 'value' },
				tags: { tag: 'data' },
			});
			const hint = createHint(error);

			const result = await beforeSend(event, hint);

			expect(result).not.toBeNull();
			expect(result?.level).toBe('error');
			expect(result?.extra).toEqual({ key: 'value' });
			expect(result?.tags).toEqual({ tag: 'data' });
		});

		it('should extract details from BaseError', async () => {
			class TestError extends BaseError {
				constructor() {
					super('Test error', { level: 'error', extra: { custom: 'data' } });
				}
			}
			const beforeSend = createBackendBeforeSend();
			const event = createEvent();
			const hint = createHint(new TestError());

			const result = await beforeSend(event, hint);

			expect(result).not.toBeNull();
			expect(result?.level).toBe('error');
			expect(result?.extra).toEqual({ custom: 'data' });
		});
	});

	describe('deduplication', () => {
		it('should filter duplicate errors by stack hash', async () => {
			const beforeSend = createBackendBeforeSend();
			const error = new Error('Test error');
			const event1 = createEvent();
			const event2 = createEvent();
			const hint = createHint(error);

			const result1 = await beforeSend(event1, hint);
			const result2 = await beforeSend(event2, hint);

			expect(result1).not.toBeNull();
			expect(result2).toBeNull();
		});

		it('should allow different errors with different stacks', async () => {
			const beforeSend = createBackendBeforeSend();
			const error1 = new Error('Error 1');
			const error2 = new Error('Error 2');
			const event1 = createEvent();
			const event2 = createEvent();

			const result1 = await beforeSend(event1, createHint(error1));
			const result2 = await beforeSend(event2, createHint(error2));

			expect(result1).not.toBeNull();
			expect(result2).not.toBeNull();
		});

		it('should use provided seenErrors set', async () => {
			const seenErrors = new Set<string>();
			const beforeSend = createBackendBeforeSend({ seenErrors });
			const error = new Error('Test error');
			const event = createEvent();
			const hint = createHint(error);

			await beforeSend(event, hint);

			expect(seenErrors.size).toBe(1);
		});
	});

	describe('additionalFilter', () => {
		it('should apply additional filter when provided', async () => {
			const additionalFilter = jest.fn().mockReturnValue(true);
			const beforeSend = createBackendBeforeSend({ additionalFilter });
			const event = createEvent();
			const hint = createHint(new Error('Test'));

			const result = await beforeSend(event, hint);

			expect(result).toBeNull();
			expect(additionalFilter).toHaveBeenCalled();
		});

		it('should continue processing when additionalFilter returns false', async () => {
			const additionalFilter = jest.fn().mockReturnValue(false);
			const beforeSend = createBackendBeforeSend({ additionalFilter });
			const event = createEvent();
			const hint = createHint(new Error('Test'));

			const result = await beforeSend(event, hint);

			expect(result).not.toBeNull();
		});
	});

	describe('Promise rejection handling', () => {
		it('should handle Promise rejection and extract error', async () => {
			const beforeSend = createBackendBeforeSend();
			const event = createEvent();
			const rejectedPromise = Promise.reject(new AxiosError('Network error'));
			const hint = createHint(rejectedPromise);

			const result = await beforeSend(event, hint);

			expect(result).toBeNull();
		});

		it('should handle Promise rejection with regular error', async () => {
			const beforeSend = createBackendBeforeSend();
			const event = createEvent();
			const rejectedPromise = Promise.reject(new Error('Async error'));
			const hint = createHint(rejectedPromise);

			const result = await beforeSend(event, hint);

			expect(result).not.toBeNull();
		});
	});

	describe('passing events', () => {
		it('should pass through regular Error', async () => {
			const beforeSend = createBackendBeforeSend();
			const event = createEvent();
			const hint = createHint(new Error('Regular error'));

			const result = await beforeSend(event, hint);

			expect(result).toBe(event);
		});

		it('should pass through TypeError', async () => {
			const beforeSend = createBackendBeforeSend();
			const event = createEvent();
			const hint = createHint(new TypeError('Type error'));

			const result = await beforeSend(event, hint);

			expect(result).toBe(event);
		});

		it('should pass through ApplicationError with error level', async () => {
			const beforeSend = createBackendBeforeSend();
			const event = createEvent();
			const hint = createHint(new ApplicationError('Error', { level: 'error' }));

			const result = await beforeSend(event, hint);

			expect(result).not.toBeNull();
		});
	});
});

describe('createFrontendBeforeSend', () => {
	const createEvent = (overrides: Partial<ErrorEvent> = {}): ErrorEvent => ({
		type: undefined,
		event_id: 'test-event-id',
		...overrides,
	});

	const createHint = (originalException: unknown): EventHint => ({
		originalException,
	});

	describe('filtering', () => {
		it('should filter out null originalException', () => {
			const beforeSend = createFrontendBeforeSend();
			const event = createEvent();
			const hint = createHint(null);

			const result = beforeSend(event, hint);

			expect(result).toBeNull();
		});

		it('should filter out AxiosError', () => {
			const beforeSend = createFrontendBeforeSend();
			const event = createEvent();
			const hint = createHint(new AxiosError('Request failed'));

			const result = beforeSend(event, hint);

			expect(result).toBeNull();
		});

		it('should filter out ResizeObserver error', () => {
			const beforeSend = createFrontendBeforeSend();
			const event = createEvent();
			const hint = createHint(new Error('ResizeObserver loop limit exceeded'));

			const result = beforeSend(event, hint);

			expect(result).toBeNull();
		});

		it('should filter out CodeMirror RangeError', () => {
			const beforeSend = createFrontendBeforeSend();
			const event = createEvent();
			const hint = createHint(
				new RangeError('Position 100 is out of range for changeset of length 50'),
			);

			const result = beforeSend(event, hint);

			expect(result).toBeNull();
		});
	});

	describe('additionalPatterns', () => {
		it('should include additional patterns', () => {
			const additionalPatterns = [{ instanceof: SyntaxError, message: /custom pattern/ }];
			const beforeSend = createFrontendBeforeSend(additionalPatterns);
			const event = createEvent();
			const hint = createHint(new SyntaxError('custom pattern match'));

			const result = beforeSend(event, hint);

			expect(result).toBeNull();
		});

		it('should still use default patterns with additional patterns', () => {
			const additionalPatterns = [{ instanceof: SyntaxError }];
			const beforeSend = createFrontendBeforeSend(additionalPatterns);
			const event = createEvent();
			const hint = createHint(new AxiosError('Network error'));

			const result = beforeSend(event, hint);

			expect(result).toBeNull();
		});
	});

	describe('passing events', () => {
		it('should pass through regular Error', () => {
			const beforeSend = createFrontendBeforeSend();
			const event = createEvent();
			const hint = createHint(new Error('Regular error'));

			const result = beforeSend(event, hint);

			expect(result).toBe(event);
		});

		it('should pass through RangeError with non-matching message', () => {
			const beforeSend = createFrontendBeforeSend();
			const event = createEvent();
			const hint = createHint(new RangeError('Some other range error'));

			const result = beforeSend(event, hint);

			expect(result).toBe(event);
		});
	});
});
