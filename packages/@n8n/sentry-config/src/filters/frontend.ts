import { AxiosError } from 'axios';

import type { IgnoredErrorPattern } from '../types';

export const DEFAULT_IGNORED_ERRORS: readonly IgnoredErrorPattern[] = [
	{ instanceof: AxiosError },
	{ instanceof: RangeError, message: /Position \d+ is out of range for changeset of length \d+/ },
	{ instanceof: RangeError, message: /Invalid change range \d+ to \d+/ },
	{ instanceof: RangeError, message: /Selection points outside of document$/ },
	{ instanceof: Error, message: /ResizeObserver/ },
] as const;

export function matchesIgnoredPattern(
	originalException: unknown,
	ignoredPatterns: readonly IgnoredErrorPattern[] = DEFAULT_IGNORED_ERRORS,
): boolean {
	if (!originalException) return false;

	return ignoredPatterns.some((entry) => {
		const typeMatch = originalException instanceof entry.instanceof;
		if (!typeMatch) {
			return false;
		}

		if ('message' in entry && entry.message !== undefined) {
			const errorMessage =
				originalException instanceof Error ? (originalException.message ?? '') : '';
			if (entry.message instanceof RegExp) {
				return entry.message.test(errorMessage);
			} else {
				return errorMessage === entry.message;
			}
		}

		return true;
	});
}
