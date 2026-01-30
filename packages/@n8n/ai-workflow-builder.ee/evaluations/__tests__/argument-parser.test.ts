import { parseEvaluationArgs, type EvaluationSuite } from '../cli/argument-parser';
import type { PromptVersionId } from '../../src/prompts/one-shot';

describe('argument-parser', () => {
	describe('suite options', () => {
		it('accepts all valid suite options', () => {
			const validSuites: EvaluationSuite[] = [
				'llm-judge',
				'pairwise',
				'programmatic',
				'similarity',
			];

			for (const suite of validSuites) {
				const args = parseEvaluationArgs(['--suite', suite]);
				expect(args.suite).toBe(suite);
			}
		});
	});

	it('parses numeric flags like --max-examples and --concurrency', () => {
		const args = parseEvaluationArgs([
			'--suite',
			'pairwise',
			'--backend',
			'langsmith',
			'--max-examples',
			'5',
			'--concurrency',
			'3',
		]);

		expect(args.maxExamples).toBe(5);
		expect(args.concurrency).toBe(3);
	});

	it('supports inline --max-examples= syntax', () => {
		const args = parseEvaluationArgs(['--max-examples=7']);
		expect(args.maxExamples).toBe(7);
	});

	it('parses filters for pairwise suite', () => {
		const args = parseEvaluationArgs([
			'--suite',
			'pairwise',
			'--backend',
			'langsmith',
			'--filter',
			'do:Slack',
			'--filter',
			'technique:content_generation',
		]);

		expect(args.filters).toEqual({
			doSearch: 'Slack',
			technique: 'content_generation',
		});
	});

	it('accepts prompt values that start with "-"', () => {
		const args = parseEvaluationArgs(['--prompt', '-starts-with-dash']);
		expect(args.prompt).toBe('-starts-with-dash');
	});

	it('rejects conflicting backend/local when --langsmith is set', () => {
		expect(() => parseEvaluationArgs(['--langsmith', '--backend', 'local'])).toThrow(
			'Cannot combine `--langsmith` with `--backend local`',
		);
	});

	it('treats --langsmith as backend=langsmith', () => {
		const args = parseEvaluationArgs(['--langsmith']);
		expect(args.backend).toBe('langsmith');
	});

	it('rejects do/dont filters for non-pairwise suite', () => {
		expect(() => parseEvaluationArgs(['--suite', 'llm-judge', '--filter', 'do:Slack'])).toThrow(
			'only supported for `--suite pairwise`',
		);
	});

	it('rejects malformed filters', () => {
		expect(() =>
			parseEvaluationArgs(['--suite', 'pairwise', '--backend', 'langsmith', '--filter', 'nope']),
		).toThrow('Invalid `--filter` format');
	});

	describe('--webhook-url', () => {
		it('parses valid HTTPS webhook URL', () => {
			const args = parseEvaluationArgs(['--webhook-url', 'https://example.com/webhook']);
			expect(args.webhookUrl).toBe('https://example.com/webhook');
		});

		it('parses webhook URL with inline = syntax', () => {
			const args = parseEvaluationArgs(['--webhook-url=https://api.example.com/hook']);
			expect(args.webhookUrl).toBe('https://api.example.com/hook');
		});

		it('rejects invalid URL format', () => {
			expect(() => parseEvaluationArgs(['--webhook-url', 'not-a-url'])).toThrow();
		});

		it('rejects non-URL strings', () => {
			expect(() => parseEvaluationArgs(['--webhook-url', 'just-some-text'])).toThrow();
		});

		it('allows webhook URL to be undefined when not provided', () => {
			const args = parseEvaluationArgs([]);
			expect(args.webhookUrl).toBeUndefined();
		});

		it('parses webhook URL with path and query params', () => {
			const args = parseEvaluationArgs([
				'--webhook-url',
				'https://hooks.example.com/api/v1/notify?token=abc123',
			]);
			expect(args.webhookUrl).toBe('https://hooks.example.com/api/v1/notify?token=abc123');
		});
	});

	describe('--webhook-secret', () => {
		it('parses valid webhook secret', () => {
			const args = parseEvaluationArgs([
				'--webhook-secret',
				'my-secure-secret-key-1234567890',
			]);
			expect(args.webhookSecret).toBe('my-secure-secret-key-1234567890');
		});

		it('parses webhook secret with inline = syntax', () => {
			const args = parseEvaluationArgs([
				'--webhook-secret=another-secret-key-12345678',
			]);
			expect(args.webhookSecret).toBe('another-secret-key-12345678');
		});

		it('rejects secret shorter than 16 characters', () => {
			expect(() => parseEvaluationArgs(['--webhook-secret', 'short'])).toThrow();
		});

		it('allows webhook secret to be undefined when not provided', () => {
			const args = parseEvaluationArgs([]);
			expect(args.webhookSecret).toBeUndefined();
		});

		it('can be combined with webhook URL', () => {
			const args = parseEvaluationArgs([
				'--webhook-url',
				'https://example.com/webhook',
				'--webhook-secret',
				'my-secure-secret-key-1234567890',
			]);
			expect(args.webhookUrl).toBe('https://example.com/webhook');
			expect(args.webhookSecret).toBe('my-secure-secret-key-1234567890');
		});
	});

	describe('--prompt-version flag', () => {
		it('parses --prompt-version v1-sonnet', () => {
			const args = parseEvaluationArgs(['--prompt-version', 'v1-sonnet']);
			expect(args.promptVersion).toBe('v1-sonnet');
		});

		it('parses --prompt-version v2-opus', () => {
			const args = parseEvaluationArgs(['--prompt-version', 'v2-opus']);
			expect(args.promptVersion).toBe('v2-opus');
		});

		it('defaults to v1-sonnet when not specified', () => {
			const args = parseEvaluationArgs([]);
			expect(args.promptVersion).toBe('v1-sonnet');
		});

		it('accepts all valid prompt version options', () => {
			const validVersions: PromptVersionId[] = ['v1-sonnet', 'v2-opus'];

			for (const version of validVersions) {
				const args = parseEvaluationArgs(['--prompt-version', version]);
				expect(args.promptVersion).toBe(version);
			}
		});

		it('supports inline --prompt-version= syntax', () => {
			const args = parseEvaluationArgs(['--prompt-version=v2-opus']);
			expect(args.promptVersion).toBe('v2-opus');
		});

		it('rejects invalid prompt version', () => {
			expect(() => parseEvaluationArgs(['--prompt-version', 'invalid-version'])).toThrow();
		});
	});
});
