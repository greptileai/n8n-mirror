import type { AuthenticatedRequest } from '@n8n/db';
import type { IDataObject, INodeProperties } from 'n8n-workflow';

export interface SecretsProviderSettings<T = IDataObject> {
	connected: boolean;
	connectedAt: Date | null;
	settings: T;
}

export interface ExternalSecretsSettings {
	[key: string]: SecretsProviderSettings;
}

export type SecretsProviderState =
	| 'initializing'
	| 'initialized'
	| 'connecting'
	| 'connected'
	| 'error'
	| 'retrying';

export interface ConnectResult {
	success: boolean;
	error?: Error;
}

export abstract class SecretsProvider {
	abstract displayName: string;

	abstract name: string;

	abstract properties: INodeProperties[];

	abstract init(settings: SecretsProviderSettings): Promise<void>;
	abstract disconnect(): Promise<void>;
	abstract update(): Promise<void>;
	abstract test(): Promise<[boolean] | [boolean, string]>;
	abstract getSecret(name: string): unknown;
	abstract hasSecret(name: string): boolean;
	abstract getSecretNames(): string[];

	state: SecretsProviderState = 'initializing';

	/**
	 * Template method for connecting - manages state transitions
	 * Subclasses implement doConnect() with their connection logic
	 */
	async connect(): Promise<ConnectResult> {
		this.setState('connecting');

		try {
			await this.doConnect();
			this.setState('connected');
			return { success: true };
		} catch (error) {
			const typedError = error instanceof Error ? error : new Error(String(error));
			this.setState('error', typedError);
			return { success: false, error: typedError };
		}
	}

	/**
	 * Subclasses implement this with their actual connection logic
	 * Should throw on error - base class handles state management
	 */
	protected abstract doConnect(): Promise<void>;

	/**
	 * Transitions to a new state
	 * Public so that external code can update state
	 */
	setState(newState: SecretsProviderState, _error?: Error): void {
		if (this.state === newState) return;
		this.state = newState;
	}

	/**
	 * Check if operations requiring connection can be performed
	 */
	get canPerformOperations(): boolean {
		return this.state === 'connected';
	}
}

export declare namespace ExternalSecretsRequest {
	type GetProviderResponse = Pick<SecretsProvider, 'displayName' | 'name' | 'properties'> & {
		icon: string;
		connected: boolean;
		connectedAt: Date | null;
		state: SecretsProviderState;
		data: IDataObject;
	};

	type GetProviders = AuthenticatedRequest;
	type GetProvider = AuthenticatedRequest<{ provider: string }, GetProviderResponse>;
	type SetProviderSettings = AuthenticatedRequest<{ provider: string }, {}, IDataObject>;
	type TestProviderSettings = SetProviderSettings;
	type SetProviderConnected = AuthenticatedRequest<
		{ provider: string },
		{},
		{ connected: boolean }
	>;

	type UpdateProvider = AuthenticatedRequest<{ provider: string }>;
}
