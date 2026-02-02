import type { LLMResult } from '@langchain/core/outputs';

import { TokenUsageTrackingHandler } from '../token-tracking-handler';

describe('TokenUsageTrackingHandler', () => {
	let handler: TokenUsageTrackingHandler;

	beforeEach(() => {
		handler = new TokenUsageTrackingHandler();
	});

	describe('handleLLMEnd', () => {
		it('should accumulate tokens from llmOutput.usage', async () => {
			const result: LLMResult = {
				generations: [[]],
				llmOutput: {
					usage: {
						input_tokens: 100,
						output_tokens: 50,
					},
				},
			};

			await handler.handleLLMEnd(result);

			expect(handler.getUsage()).toEqual({
				inputTokens: 100,
				outputTokens: 50,
			});
		});

		it('should accumulate tokens from multiple LLM calls', async () => {
			const result1: LLMResult = {
				generations: [[]],
				llmOutput: {
					usage: {
						input_tokens: 100,
						output_tokens: 50,
					},
				},
			};

			const result2: LLMResult = {
				generations: [[]],
				llmOutput: {
					usage: {
						input_tokens: 200,
						output_tokens: 100,
					},
				},
			};

			await handler.handleLLMEnd(result1);
			await handler.handleLLMEnd(result2);

			expect(handler.getUsage()).toEqual({
				inputTokens: 300,
				outputTokens: 150,
			});
		});

		it('should extract tokens from generation info when llmOutput is empty', async () => {
			const result: LLMResult = {
				generations: [
					[
						{
							text: 'response',
							generationInfo: {
								usage: {
									input_tokens: 75,
									output_tokens: 25,
								},
							},
						},
					],
				],
			};

			await handler.handleLLMEnd(result);

			expect(handler.getUsage()).toEqual({
				inputTokens: 75,
				outputTokens: 25,
			});
		});

		it('should handle missing usage data gracefully', async () => {
			const result: LLMResult = {
				generations: [[{ text: 'response' }]],
			};

			await handler.handleLLMEnd(result);

			expect(handler.getUsage()).toEqual({
				inputTokens: 0,
				outputTokens: 0,
			});
		});
	});

	describe('reset', () => {
		it('should reset accumulated usage to zero', async () => {
			const result: LLMResult = {
				generations: [[]],
				llmOutput: {
					usage: {
						input_tokens: 100,
						output_tokens: 50,
					},
				},
			};

			await handler.handleLLMEnd(result);
			expect(handler.getUsage().inputTokens).toBe(100);

			handler.reset();

			expect(handler.getUsage()).toEqual({
				inputTokens: 0,
				outputTokens: 0,
			});
		});
	});

	describe('getUsage', () => {
		it('should return zero for new handler', () => {
			expect(handler.getUsage()).toEqual({
				inputTokens: 0,
				outputTokens: 0,
			});
		});
	});
});
