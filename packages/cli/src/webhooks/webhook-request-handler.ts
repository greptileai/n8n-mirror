import { Logger } from '@n8n/backend-common';
import { Container } from '@n8n/di';
import type express from 'express';
import {
	isWebhookHtmlSandboxingDisabled,
	getWebhookSandboxCSP,
	isHtmlRenderedContentType,
} from 'n8n-core';
import { ensureError, type IHttpRequestMethods } from 'n8n-workflow';
import { Readable } from 'stream';
import { finished } from 'stream/promises';

import { WebhookNotFoundError } from '@/errors/response-errors/webhook-not-found.error';
import * as ResponseHelper from '@/response-helper';
import type {
	WebhookStaticResponse,
	WebhookResponse,
	WebhookResponseStream,
} from '@/webhooks/webhook-response';
import {
	isWebhookNoResponse,
	isWebhookStaticResponse,
	isWebhookResponse,
	isWebhookStreamResponse,
} from '@/webhooks/webhook-response';
import type {
	IWebhookManager,
	WebhookOptionsRequest,
	WebhookRequest,
	WebhookResponseHeaders,
} from '@/webhooks/webhook.types';

const WEBHOOK_METHODS: IHttpRequestMethods[] = ['DELETE', 'GET', 'HEAD', 'PATCH', 'POST', 'PUT'];

class WebhookRequestHandler {
	constructor(private readonly webhookManager: IWebhookManager) {}

	/**
	 * Handles an incoming webhook request. Handles CORS and delegates the
	 * request to the webhook manager to execute the webhook.
	 *
	 * **CORS Preflight Invariants (OPTIONS requests):**
	 * - CORS headers MUST be set for all OPTIONS requests (even without Origin header)
	 * - Access-Control-Allow-Methods MUST be set if webhook manager supports it
	 * - Access-Control-Allow-Origin MUST be set (handles null origin explicitly)
	 * - Access-Control-Max-Age MUST be set for preflight caching
	 * - Access-Control-Allow-Headers MUST echo requested headers if present
	 *
	 * **Why OPTIONS always needs CORS headers:**
	 * - Browsers send OPTIONS preflight before POST/PUT/PATCH with custom headers
	 * - Browsers from `file://` URLs send `Origin: null` (string "null")
	 * - Some browsers may omit Origin header in edge cases
	 * - Preflight MUST succeed for actual request to proceed
	 */
	async handleRequest(req: WebhookRequest | WebhookOptionsRequest, res: express.Response) {
		const method = req.method;

		if (method !== 'OPTIONS' && !WEBHOOK_METHODS.includes(method)) {
			return ResponseHelper.sendErrorResponse(
				res,
				new Error(`The method ${method} is not supported.`),
			);
		}

		// **INVARIANT:** OPTIONS requests ALWAYS need CORS headers, even without Origin header
		// This ensures browser preflight requests succeed regardless of origin (including null origin)
		const needsCorsHeaders = method === 'OPTIONS' || 'origin' in req.headers;

		if (needsCorsHeaders) {
			const corsSetupError = await this.setupCorsHeaders(req, res);
			if (corsSetupError) {
				return ResponseHelper.sendErrorResponse(res, corsSetupError);
			}
		}

		// **INVARIANT:** OPTIONS requests return 204 No Content after CORS headers are set
		if (method === 'OPTIONS') {
			return ResponseHelper.sendSuccessResponse(res, {}, true, 204);
		}

		try {
			const response = await this.webhookManager.executeWebhook(req, res);

			// Modern way of responding to webhooks
			if (isWebhookResponse(response)) {
				await this.sendWebhookResponse(res, response);
			} else if (response.noWebhookResponse !== true) {
				// Legacy way of responding to webhooks. `WebhookResponse` should be used to
				// pass the response from the webhookManager. However, we still have code
				// that doesn't use that yet. We need to keep this here until all codepaths
				// return a `WebhookResponse` instead.
				this.sendLegacyResponse(res, response.data, true, response.responseCode, response.headers);
			}
		} catch (e) {
			const error = ensureError(e);

			const logger = Container.get(Logger);

			if (e instanceof WebhookNotFoundError) {
				logger.error(`Received request for unknown webhook: ${e.message}`);
			} else {
				logger.error(
					`Error in handling webhook request ${req.method} ${req.path}: ${error.message}`,
					{ stacktrace: error.stack },
				);
			}

			return ResponseHelper.sendErrorResponse(res, error);
		}
	}

