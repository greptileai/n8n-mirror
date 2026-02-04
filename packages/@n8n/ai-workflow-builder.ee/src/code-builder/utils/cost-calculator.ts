/**
 * Cost Calculator Utility
 *
 * Calculates estimated cost based on token usage for Claude Sonnet 4.5.
 */

import { SONNET_4_5_PRICING } from '../constants';

/**
 * Calculate cost estimate based on token usage
 *
 * @param inputTokens - Number of input tokens used
 * @param outputTokens - Number of output tokens generated
 * @returns Estimated cost in USD
 */
export function calculateCost(inputTokens: number, outputTokens: number): number {
	const inputCost = (inputTokens / 1_000_000) * SONNET_4_5_PRICING.inputPerMillion;
	const outputCost = (outputTokens / 1_000_000) * SONNET_4_5_PRICING.outputPerMillion;
	return inputCost + outputCost;
}
