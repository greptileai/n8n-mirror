/**
 * Question Quality Experiment - Runner
 *
 * Main experiment runner using evaluate() from langsmith/evaluation.
 * Follows the harness pattern: target does ALL work, evaluator extracts pre-computed feedback.
 */
import type { BaseMessage } from '@langchain/core/messages';
import { isAIMessage } from '@langchain/core/messages';
import { MemorySaver } from '@langchain/langgraph';
import { Client } from 'langsmith/client';
import { evaluate } from 'langsmith/evaluation';
import type { Run, Example } from 'langsmith/schemas';

import { DiscoverySubgraph } from '../../src/subgraphs/discovery.subgraph.js';
import { setupLLM } from '../support/environment.js';
import { loadNodesFromFile } from '../support/load-nodes.js';

import { ALL_TEST_CASES, type QuestionTestCase } from './dataset.js';
import {
	computeMetrics,
	metricsToFeedback,
	type QuestionData,
	type ComputedMetrics,
	type FeedbackEntry,
} from './evaluators.js';

// ---------------------------------------------------------------------------
// Thread ID generation
// ---------------------------------------------------------------------------

let threadCounter = 0;
function nextThreadId(): string {
	return `qq-eval-${Date.now()}-${++threadCounter}`;
}

// ---------------------------------------------------------------------------
// Target output shape
// ---------------------------------------------------------------------------

export interface TargetOutput {
	prompt: string;
	category: string;
	asked_questions: boolean;
	questions: QuestionData[];
	introMessage?: string;
	messages: BaseMessage[];
	metrics: ComputedMetrics;
}

// ---------------------------------------------------------------------------
// Target function factory
// ---------------------------------------------------------------------------

interface TargetDeps {
	discoverySubgraph: DiscoverySubgraph;
	parsedNodeTypes: Awaited<ReturnType<typeof loadNodesFromFile>>;
	llm: Awaited<ReturnType<typeof setupLLM>>;
}

function createTargetFunction(deps: TargetDeps) {
	const { discoverySubgraph, parsedNodeTypes, llm } = deps;

	return async (inputs: {
		prompt: string;
		category: string;
		relevantKeywords: string[];
	}): Promise<TargetOutput> => {
		const { prompt, category, relevantKeywords } = inputs;

		// Create a fresh graph with its own checkpointer for each run
		const graph = discoverySubgraph.create({
			parsedNodeTypes,
			llm,
			plannerLLM: llm,
			featureFlags: { planMode: true, templateExamples: true },
			checkpointer: new MemorySaver(),
		});

		const threadId = nextThreadId();
		const config = { configurable: { thread_id: threadId } };
		const input = {
			userRequest: prompt,
			workflowJSON: { nodes: [], connections: {}, name: '' },
			mode: 'plan' as const,
			planOutput: null,
			planFeedback: null,
			planPrevious: null,
		};

		// Run the discovery subgraph
		await graph.invoke(input, config);

		// Get the full state including interrupt data and messages
		const state = await graph.getState(config);
		const interruptData = state.tasks?.[0]?.interrupts?.[0];
		const interruptValue = interruptData?.value as
			| { type: string; questions?: QuestionData[]; introMessage?: string }
			| undefined;

		const askedQuestions = interruptValue?.type === 'questions';
		const questions = (askedQuestions ? (interruptValue?.questions ?? []) : []) as QuestionData[];
		const introMessage = askedQuestions ? interruptValue?.introMessage : undefined;

		// Get internal messages for search_nodes counting
		const messages: BaseMessage[] = (state.values?.messages as BaseMessage[]) ?? [];

		// Compute all metrics
		const metrics = computeMetrics({
			askedQuestions,
			questions,
			introMessage,
			messages,
			category,
			prompt,
			relevantKeywords,
		});

		return {
			prompt,
			category,
			asked_questions: askedQuestions,
			questions,
			introMessage,
			messages,
			metrics,
		};
	};
}

// ---------------------------------------------------------------------------
// LangSmith feedback extractor
// ---------------------------------------------------------------------------

function createFeedbackExtractor(): (rootRun: Run, example?: Example) => Promise<FeedbackEntry[]> {
	return async (rootRun: Run, _example?: Example): Promise<FeedbackEntry[]> => {
		const outputs = rootRun.outputs;
		if (!outputs || typeof outputs !== 'object' || !('metrics' in outputs)) {
			return [{ key: 'evaluation_error', score: 0, comment: 'No metrics found in target output' }];
		}

		const metrics = outputs.metrics as ComputedMetrics;
		return metricsToFeedback(metrics);
	};
}

// ---------------------------------------------------------------------------
// Local run (console output, no LangSmith)
// ---------------------------------------------------------------------------

export interface LocalRunOptions {
	concurrency: number;
}