	private async sendWebhookResponse(res: express.Response, webhookResponse: WebhookResponse) {
		if (isWebhookNoResponse(webhookResponse)) {
			return;
		}

		if (isWebhookStaticResponse(webhookResponse)) {
			this.sendStaticResponse(res, webhookResponse);
			return;
		}

		if (isWebhookStreamResponse(webhookResponse)) {
			await this.sendStreamResponse(res, webhookResponse);
			return;
		}
	}

	private async sendStreamResponse(res: express.Response, webhookResponse: WebhookResponseStream) {
		const { stream, code, headers } = webhookResponse;

		this.setResponseStatus(res, code);
		this.setResponseHeaders(res, headers);

		stream.pipe(res, { end: false });
		await finished(stream);

		process.nextTick(() => res.end());
	}

	private sendStaticResponse(res: express.Response, webhookResponse: WebhookStaticResponse) {
		const { body, code, headers } = webhookResponse;

		this.setResponseStatus(res, code);
		this.setResponseHeaders(res, headers);

		if (typeof body === 'string') {
			res.send(body);
		} else {
			res.json(body);
		}
	}

	private setResponseStatus(res: express.Response, statusCode?: number) {
		if (statusCode !== undefined) {
			res.status(statusCode);
		}
	}

	private setResponseHeaders(res: express.Response, headers?: WebhookResponseHeaders) {
		if (headers) {
			for (const [name, value] of headers.entries()) {
				res.setHeader(name, value);
			}
		}

		const contentType = res.getHeader('content-type') as string | undefined;
		const needsSandbox = !contentType || isHtmlRenderedContentType(contentType);

		if (needsSandbox && !isWebhookHtmlSandboxingDisabled()) {
			res.setHeader('Content-Security-Policy', getWebhookSandboxCSP());
		}
	}

	/**
	 * Sends a legacy response to the client, i.e. when the webhook response is not a `WebhookResponse`.
	 * @deprecated Use `sendWebhookResponse` instead.
	 */
	private sendLegacyResponse(
		res: express.Response,
		data: any,
		raw?: boolean,
		responseCode?: number,
		responseHeader?: object,
	) {
		this.setResponseStatus(res, responseCode);
		if (responseHeader) {
			this.setResponseHeaders(res, new Map(Object.entries(responseHeader)));
		}

		if (data instanceof Readable) {
			data.pipe(res);
			return;
		}

		if (raw === true) {
			if (typeof data === 'string') {
				res.send(data);
			} else {
				res.json(data);
			}
		} else {
			res.json({
				data,
			});
		}
	}

