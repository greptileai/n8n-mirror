import { AxiosError } from 'axios';

import { DEFAULT_IGNORED_ERRORS, matchesIgnoredPattern } from '../filters/frontend';
import type { IgnoredErrorPattern } from '../types';

describe('frontend filters', () => {
	describe('DEFAULT_IGNORED_ERRORS', () => {
		it('should include AxiosError pattern', () => {
			const axiosPattern = DEFAULT_IGNORED_ERRORS.find((p) => p.instanceof === AxiosError);

			expect(axiosPattern).toBeDefined();
			expect(axiosPattern?.message).toBeUndefined();
		});

		it('should include RangeError patterns for CodeMirror', () => {
			const rangePatterns = DEFAULT_IGNORED_ERRORS.filter((p) => p.instanceof === RangeError);

			expect(rangePatterns.length).toBe(3);
		});

		it('should include ResizeObserver error pattern', () => {
			const resizePattern = DEFAULT_IGNORED_ERRORS.find(
				(p) =>
					p.instanceof === Error &&
					p.message instanceof RegExp &&
					p.message.source.includes('ResizeObserver'),
			);

			expect(resizePattern).toBeDefined();
		});
	});

	describe('matchesIgnoredPattern', () => {
		describe('type matching', () => {
			it('should match when instanceof matches', () => {
				const patterns: IgnoredErrorPattern[] = [{ instanceof: Error }];
				const error = new Error('Test');

				expect(matchesIgnoredPattern(error, patterns)).toBe(true);
			});

			it('should not match when instanceof does not match', () => {
				const patterns: IgnoredErrorPattern[] = [{ instanceof: TypeError }];
				const error = new Error('Test');

				expect(matchesIgnoredPattern(error, patterns)).toBe(false);
			});

			it('should match subclasses', () => {
				const patterns: IgnoredErrorPattern[] = [{ instanceof: Error }];
				const error = new TypeError('Test');

				expect(matchesIgnoredPattern(error, patterns)).toBe(true);
			});

			it('should match AxiosError', () => {
				const patterns: IgnoredErrorPattern[] = [{ instanceof: AxiosError }];
				const error = new AxiosError('Test');

				expect(matchesIgnoredPattern(error, patterns)).toBe(true);
			});
		});

		describe('message matching', () => {
			it('should match string message exactly', () => {
				const patterns: IgnoredErrorPattern[] = [{ instanceof: Error, message: 'exact message' }];

				expect(matchesIgnoredPattern(new Error('exact message'), patterns)).toBe(true);
				expect(matchesIgnoredPattern(new Error('not exact message'), patterns)).toBe(false);
			});

			it('should match regex message pattern', () => {
				const patterns: IgnoredErrorPattern[] = [{ instanceof: Error, message: /test \d+/ }];

				expect(matchesIgnoredPattern(new Error('test 123'), patterns)).toBe(true);
				expect(matchesIgnoredPattern(new Error('test abc'), patterns)).toBe(false);
			});

			it('should match CodeMirror Position out of range error', () => {
				const error = new RangeError('Position 100 is out of range for changeset of length 50');

				expect(matchesIgnoredPattern(error, DEFAULT_IGNORED_ERRORS)).toBe(true);
			});

			it('should match CodeMirror Invalid change range error', () => {
				const error = new RangeError('Invalid change range 10 to 5');

				expect(matchesIgnoredPattern(error, DEFAULT_IGNORED_ERRORS)).toBe(true);
			});

			it('should match CodeMirror Selection points outside error', () => {
				const error = new RangeError('Selection points outside of document');

				expect(matchesIgnoredPattern(error, DEFAULT_IGNORED_ERRORS)).toBe(true);
			});

			it('should match ResizeObserver error', () => {
				const error = new Error('ResizeObserver loop completed with undelivered notifications');

				expect(matchesIgnoredPattern(error, DEFAULT_IGNORED_ERRORS)).toBe(true);
			});

			it('should not match RangeError with different message', () => {
				const error = new RangeError('Some other range error');

				expect(matchesIgnoredPattern(error, DEFAULT_IGNORED_ERRORS)).toBe(false);
			});
		});

		describe('edge cases', () => {
			it('should return false for null', () => {
				expect(matchesIgnoredPattern(null, DEFAULT_IGNORED_ERRORS)).toBe(false);
			});

			it('should return false for undefined', () => {
				expect(matchesIgnoredPattern(undefined, DEFAULT_IGNORED_ERRORS)).toBe(false);
			});

			it('should return false for non-Error objects', () => {
				expect(matchesIgnoredPattern('string error', DEFAULT_IGNORED_ERRORS)).toBe(false);
				expect(matchesIgnoredPattern({ message: 'object' }, DEFAULT_IGNORED_ERRORS)).toBe(false);
			});

			it('should use DEFAULT_IGNORED_ERRORS when no patterns provided', () => {
				const axiosError = new AxiosError('Test');

				expect(matchesIgnoredPattern(axiosError)).toBe(true);
			});

			it('should return false for empty patterns array', () => {
				const error = new Error('Test');

				expect(matchesIgnoredPattern(error, [])).toBe(false);
			});

			it('should handle error with undefined message', () => {
				const patterns: IgnoredErrorPattern[] = [{ instanceof: Error, message: /test/ }];
				const error = new Error();
				// @ts-expect-error Testing undefined message
				error.message = undefined;

				expect(matchesIgnoredPattern(error, patterns)).toBe(false);
			});
		});

		describe('multiple patterns', () => {
			it('should return true if any pattern matches', () => {
				const patterns: IgnoredErrorPattern[] = [
					{ instanceof: TypeError },
					{ instanceof: RangeError },
					{ instanceof: Error, message: /specific/ },
				];

				expect(matchesIgnoredPattern(new RangeError('test'), patterns)).toBe(true);
			});

			it('should return false if no patterns match', () => {
				const patterns: IgnoredErrorPattern[] = [
					{ instanceof: TypeError },
					{ instanceof: RangeError },
				];

				expect(matchesIgnoredPattern(new SyntaxError('test'), patterns)).toBe(false);
			});
		});
	});
});