export async function runLocal(options: LocalRunOptions): Promise<void> {
	console.log('Setting up environment...');

	const parsedNodeTypes = loadNodesFromFile();
	const llm = await setupLLM();
	const discoverySubgraph = new DiscoverySubgraph();

	console.log(`Loaded ${parsedNodeTypes.length} node types`);

	const target = createTargetFunction({ discoverySubgraph, parsedNodeTypes, llm });

	console.log(
		`\nRunning ${ALL_TEST_CASES.length} test cases (concurrency: ${options.concurrency})...\n`,
	);
	console.log('-'.repeat(80));

	const results: Array<{ testCase: QuestionTestCase; output: TargetOutput }> = [];

	// Run sequentially for local mode (simpler logging)
	for (const testCase of ALL_TEST_CASES) {
		console.log(`\nRunning: ${testCase.name}`);
		console.log(`  Prompt: "${testCase.prompt}"`);

		try {
			const output = await target({
				prompt: testCase.prompt,
				category: testCase.category,
				relevantKeywords: testCase.relevantKeywords,
			});

			results.push({ testCase, output });

			// Log result
			if (output.asked_questions) {
				console.log(`  Asked ${output.questions.length} question(s)`);
				for (const q of output.questions) {
					const opts = q.options?.length ? ` [${q.options.join(', ')}]` : '';
					console.log(`    - (${q.type}) ${q.question}${opts}`);
				}
				if (output.introMessage) {
					console.log(`  Intro: "${output.introMessage}"`);
				}
			} else {
				console.log('  No questions asked');
			}

			// Log metrics
			const feedback = metricsToFeedback(output.metrics);
			const failedMetrics = feedback.filter((f) => f.score === 0);
			if (failedMetrics.length > 0) {
				console.log(`  Failed metrics: ${failedMetrics.map((f) => f.key).join(', ')}`);
			} else {
				console.log('  All metrics passed');
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.log(`  ERROR: ${message}`);
		}
	}

	// Print summary
	console.log('\n' + '='.repeat(80));
	console.log('SUMMARY\n');

	const successResults = results.filter((r) => r.output);
	if (successResults.length === 0) {
		console.log('No successful results.');
		return;
	}

	// Aggregate metrics
	const metricSums: Record<string, number> = {};
	const metricCounts: Record<string, number> = {};

	for (const { output } of successResults) {
		const feedback = metricsToFeedback(output.metrics);
		for (const f of feedback) {
			metricSums[f.key] = (metricSums[f.key] ?? 0) + f.score;
			metricCounts[f.key] = (metricCounts[f.key] ?? 0) + 1;
		}
	}

	console.log('Average scores:');
	for (const key of Object.keys(metricSums).sort()) {
		const avg = metricSums[key] / metricCounts[key];
		const isBoolean = [
			'asked_questions',
			'keyword_hit',
			'no_other_option',
			'no_jargon',
			'has_options',
			'no_duplicate_options',
			'no_yes_no',
			'options_are_specific',
			'data_table_first',
		].includes(key);
		const display = isBoolean ? `${(avg * 100).toFixed(0)}%` : avg.toFixed(2);
		console.log(`  ${key}: ${display}`);
	}

	console.log(`\nTotal: ${successResults.length}/${ALL_TEST_CASES.length} completed`);
	console.log('='.repeat(80));
}

// ---------------------------------------------------------------------------
// LangSmith run
// ---------------------------------------------------------------------------

export interface LangSmithRunOptions {
	datasetName: string;
	experimentName: string;
	concurrency: number;
}

export async function runLangSmith(options: LangSmithRunOptions): Promise<void> {
	const { datasetName, experimentName, concurrency } = options;

	// Ensure tracing is enabled
	process.env.LANGSMITH_TRACING = 'true';

	const apiKey = process.env.LANGSMITH_API_KEY;
	if (!apiKey) {
		throw new Error('LANGSMITH_API_KEY environment variable is required');
	}

	console.log('Setting up environment...');

	const lsClient = new Client({ apiKey });
	const parsedNodeTypes = loadNodesFromFile();
	const llm = await setupLLM();
	const discoverySubgraph = new DiscoverySubgraph();

	console.log(`Loaded ${parsedNodeTypes.length} node types`);

	const targetFn = createTargetFunction({ discoverySubgraph, parsedNodeTypes, llm });

	// Wrap target for LangSmith evaluate() -- it receives dataset inputs
	const target = async (inputs: Record<string, unknown>): Promise<TargetOutput> => {
		const prompt = inputs.prompt as string;
		const category = inputs.category as string;
		const relevantKeywords = inputs.relevantKeywords as string[];

		return await targetFn({ prompt, category, relevantKeywords });
	};

	const feedbackExtractor = createFeedbackExtractor();

	console.log(`\nStarting LangSmith experiment "${experimentName}" on dataset "${datasetName}"...`);
	console.log(`Concurrency: ${concurrency}\n`);

	const experimentResults = await evaluate(target, {
		data: datasetName,
		evaluators: [feedbackExtractor],
		experimentPrefix: experimentName,
		maxConcurrency: concurrency,
		client: lsClient,
	});

	// Flush pending traces
	console.log('Flushing pending traces...');
	await lsClient.awaitPendingTraceBatches();

	const expName = experimentResults.experimentName;
	console.log(`\nExperiment completed: ${expName}`);
	console.log('View results in LangSmith dashboard.');
}
