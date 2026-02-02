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
});
