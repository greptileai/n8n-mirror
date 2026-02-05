import type { User } from '@n8n/db';
import { hasGlobalScope } from '@n8n/permissions';
import get from 'lodash/get';
import type { ICredentialDataDecryptedObject } from 'n8n-workflow';

import { BadRequestError } from '@/errors/response-errors/bad-request.error';
import { getAllKeyPaths } from '@/utils';

// #region External Secrets

/**
 * Checks if a string value contains an external secret expression.
 * Detects both dot notation ($secrets.vault.key) and bracket notation ($secrets['vault']['key']).
 */
export function containsExternalSecretExpression(value: string): boolean {
	return value.includes('$secrets.') || value.includes('$secrets[');
}

/**
 * Extracts the provider key from an external secret expression.
 * Supports both dot notation ($secrets.vault.key) and bracket notation ($secrets['vault']['key']).
 *
 * @param expression - The expression string containing $secrets reference
 * @returns The provider key, or null if extraction fails
 *
 * @example
 * extractProviderKey("={{ $secrets.vault.myKey }}") // returns "vault"
 * extractProviderKey("={{ $secrets['aws']['secret'] }}") // returns "aws"
 */
export function extractProviderKey(expression: string): string | null {
	// Handle dot notation: $secrets.providerKey.secretName
	const dotMatch = expression.match(/\$secrets\.([a-zA-Z0-9_-]+)/);
	if (dotMatch) {
		return dotMatch[1];
	}

	// Handle bracket notation: $secrets['providerKey'] or $secrets["providerKey"]
	const bracketMatch = expression.match(/\$secrets\[['"]([a-zA-Z0-9_-]+)['"]\]/);
	if (bracketMatch) {
		return bracketMatch[1];
	}

	return null;
}

/**
 * Checks if credential data contains any external secret expressions ($secrets)
 */
function containsExternalSecrets(data: ICredentialDataDecryptedObject): boolean {
	const secretPaths = getAllKeyPaths(data, '', [], containsExternalSecretExpression);
	return secretPaths.length > 0;
}

/**
 * Checks if any changed field in a credential contains an external secret expression
 */
export function isChangingExternalSecretExpression(
	newData: ICredentialDataDecryptedObject,
	existingData: ICredentialDataDecryptedObject,
): boolean {
	// Find all paths in newData that contain external secret expressions
	const newSecretPaths = getAllKeyPaths(newData, '', [], containsExternalSecretExpression);

	// Check if any of these paths represent a change from existingData
	for (const path of newSecretPaths) {
		const newValue = get(newData, path);
		const existingValue = get(existingData, path);

		if (newValue !== existingValue) {
			return true; // External secret expression is being added or modified
		}
	}

	return false;
}

/**
 * Validates if a user has permission to use external secrets in credentials
 *
 * @param dataToSave - only optional in case it's not provided in the payload of the request
 * @param decryptedExistingData - Optional existing credential data (optional as it can only be provided when updating an existing credential)
 * @throws {BadRequestError} If user lacks permission when attempting to use external secrets
 */
export function validateExternalSecretsPermissions(
	user: User,
	dataToSave?: ICredentialDataDecryptedObject,
	decryptedExistingData?: ICredentialDataDecryptedObject,
): void {
	if (!dataToSave) {
		return;
	}
	const isUpdatingExistingCredential = !!decryptedExistingData;
	const needsCheck = isUpdatingExistingCredential
		? isChangingExternalSecretExpression(dataToSave, decryptedExistingData)
		: containsExternalSecrets(dataToSave);
	if (needsCheck) {
		if (!hasGlobalScope(user, 'externalSecret:list')) {
			throw new BadRequestError('Lacking permissions to reference external secrets in credentials');
		}
	}
}

// #endregion
