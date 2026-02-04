/**
 * Warning Tracker
 *
 * Tracks validation warnings that have been shown to the agent to avoid
 * repeating the same warnings. Uses code|nodeName|parameterPath as the
 * deduplication key, allowing message content to change while the location
 * stays the same.
 */

import type { ValidationWarning } from '../types';

/**
 * Generates a unique key for a warning based on its location.
 *
 * The key format is: code|nodeName|parameterPath
 * This allows deduplication by location rather than message content.
 *
 * @param warning - The warning to generate a key for
 * @returns A unique string key
 */
function getWarningKey(warning: ValidationWarning): string {
	return `${warning.code}|${warning.nodeName ?? ''}|${warning.parameterPath ?? ''}`;
}

/**
 * Tracks which validation warnings have been shown to the agent.
 *
 * Consolidates warning deduplication logic that was previously duplicated
 * in multiple places in the code builder agent.
 */
export class WarningTracker {
	private seenWarnings = new Set<string>();

	/**
	 * Filter warnings to only include those that haven't been seen before.
	 *
	 * @param warnings - Array of warnings to filter
	 * @returns Array of warnings that are new (not previously seen)
	 */
	filterNewWarnings(warnings: ValidationWarning[]): ValidationWarning[] {
		return warnings.filter((warning) => !this.seenWarnings.has(getWarningKey(warning)));
	}

	/**
	 * Mark warnings as seen so they won't be returned by filterNewWarnings.
	 *
	 * @param warnings - Array of warnings to mark as seen
	 */
	markAsSeen(warnings: ValidationWarning[]): void {
		for (const warning of warnings) {
			this.seenWarnings.add(getWarningKey(warning));
		}
	}

	/**
	 * Check if all provided warnings have already been seen.
	 *
	 * @param warnings - Array of warnings to check
	 * @returns true if all warnings have been seen, false if any are new
	 */
	allSeen(warnings: ValidationWarning[]): boolean {
		if (warnings.length === 0) {
			return true;
		}
		return warnings.every((warning) => this.seenWarnings.has(getWarningKey(warning)));
	}
}
