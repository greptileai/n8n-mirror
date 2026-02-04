import { mock } from 'jest-mock-extended';
import type { ErrorReporter } from 'n8n-core';

import { TaskRunnerSentry } from '../task-runner-sentry';

describe('TaskRunnerSentry', () => {
	const commonConfig = {
		n8nVersion: '1.0.0',
		environment: 'local',
		deploymentName: 'test',
		profilesSampleRate: 0,
		tracesSampleRate: 0,
	};

	afterEach(() => {
		jest.resetAllMocks();
	});

	describe('initIfEnabled', () => {
		const mockErrorReporter = mock<ErrorReporter>();

		it('should not configure sentry if dsn is not set', async () => {
			const sentry = new TaskRunnerSentry(
				{
					...commonConfig,
					dsn: '',
				},
				mockErrorReporter,
			);

			await sentry.initIfEnabled();

			expect(mockErrorReporter.init).not.toHaveBeenCalled();
		});

		it('should configure sentry if dsn is set', async () => {
			const sentry = new TaskRunnerSentry(
				{
					...commonConfig,
					dsn: 'https://sentry.io/123',
				},
				mockErrorReporter,
			);

			await sentry.initIfEnabled();

			expect(mockErrorReporter.init).toHaveBeenCalledWith({
				dsn: 'https://sentry.io/123',
				beforeSendFilter: expect.any(Function),
				release: 'n8n@1.0.0',
				environment: 'local',
				serverName: 'test',
				serverType: 'task_runner',
				withEventLoopBlockDetection: false,
				profilesSampleRate: 0,
				tracesSampleRate: 0,
				eligibleIntegrations: {
					Http: true,
				},
			});
		});
	});

	describe('shutdown', () => {
		const mockErrorReporter = mock<ErrorReporter>();

		it('should not shutdown sentry if dsn is not set', async () => {
			const sentry = new TaskRunnerSentry(
				{
					...commonConfig,
					dsn: '',
				},
				mockErrorReporter,
			);

			await sentry.shutdown();

			expect(mockErrorReporter.shutdown).not.toHaveBeenCalled();
		});

		it('should shutdown sentry if dsn is set', async () => {
			const sentry = new TaskRunnerSentry(
				{
					...commonConfig,
					dsn: 'https://sentry.io/123',
				},
				mockErrorReporter,
			);

			await sentry.shutdown();

			expect(mockErrorReporter.shutdown).toHaveBeenCalled();
		});
	});
});