	/**
	 * Sets up CORS headers for webhook requests.
	 *
	 * **Invariants for OPTIONS (preflight) requests:**
	 * 1. Access-Control-Allow-Methods MUST be set if webhook manager supports getWebhookMethods()
	 * 2. Access-Control-Allow-Origin MUST always be set (handles null origin explicitly)
	 * 3. Access-Control-Max-Age MUST be set (300 seconds for preflight caching)
	 * 4. Access-Control-Allow-Headers MUST echo requested headers if present
	 *
	 * **Null Origin Handling:**
	 * - Browsers from `file://` URLs send `Origin: null` (literal string "null")
	 * - Some browsers may omit Origin header entirely
	 * - For wildcard origins (*), use '*' for null/missing origins
	 * - For specific origins, fallback to first allowed origin
	 *
	 * **Why this matters:**
	 * - Browser preflight (OPTIONS) MUST succeed for actual request to proceed
	 * - Failing preflight causes "CORS policy" errors in browser console
	 * - Waiting webhooks need to work from any origin (file://, localhost, etc.)
	 *
	 * @param req - Webhook request (may be OPTIONS preflight)
	 * @param res - Express response object
	 * @returns Error if CORS setup fails, null otherwise
	 */
	private async setupCorsHeaders(
		req: WebhookRequest | WebhookOptionsRequest,
		res: express.Response,
	): Promise<Error | null> {
		const method = req.method;
		const { path } = req.params;
		const origin = req.headers.origin;

		// **INVARIANT 1:** Set Access-Control-Allow-Methods if webhook manager supports it
		// This is REQUIRED for OPTIONS preflight to succeed
		if (this.webhookManager.getWebhookMethods) {
			try {
				const allowedMethods = await this.webhookManager.getWebhookMethods(path);
				// Always include OPTIONS in allowed methods (required for preflight)
				res.header('Access-Control-Allow-Methods', ['OPTIONS', ...allowedMethods].join(', '));
			} catch (error) {
				// If getting methods fails, return error (don't proceed with incomplete CORS headers)
				return error as Error;
			}
		}

		// Determine the HTTP method being requested (for preflight, use Access-Control-Request-Method)
		const requestedMethod =
			method === 'OPTIONS'
				? (req.headers['access-control-request-method'] as IHttpRequestMethods)
				: method;

		// **INVARIANT 2:** Set Access-Control-Allow-Origin
		// This MUST always be set for CORS to work, especially for preflight requests
		if (this.webhookManager.findAccessControlOptions && requestedMethod) {
			const options = await this.webhookManager.findAccessControlOptions(path, requestedMethod);
			const { allowedOrigins } = options ?? {};

			// Handle wildcard origins (*) - explicitly handle null origin case
			if (allowedOrigins === '*') {
				// **Null Origin Handling:** Browsers from file:// URLs send Origin: "null" (string)
				// For wildcard origins, use '*' when origin is null or missing
				// This ensures preflight succeeds even from file:// URLs
				if (origin === 'null' || !origin) {
					res.header('Access-Control-Allow-Origin', '*');
				} else {
					// Echo back the actual origin for wildcard policy
					res.header('Access-Control-Allow-Origin', origin);
				}
			} else if (allowedOrigins) {
				// Handle specific allowed origins (comma-separated list)
				const originsList = allowedOrigins.split(',').map((o) => o.trim());
				const requestOrigin = origin as string | undefined;

				if (requestOrigin && originsList.includes(requestOrigin)) {
					// Request origin matches allowed list
					res.header('Access-Control-Allow-Origin', requestOrigin);
				} else if (originsList.length > 0) {
					// Request origin doesn't match - use first allowed origin as fallback
					// This is intentional: we don't want to fail preflight, but also don't allow unauthorized origins
					res.header('Access-Control-Allow-Origin', originsList[0]);
				}
			} else if (origin) {
				// No CORS config from webhook manager - echo back origin if present
				res.header('Access-Control-Allow-Origin', origin);
			} else if (method === 'OPTIONS') {
				// **INVARIANT:** OPTIONS without origin MUST still get Access-Control-Allow-Origin
				// Use '*' to ensure preflight succeeds (some browsers omit Origin header)
				res.header('Access-Control-Allow-Origin', '*');
			}

			// **INVARIANT 3 & 4:** Set preflight-specific headers for OPTIONS requests
			if (method === 'OPTIONS') {
				// Set preflight cache duration (300 seconds = 5 minutes)
				res.header('Access-Control-Max-Age', '300');

				// Echo back requested headers if present (required for custom headers like Content-Type: application/json)
				const requestedHeaders = req.headers['access-control-request-headers'];
				if (requestedHeaders?.length) {
					res.header('Access-Control-Allow-Headers', requestedHeaders);
				}
			}
		} else if (method === 'OPTIONS') {
			// **Fallback:** If webhook manager doesn't support CORS config, still set basic headers
			// This ensures OPTIONS requests don't fail even for webhook managers without CORS support
			// This is intentional: we want preflight to succeed, not fail silently

			// Handle null origin explicitly
			if (origin === 'null' || !origin) {
				res.header('Access-Control-Allow-Origin', '*');
			} else {
				res.header('Access-Control-Allow-Origin', origin);
			}

			// Set required preflight headers
			res.header('Access-Control-Max-Age', '300');
			const requestedHeaders = req.headers['access-control-request-headers'];
			if (requestedHeaders?.length) {
				res.header('Access-Control-Allow-Headers', requestedHeaders);
			}
		}

		return null;
	}
}

export function createWebhookHandlerFor(webhookManager: IWebhookManager) {
	const handler = new WebhookRequestHandler(webhookManager);

	return async (req: WebhookRequest | WebhookOptionsRequest, res: express.Response) => {
		const { params } = req;
		if (Array.isArray(params.path)) {
			params.path = params.path.join('/');
		}
		await handler.handleRequest(req, res);
	};
}
