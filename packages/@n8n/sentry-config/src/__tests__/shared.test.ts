import { AxiosError } from 'axios';

import { isAxiosError } from '../filters/shared';

describe('shared filters', () => {
	describe('isAxiosError', () => {
		it('should return true for AxiosError instance', () => {
			const error = new AxiosError('Request failed');

			expect(isAxiosError(error)).toBe(true);
		});

		it('should return true for AxiosError with config', () => {
			const error = new AxiosError('Request failed', 'ERR_BAD_REQUEST', {
				url: '/api/test',
			} as never);

			expect(isAxiosError(error)).toBe(true);
		});

		it('should return false for regular Error', () => {
			const error = new Error('Regular error');

			expect(isAxiosError(error)).toBe(false);
		});

		it('should return false for TypeError', () => {
			const error = new TypeError('Type error');

			expect(isAxiosError(error)).toBe(false);
		});

		it('should return false for Error with isAxiosError property', () => {
			const error = new Error('Fake axios error') as Error & { isAxiosError: boolean };
			error.isAxiosError = true;

			expect(isAxiosError(error)).toBe(false);
		});

		it('should return false for null', () => {
			expect(isAxiosError(null)).toBe(false);
		});

		it('should return false for undefined', () => {
			expect(isAxiosError(undefined)).toBe(false);
		});

		it('should return false for string', () => {
			expect(isAxiosError('error string')).toBe(false);
		});

		it('should return false for object that looks like AxiosError', () => {
			const fakeAxiosError = {
				name: 'AxiosError',
				message: 'Request failed',
				isAxiosError: true,
			};

			expect(isAxiosError(fakeAxiosError)).toBe(false);
		});
	});
});
