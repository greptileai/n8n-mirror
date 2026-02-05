import { HumanMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import { END } from '@langchain/langgraph';

import {
	extractUserRequest,
	createStandardShouldContinue,
	extractToolMessagesForPersistence,
} from '../subgraph-helpers';

describe('subgraph-helpers', () => {
	describe('extractUserRequest', () => {
		it('should return default value for empty messages', () => {
			const result = extractUserRequest([]);
			expect(result).toBe('');
		});

		it('should return custom default value when provided', () => {
			const result = extractUserRequest([], 'fallback');
			expect(result).toBe('fallback');
		});

		it('should extract content from single HumanMessage', () => {
			const messages = [new HumanMessage('Build a workflow')];
			const result = extractUserRequest(messages);
			expect(result).toBe('Build a workflow');
		});

		it('should return the LAST HumanMessage content', () => {
			const messages: BaseMessage[] = [
				new HumanMessage('First request'),
				new AIMessage('Response 1'),
				new HumanMessage('Second request'),
				new AIMessage('Response 2'),
				new HumanMessage('Latest request'),
			];
			const result = extractUserRequest(messages);
			expect(result).toBe('Latest request');
		});

		it('should ignore non-HumanMessage messages', () => {
			const messages: BaseMessage[] = [
				new AIMessage('System message'),
				new HumanMessage('User message'),
				new ToolMessage({ content: 'Tool result', tool_call_id: '1' }),
			];
			const result = extractUserRequest(messages);
			expect(result).toBe('User message');
		});

		it('should return default when no HumanMessages exist', () => {
			const messages: BaseMessage[] = [
				new AIMessage('Response'),
				new ToolMessage({ content: 'Result', tool_call_id: '1' }),
			];
			const result = extractUserRequest(messages, 'no user input');
			expect(result).toBe('no user input');
		});

		it('should handle HumanMessage with non-string content', () => {
			const message = new HumanMessage('test');
			message.content = [{ type: 'text', text: 'array content' }];
			const messages = [message];
			const result = extractUserRequest(messages, 'fallback');
			// When content is not a string, should return default
			expect(result).toBe('fallback');
		});
	});

	describe('createStandardShouldContinue', () => {
		// Note: Iteration limits are now enforced via LangGraph's recursionLimit at invoke time
		const shouldContinue = createStandardShouldContinue();

		it('should return "tools" when tool calls exist', () => {
			const state = {
				messages: [
					new AIMessage({
						content: '',
						tool_calls: [{ name: 'search_nodes', args: { query: 'gmail' } }],
					}),
				],
			};
			expect(shouldContinue(state)).toBe('tools');
		});

		it('should return END when no tool calls in last message', () => {
			const state = {
				messages: [new AIMessage('Regular response without tools')],
			};
			expect(shouldContinue(state)).toBe(END);
		});

		it('should return END when tool_calls is empty array', () => {
			const state = {
				messages: [new AIMessage({ content: 'Done', tool_calls: [] })],
			};
			expect(shouldContinue(state)).toBe(END);
		});

		it('should return END for empty messages array', () => {
			const state = {
				messages: [] as BaseMessage[],
			};
			expect(shouldContinue(state)).toBe(END);
		});

		it('should check only the last message for tool calls', () => {
			const state = {
				messages: [
					new AIMessage({
						content: '',
						tool_calls: [{ name: 'old_tool', args: {} }],
					}),
					new AIMessage('Final response without tools'),
				],
			};
			expect(shouldContinue(state)).toBe(END);
		});
	});

	describe('extractToolMessagesForPersistence', () => {
		it('should return empty array for empty messages', () => {
			const result = extractToolMessagesForPersistence([]);
			expect(result).toEqual([]);
		});

		it('should include complete tool call/result pairs', () => {
			const messages: BaseMessage[] = [
				new HumanMessage('Context message'),
				new AIMessage({
					content: 'Response',
					tool_calls: [{ name: 'test_tool', args: {}, id: 'call-1' }],
				}),
				new ToolMessage({ content: 'Result', tool_call_id: 'call-1' }),
			];

			const result = extractToolMessagesForPersistence(messages);

			// HumanMessage is filtered out, only AIMessage with tool_calls and ToolMessage are included
			expect(result).toHaveLength(2);
			expect(result[0]).toBeInstanceOf(AIMessage);
			expect(result[1]).toBeInstanceOf(ToolMessage);
		});

		it('should include ToolMessage even without corresponding AIMessage', () => {
			const toolMessage = new ToolMessage({ content: 'Tool result', tool_call_id: 'call-1' });
			const messages: BaseMessage[] = [toolMessage];

			const result = extractToolMessagesForPersistence(messages);

			expect(result).toHaveLength(1);
			expect(result[0]).toBe(toolMessage);
		});

		it('should filter out AIMessages without tool_calls', () => {
			const messages: BaseMessage[] = [
				new HumanMessage('Context'),
				new AIMessage('Just a text response'), // No tool_calls
				new AIMessage({
					content: '',
					tool_calls: [{ name: 'tool', args: {}, id: 'call-1' }],
				}),
				new ToolMessage({ content: 'Result', tool_call_id: 'call-1' }),
			];

			const result = extractToolMessagesForPersistence(messages);

			expect(result).toHaveLength(2);
			// Should not include the AIMessage without tool_calls
			expect(result.find((m) => m.content === 'Just a text response')).toBeUndefined();
		});

		it('should include ToolMessages', () => {
			const toolMessage1 = new ToolMessage({ content: 'Result 1', tool_call_id: 'call-1' });
			const toolMessage2 = new ToolMessage({ content: 'Result 2', tool_call_id: 'call-2' });
			const messages: BaseMessage[] = [new HumanMessage('Context'), toolMessage1, toolMessage2];

			const result = extractToolMessagesForPersistence(messages);

			expect(result).toHaveLength(2);
			expect(result).toContain(toolMessage1);
			expect(result).toContain(toolMessage2);
		});

		it('should NOT include AIMessage with tool_calls if ANY tool_call lacks a corresponding ToolMessage', () => {
			const aiMessage = new AIMessage({
				content: '',
				tool_calls: [
					{ name: 'tool1', args: {}, id: 'call-1' },
					{ name: 'tool2', args: {}, id: 'call-2' }, // No corresponding ToolMessage
				],
			});
			const messages: BaseMessage[] = [
				new HumanMessage('Context'),
				aiMessage,
				new ToolMessage({ content: 'Result 1', tool_call_id: 'call-1' }), // Only one ToolMessage
			];

			const result = extractToolMessagesForPersistence(messages);

			// AIMessage should NOT be included because call-2 has no ToolMessage
			expect(result).toHaveLength(1);
			expect(result[0]).toBeInstanceOf(ToolMessage);
		});

		it('should include AIMessage with tool_calls only when ALL tool_calls have ToolMessages', () => {
			const aiMessage = new AIMessage({
				content: '',
				tool_calls: [
					{ name: 'tool1', args: {}, id: 'call-1' },
					{ name: 'tool2', args: {}, id: 'call-2' },
				],
			});
			const messages: BaseMessage[] = [
				new HumanMessage('Context'),
				aiMessage,
				new ToolMessage({ content: 'Result 1', tool_call_id: 'call-1' }),
				new ToolMessage({ content: 'Result 2', tool_call_id: 'call-2' }),
			];

			const result = extractToolMessagesForPersistence(messages);

			// AIMessage should be included because both tool_calls have ToolMessages
			expect(result).toHaveLength(3);
			expect(result[0]).toBe(aiMessage);
		});

		it('should handle multiple complete tool call/result pairs', () => {
			const aiMessage1 = new AIMessage({
				content: '',
				tool_calls: [{ name: 'tool1', args: {}, id: 'call-1' }],
			});
			const aiMessage2 = new AIMessage({
				content: '',
				tool_calls: [{ name: 'tool2', args: {}, id: 'call-2' }],
			});
			const messages: BaseMessage[] = [
				new HumanMessage('Context'),
				aiMessage1,
				new ToolMessage({ content: 'Result 1', tool_call_id: 'call-1' }),
				aiMessage2,
				new ToolMessage({ content: 'Result 2', tool_call_id: 'call-2' }),
			];

			const result = extractToolMessagesForPersistence(messages);

			expect(result).toHaveLength(4);
			expect(result[0]).toBe(aiMessage1);
			expect(result[1]).toBeInstanceOf(ToolMessage);
			expect(result[2]).toBe(aiMessage2);
			expect(result[3]).toBeInstanceOf(ToolMessage);
		});

		it('should exclude orphaned AIMessage at end of conversation (no ToolMessage response yet)', () => {
			const completedAI = new AIMessage({
				content: '',
				tool_calls: [{ name: 'tool1', args: {}, id: 'call-1' }],
			});
			const orphanedAI = new AIMessage({
				content: '',
				tool_calls: [{ name: 'tool2', args: {}, id: 'call-2' }], // No ToolMessage for this
			});
			const messages: BaseMessage[] = [
				new HumanMessage('Context'),
				completedAI,
				new ToolMessage({ content: 'Result 1', tool_call_id: 'call-1' }),
				orphanedAI, // This is orphaned - no ToolMessage follows
			];

			const result = extractToolMessagesForPersistence(messages);

			// Should include completed pair but exclude orphaned AIMessage
			expect(result).toHaveLength(2);
			expect(result[0]).toBe(completedAI);
			expect(result[1]).toBeInstanceOf(ToolMessage);
			expect(result).not.toContain(orphanedAI);
		});

		it('should handle AIMessage with empty tool_calls array', () => {
			const aiMessage = new AIMessage({
				content: 'Response',
				tool_calls: [], // Empty array
			});
			const messages: BaseMessage[] = [new HumanMessage('Context'), aiMessage];

			const result = extractToolMessagesForPersistence(messages);

			// AIMessage with empty tool_calls should NOT be included
			expect(result).toHaveLength(0);
		});

		it('should handle tool_call with undefined id gracefully', () => {
			const aiMessage = new AIMessage({
				content: '',
				tool_calls: [{ name: 'tool', args: {}, id: undefined }],
			});
			const messages: BaseMessage[] = [
				new HumanMessage('Context'),
				aiMessage,
				new ToolMessage({ content: 'Result', tool_call_id: 'some-id' }),
			];

			const result = extractToolMessagesForPersistence(messages);

			// AIMessage should NOT be included because tool_call.id is undefined
			expect(result).toHaveLength(1);
			expect(result[0]).toBeInstanceOf(ToolMessage);
		});
	});
});
