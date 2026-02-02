import { writeFileSync } from 'node:fs';

import type { ExampleResult, Feedback } from './harness-types';

/**
 * Fixed columns that appear first in the CSV (in order).
 */
const FIXED_COLUMNS = [
	'prompt',
	'overall_score',
	'status',
	'gen_latency_ms',
	'gen_input_tokens',
	'gen_output_tokens',
] as const;

/**
 * LLM Judge metrics to include (in order).
 * Each metric gets a score column and a _detail column.
 */
const LLM_JUDGE_METRICS = [
	'functionality',
	'connections',
	'expressions',
	'nodeConfiguration',
	'efficiency',
	'dataFlow',
	'maintainability',
	'bestPractices',
] as const;

/**
 * Escape a value for CSV output.
 * Wraps in quotes if contains comma, quote, or newline.
 */
function escapeCsvValue(value: string | number | undefined): string {
	if (value === undefined || value === null) return '';
	const str = String(value);
	if (str.includes(',') || str.includes('"') || str.includes('\n')) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}

/**
 * Extract the detail text from feedback for a given metric.
 * Returns semicolon-separated violation text.
 */
function extractMetricDetail(feedback: Feedback[], metric: string): string {
	const item = feedback.find(
		(f) => f.evaluator === 'llm-judge' && f.metric === metric && f.comment,
	);
	return item?.comment ?? '';
}

/**
 * Extract the score for a given metric.
 */
function extractMetricScore(feedback: Feedback[], metric: string): number | undefined {
	const item = feedback.find((f) => f.evaluator === 'llm-judge' && f.metric === metric);
	return item?.score;
}

/**
 * Build a CSV row from an ExampleResult.
 */
function buildCsvRow(result: ExampleResult): string[] {
	const row: string[] = [];

	// Fixed columns
	row.push(escapeCsvValue(result.prompt));
	row.push(escapeCsvValue(result.score));
	row.push(escapeCsvValue(result.status));
	row.push(escapeCsvValue(result.generationDurationMs));
	row.push(escapeCsvValue(result.generationInputTokens));
	row.push(escapeCsvValue(result.generationOutputTokens));

	// Metric columns (score + detail pairs)
	for (const metric of LLM_JUDGE_METRICS) {
		row.push(escapeCsvValue(extractMetricScore(result.feedback, metric)));
		row.push(escapeCsvValue(extractMetricDetail(result.feedback, metric)));
	}

	return row;
}

/**
 * Build the CSV header row.
 */
function buildCsvHeader(): string[] {
	const header: string[] = [...FIXED_COLUMNS];

	for (const metric of LLM_JUDGE_METRICS) {
		header.push(metric);
		header.push(`${metric}_detail`);
	}

	return header;
}

/**
 * Write evaluation results to a CSV file.
 * Results are sorted by prompt for consistent ordering across runs.
 */
export function writeResultsCsv(results: ExampleResult[], outputPath: string): void {
	// Sort by prompt for consistent ordering
	const sorted = [...results].sort((a, b) => a.prompt.localeCompare(b.prompt));

	const lines: string[] = [];

	// Header
	lines.push(buildCsvHeader().join(','));

	// Data rows
	for (const result of sorted) {
		lines.push(buildCsvRow(result).join(','));
	}

	// Write file (overwrites if exists)
	writeFileSync(outputPath, lines.join('\n') + '\n', 'utf-8');
}
