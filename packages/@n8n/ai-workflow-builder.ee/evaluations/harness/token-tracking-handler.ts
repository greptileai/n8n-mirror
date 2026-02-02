import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import type { LLMResult } from '@langchain/core/outputs';

/**
 * Accumulated token usage from all LLM calls.
 */
export interface AccumulatedTokenUsage {
	inputTokens: number;
	outputTokens: number;
}

/**
 * Callback handler that tracks token usage from all LLM calls.
 * Used during evaluation to capture total generation costs across all agents
 * (supervisor, discovery, builder, responder).
 *
 * Token usage is extracted from LLM response metadata, which includes:
 * - input_tokens: tokens in the prompt
 * - output_tokens: tokens in the completion
 * - cache_read_input_tokens: cached prompt tokens (optional)
 * - cache_creation_input_tokens: tokens added to cache (optional)
 */
export class TokenUsageTrackingHandler extends BaseCallbackHandler {
	name = 'TokenUsageTrackingHandler';

	private totalInputTokens = 0;
	private totalOutputTokens = 0;

	/**
	 * Called when an LLM call completes.
	 * Extracts and accumulates token usage from the response.
	 */
	async handleLLMEnd(output: LLMResult): Promise<void> {
		// Token usage can be in different locations depending on the provider
		// Check llmOutput first (common for Anthropic)
		const llmOutput = output.llmOutput as Record<string, unknown> | undefined;
		if (llmOutput?.usage && typeof llmOutput.usage === 'object') {
			const usage = llmOutput.usage as Record<string, number>;
			if (typeof usage.input_tokens === 'number') {
				this.totalInputTokens += usage.input_tokens;
			}
			if (typeof usage.output_tokens === 'number') {
				this.totalOutputTokens += usage.output_tokens;
			}
			return;
		}

		// Also check generations for token usage in response_metadata
		for (const generation of output.generations.flat()) {
			const genInfo = generation.generationInfo as Record<string, unknown> | undefined;
			if (genInfo?.usage && typeof genInfo.usage === 'object') {
				const usage = genInfo.usage as Record<string, number>;
				if (typeof usage.input_tokens === 'number') {
					this.totalInputTokens += usage.input_tokens;
				}
				if (typeof usage.output_tokens === 'number') {
					this.totalOutputTokens += usage.output_tokens;
				}
			}
		}
	}

	/**
	 * Get the total accumulated token usage.
	 */
	getUsage(): AccumulatedTokenUsage {
		return {
			inputTokens: this.totalInputTokens,
			outputTokens: this.totalOutputTokens,
		};
	}

	/**
	 * Reset the accumulated usage (useful for reuse across multiple runs).
	 */
	reset(): void {
		this.totalInputTokens = 0;
		this.totalOutputTokens = 0;
	}
}
