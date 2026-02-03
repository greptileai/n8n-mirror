import type { Plugin } from 'vue';
import { ResponseError } from '@n8n/rest-api-client';
import { createFrontendBeforeSend, type IgnoredErrorPattern } from '@n8n/sentry-config';
import * as Sentry from '@sentry/vue';
import { getAndParseConfigFromMetaTag } from '@n8n/stores/metaTagConfig';

/**
 * Additional frontend-specific ignored errors.
 * These are on top of the default patterns from @n8n/sentry-config.
 */
const additionalIgnoredErrors: readonly IgnoredErrorPattern[] = [
	{ instanceof: ResponseError, message: /ECONNREFUSED/ },
	{ instanceof: ResponseError, message: "Can't connect to n8n." },
	{ instanceof: ResponseError, message: 'Unauthorized' },
] as const;

type SentryConfig = {
	dsn?: string;
	environment?: string;
	serverName?: string;
	release?: string;
};

// Create the beforeSend function using the centralized filter with additional patterns
export const beforeSend = createFrontendBeforeSend(additionalIgnoredErrors);

export const SentryPlugin: Plugin = {
	install: (app) => {
		const sentryConfig = getAndParseConfigFromMetaTag<SentryConfig>('sentry');
		if (!sentryConfig?.dsn) {
			return;
		}

		const { dsn, release, environment, serverName } = sentryConfig;

		Sentry.init({
			app,
			dsn,
			release,
			environment,
			integrations: [
				Sentry.captureConsoleIntegration({
					levels: ['error'],
				}),
				Sentry.rewriteFramesIntegration({
					prefix: '',
					root: window.location.origin + '/',
				}),
			],
			beforeSend,
		});

		if (serverName) {
			Sentry.setTag('server_name', serverName);
			Sentry.setUser({ id: serverName });
		}
	},
};
