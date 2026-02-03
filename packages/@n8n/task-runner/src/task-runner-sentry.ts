import { Service } from '@n8n/di';
import { createTaskRunnerFilter } from '@n8n/sentry-config';
import { ErrorReporter } from 'n8n-core';

import { SentryConfig } from './config/sentry-config';

/**
 * Sentry service for the task runner.
 */
@Service()
export class TaskRunnerSentry {
	constructor(
		private readonly config: SentryConfig,
		private readonly errorReporter: ErrorReporter,
	) {}

	async initIfEnabled() {
		const { dsn, n8nVersion, environment, deploymentName, profilesSampleRate, tracesSampleRate } =
			this.config;

		if (!dsn) return;

		await this.errorReporter.init({
			serverType: 'task_runner',
			dsn,
			release: `n8n@${n8nVersion}`,
			environment,
			serverName: deploymentName,
			// Use the composed task runner filter from @n8n/sentry-config
			beforeSendFilter: createTaskRunnerFilter(),
			withEventLoopBlockDetection: false,
			tracesSampleRate,
			profilesSampleRate,
			eligibleIntegrations: {
				Http: true,
			},
		});
	}

	async shutdown() {
		if (!this.config.dsn) return;

		await this.errorReporter.shutdown();
	}
}
