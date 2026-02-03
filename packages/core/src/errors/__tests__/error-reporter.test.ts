import type { Logger } from '@n8n/backend-common';
import { QueryFailedError } from '@n8n/typeorm';
import { createBackendBeforeSend } from '@n8n/sentry-config';
import type { ErrorEvent } from '@sentry/node';
import { AxiosError } from 'axios';
import { mock } from 'jest-mock-extended';
import { ApplicationError, BaseError } from 'n8n-workflow';

import { ErrorReporter } from '../error-reporter';

jest.mock('@sentry/node', () => ({
	init: jest.fn(),
	setTag: jest.fn(),
	setUser: jest.fn(),
	captureException: jest.fn(),
	Integrations: {},
}));

jest.spyOn(process, 'on');

describe('ErrorReporter', () => {
	describe('error', () => {
		let error: ApplicationError;
		let logger: Logger;
		let errorReporter: ErrorReporter;
		const metadata = undefined;

		beforeEach(() => {
			error = new ApplicationError('Test error');
			logger = mock<Logger>();
			errorReporter = new ErrorReporter(logger, mock());
		});

		it('should include stack trace for error-level `ApplicationError`', () => {
			error.level = 'error';
			errorReporter.error(error);
			expect(logger.error).toHaveBeenCalledWith(`Test error\n${error.stack}\n`, metadata);
		});

		it('should exclude stack trace for warning-level `ApplicationError`', () => {
			error.level = 'warning';
			errorReporter.error(error);
			expect(logger.error).toHaveBeenCalledWith('Test error', metadata);
		});

		it.each([true, undefined])(
			'should log the error when shouldBeLogged is %s',
			(shouldBeLogged) => {
				error.level = 'error';
				errorReporter.error(error, { shouldBeLogged });
				expect(logger.error).toHaveBeenCalledTimes(1);
			},
		);

		it('should not log the error when shouldBeLogged is false', () => {
			error.level = 'error';
			errorReporter.error(error, { shouldBeLogged: false });
			expect(logger.error).toHaveBeenCalledTimes(0);
		});
	});
});

describe('createBackendBeforeSend', () => {
	const event = {} as ErrorEvent;

	describe('basic filtering', () => {
		it('should ignore errors with level warning', async () => {
			const beforeSend = createBackendBeforeSend();
			const originalException = new ApplicationError('test');
			originalException.level = 'warning';

			expect(await beforeSend(event, { originalException })).toEqual(null);
		});

		it('should keep events with a cause with error level', async () => {
			const beforeSend = createBackendBeforeSend();
			const cause = new Error('cause-error');
			const originalException = new ApplicationError('test', cause);

			expect(await beforeSend(event, { originalException })).toEqual(event);
		});

		it('should ignore events with error cause with warning level', async () => {
			const beforeSend = createBackendBeforeSend();
			const cause: Error & { level?: 'warning' } = new Error('cause-error');
			cause.level = 'warning';
			const originalException = new ApplicationError('test', cause);

			expect(await beforeSend(event, { originalException })).toEqual(null);
		});

		it('should set level, extra, and tags from ApplicationError', async () => {
			const beforeSend = createBackendBeforeSend();
			const originalException = new ApplicationError('Test error', {
				level: 'error',
				extra: { foo: 'bar' },
				tags: { tag1: 'value1' },
			});

			const testEvent = {} as ErrorEvent;

			const result = await beforeSend(testEvent, { originalException });

			expect(result).toEqual({
				level: 'error',
				extra: { foo: 'bar' },
				tags: { tag1: 'value1' },
			});
		});

		it('should deduplicate errors with same stack trace', async () => {
			const seenErrors = new Set<string>();
			const beforeSend = createBackendBeforeSend({ seenErrors });
			const originalException = new Error();

			const firstResult = await beforeSend(event, { originalException });
			expect(firstResult).toEqual(event);

			const secondResult = await beforeSend(event, { originalException });
			expect(secondResult).toBeNull();
		});

		it('should handle Promise rejections', async () => {
			const beforeSend = createBackendBeforeSend();
			const originalException = Promise.reject(new Error());

			const result = await beforeSend(event, { originalException });

			expect(result).toEqual(event);
		});

		test.each([
			['undefined', undefined],
			['null', null],
			['an AxiosError', new AxiosError()],
			['a rejected Promise with AxiosError', Promise.reject(new AxiosError())],
			[
				'a QueryFailedError with SQLITE_FULL',
				new QueryFailedError('', [], new Error('SQLITE_FULL')),
			],
			[
				'a QueryFailedError with SQLITE_IOERR',
				new QueryFailedError('', [], new Error('SQLITE_IOERR')),
			],
			['an ApplicationError with "warning" level', new ApplicationError('', { level: 'warning' })],
			[
				'an Error with ApplicationError as cause with "warning" level',
				new Error('', { cause: new ApplicationError('', { level: 'warning' }) }),
			],
		])('should ignore if originalException is %s', async (_, originalException) => {
			const beforeSend = createBackendBeforeSend();
			const result = await beforeSend(event, { originalException });
			expect(result).toBeNull();
		});
	});

	describe('additionalFilter', () => {
		it('should filter out based on the additionalFilter', async () => {
			const additionalFilter = jest.fn().mockReturnValue(true);
			const beforeSend = createBackendBeforeSend({ additionalFilter });
			const hint = { originalException: new Error() };

			const result = await beforeSend(event, hint);

			expect(result).toBeNull();
			expect(additionalFilter).toHaveBeenCalledWith(event, hint);
		});

		it('should not filter out when additionalFilter returns false', async () => {
			const additionalFilter = jest.fn().mockReturnValue(false);
			const beforeSend = createBackendBeforeSend({ additionalFilter });
			const hint = { originalException: new Error() };

			const result = await beforeSend(event, hint);

			expect(result).toEqual(event);
			expect(additionalFilter).toHaveBeenCalledWith(event, hint);
		});
	});

	describe('BaseError', () => {
		class TestError extends BaseError {}

		it('should drop errors with shouldReport false', async () => {
			const beforeSend = createBackendBeforeSend();
			const originalException = new TestError('test', { shouldReport: false });

			expect(await beforeSend(event, { originalException })).toEqual(null);
		});

		it('should keep events with shouldReport true', async () => {
			const beforeSend = createBackendBeforeSend();
			const originalException = new TestError('test', { shouldReport: true });

			expect(await beforeSend(event, { originalException })).toEqual(event);
		});

		it('should set level, extra, and tags from BaseError', async () => {
			const beforeSend = createBackendBeforeSend();
			const originalException = new TestError('Test error', {
				level: 'error',
				extra: { foo: 'bar' },
				tags: { tag1: 'value1' },
			});

			const testEvent = {} as ErrorEvent;

			const result = await beforeSend(testEvent, { originalException });

			expect(result).toEqual({
				level: 'error',
				extra: { foo: 'bar' },
				tags: {
					packageName: 'core',
					tag1: 'value1',
				},
			});
		});
	});
});
