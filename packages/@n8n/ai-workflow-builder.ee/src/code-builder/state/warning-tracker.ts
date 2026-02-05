/**
 * Warning Tracker
 *
 * Tracks validation warnings that have been shown to the agent to avoid
 * repeating the same warnings. Uses code|nodeName|parameterPath as the
 * deduplication key, allowing message content to change while the location
 * stays the same.
 *
 * Also tracks iteration info for telemetry purposes - when warnings first
 * occurred and when (if) they were resolved.
 */

import type { ValidationWarning } from '../types';

/**
 * Tracked warning with iteration metadata for telemetry
 */
interface TrackedWarning {
	warning: ValidationWarning;
	iterationOccurred: number;
	iterationResolved?: number;
}

/**
 * Validation issue tracking data for telemetry
 */
export interface ValidationIssueTracking {
	code: string;
	message: string;
	nodeName?: string;
	iteration_occurred: number;
	iteration_resolved?: number;
	resolved: boolean;
}

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
 *
 * Also tracks iteration info for telemetry purposes.
 */
export class WarningTracker {
	private seenWarnings = new Set<string>();
	private trackedWarnings = new Map<string, TrackedWarning>();

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

	/**
	 * Record a warning with the iteration it occurred in.
	 * Only records if this warning hasn't been tracked before.
	 *
	 * @param warning - The warning to record
	 * @param iteration - The iteration number when this warning occurred
	 */
	recordWarning(warning: ValidationWarning, iteration: number): void {
		const key = getWarningKey(warning);
		if (!this.trackedWarnings.has(key)) {
			this.trackedWarnings.set(key, { warning, iterationOccurred: iteration });
		}
	}

	/**
	 * Record multiple warnings with the iteration they occurred in.
	 *
	 * @param warnings - Array of warnings to record
	 * @param iteration - The iteration number when these warnings occurred
	 */
	recordWarnings(warnings: ValidationWarning[], iteration: number): void {
		for (const warning of warnings) {
			this.recordWarning(warning, iteration);
		}
	}

	/**
	 * Mark a warning as resolved in the given iteration.
	 * Only marks if the warning was previously tracked and not already resolved.
	 *
	 * @param warning - The warning that was resolved
	 * @param iteration - The iteration number when this warning was resolved
	 */
	markResolved(warning: ValidationWarning, iteration: number): void {
		const key = getWarningKey(warning);
		const tracked = this.trackedWarnings.get(key);
		if (tracked && tracked.iterationResolved === undefined) {
			tracked.iterationResolved = iteration;
		}
	}

	/**
	 * Update resolution status for warnings based on current validation results.
	 * Warnings that were previously tracked but are no longer in the current
	 * warnings list are marked as resolved.
	 *
	 * @param currentWarnings - The current list of validation warnings
	 * @param iteration - The current iteration number
	 */
	updateResolutionStatus(currentWarnings: ValidationWarning[], iteration: number): void {
		const currentKeys = new Set(currentWarnings.map(getWarningKey));

		for (const [key, tracked] of this.trackedWarnings) {
			// If warning was previously tracked but is no longer present, mark as resolved
			if (!currentKeys.has(key) && tracked.iterationResolved === undefined) {
				tracked.iterationResolved = iteration;
			}
		}
	}

	/**
	 * Get all tracked issues with resolution status for telemetry.
	 *
	 * @returns Array of validation issues with iteration and resolution info
	 */
	getIssuesWithResolutionStatus(): ValidationIssueTracking[] {
		return Array.from(this.trackedWarnings.values()).map((tracked) => ({
			code: tracked.warning.code,
			message: tracked.warning.message,
			nodeName: tracked.warning.nodeName,
			iteration_occurred: tracked.iterationOccurred,
			iteration_resolved: tracked.iterationResolved,
			resolved: tracked.iterationResolved !== undefined,
		}));
	}

	/**
	 * Check if any warnings have been tracked.
	 *
	 * @returns true if at least one warning has been tracked
	 */
	hasTrackedWarnings(): boolean {
		return this.trackedWarnings.size > 0;
	}
}
