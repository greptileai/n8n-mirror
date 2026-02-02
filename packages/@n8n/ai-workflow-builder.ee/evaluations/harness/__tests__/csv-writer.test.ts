import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { writeResultsCsv } from '../csv-writer';
import type { ExampleResult } from '../harness-types';

describe('writeResultsCsv', () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), 'csv-writer-test-'));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it('writes sorted results with correct columns', () => {
		const results: ExampleResult[] = [
			{
				index: 2,
				prompt: 'Zebra workflow',
				status: 'pass',
				score: 0.9,
				feedback: [
					{
						evaluator: 'llm-judge',
						metric: 'functionality',
						score: 0.95,
						kind: 'metric',
						comment: '',
					},
					{
						evaluator: 'llm-judge',
						metric: 'connections',
						score: 0.85,
						kind: 'metric',
						comment: 'Minor issue',
					},
				],
				durationMs: 5000,
				generationDurationMs: 3000,
				generationInputTokens: 1000,
				generationOutputTokens: 500,
			},
			{
				index: 1,
				prompt: 'Alpha workflow',
				status: 'fail',
				score: 0.6,
				feedback: [
					{
						evaluator: 'llm-judge',
						metric: 'functionality',
						score: 0.5,
						kind: 'metric',
						comment: '[CRITICAL] Missing trigger',
					},
				],
				durationMs: 4000,
				generationDurationMs: 2500,
				generationInputTokens: 800,
				generationOutputTokens: 400,
			},
		];

		const outputPath = join(tempDir, 'results.csv');
		writeResultsCsv(results, outputPath);

		const content = readFileSync(outputPath, 'utf-8');
		const lines = content.trim().split('\n');

		// Check header
		expect(lines[0]).toContain('prompt,overall_score,status,gen_latency_ms');
		expect(lines[0]).toContain('functionality,functionality_detail');

		// Check sorting (Alpha before Zebra)
		expect(lines[1]).toContain('Alpha workflow');
		expect(lines[2]).toContain('Zebra workflow');

		// Check violation text is included
		expect(lines[1]).toContain('[CRITICAL] Missing trigger');
	});

	it('escapes commas and quotes in values', () => {
		const results: ExampleResult[] = [
			{
				index: 1,
				prompt: 'Workflow with "quotes" and, commas',
				status: 'pass',
				score: 0.8,
				feedback: [],
				durationMs: 1000,
			},
		];

		const outputPath = join(tempDir, 'results.csv');
		writeResultsCsv(results, outputPath);

		const content = readFileSync(outputPath, 'utf-8');
		// Should escape the prompt value
		expect(content).toContain('"Workflow with ""quotes"" and, commas"');
	});

	it('escapes newlines in values', () => {
		const results: ExampleResult[] = [
			{
				index: 1,
				prompt: 'Workflow with\nnewline',
				status: 'pass',
				score: 0.8,
				feedback: [],
				durationMs: 1000,
			},
		];

		const outputPath = join(tempDir, 'results.csv');
		writeResultsCsv(results, outputPath);

		const content = readFileSync(outputPath, 'utf-8');
		// Should escape the prompt value containing newline
		expect(content).toContain('"Workflow with\nnewline"');
	});

	it('writes pairwise evaluation results with correct columns', () => {
		const results: ExampleResult[] = [
			{
				index: 1,
				prompt: 'Test pairwise workflow',
				status: 'fail',
				score: 0.5,
				feedback: [
					{
						evaluator: 'pairwise',
						metric: 'pairwise_primary',
						score: 0,
						kind: 'score',
						comment: '0/3 judges passed',
					},
					{
						evaluator: 'pairwise',
						metric: 'pairwise_diagnostic',
						score: 0.67,
						kind: 'metric',
					},
					{
						evaluator: 'pairwise',
						metric: 'pairwise_judges_passed',
						score: 0,
						kind: 'detail',
					},
					{
						evaluator: 'pairwise',
						metric: 'pairwise_total_passes',
						score: 6,
						kind: 'detail',
					},
					{
						evaluator: 'pairwise',
						metric: 'pairwise_total_violations',
						score: 3,
						kind: 'detail',
					},
					{
						evaluator: 'pairwise',
						metric: 'judge1',
						score: 0,
						kind: 'detail',
						comment: '[Spec violation] Missing required field',
					},
					{
						evaluator: 'pairwise',
						metric: 'judge2',
						score: 1,
						kind: 'detail',
						comment: '',
					},
					{
						evaluator: 'pairwise',
						metric: 'judge3',
						score: 0,
						kind: 'detail',
						comment: '[Spec violation] Wrong parameter value',
					},
				],
				durationMs: 5000,
				generationDurationMs: 3000,
				generationInputTokens: 1000,
				generationOutputTokens: 500,
			},
		];

		const outputPath = join(tempDir, 'pairwise-results.csv');
		writeResultsCsv(results, outputPath);

		const content = readFileSync(outputPath, 'utf-8');
		const lines = content.trim().split('\n');

		// Check header has pairwise columns
		expect(lines[0]).toContain('prompt,overall_score,status,gen_latency_ms');
		expect(lines[0]).toContain('pairwise_primary');
		expect(lines[0]).toContain('pairwise_diagnostic');
		expect(lines[0]).toContain('pairwise_judges_passed');
		expect(lines[0]).toContain('pairwise_total_passes');
		expect(lines[0]).toContain('pairwise_total_violations');
		expect(lines[0]).toContain('judge1,judge1_detail');
		expect(lines[0]).toContain('judge2,judge2_detail');
		expect(lines[0]).toContain('judge3,judge3_detail');

		// Check data row contains judge violation details
		expect(lines[1]).toContain('[Spec violation] Missing required field');
		expect(lines[1]).toContain('[Spec violation] Wrong parameter value');
	});

	it('handles empty results array', () => {
		const results: ExampleResult[] = [];

		const outputPath = join(tempDir, 'empty-results.csv');
		writeResultsCsv(results, outputPath);

		const content = readFileSync(outputPath, 'utf-8');
		expect(content).toBe('');
	});
});
