import { useHistoryStore } from '@/app/stores/history.store';
import { EnterpriseEditionFeature } from '@/app/constants';
import { NodeHelpers } from 'n8n-workflow';
import type {
	INodeTypeDescription,
	INodeIssues,
	ICredentialType,
	INodeIssueObjectProperty,
	INodeInputConfiguration,
	Workflow,
	INodeCredentialsDetails,
	NodeConnectionType,
	INodeIssueData,
	INodeCredentials,
} from 'n8n-workflow';

import type { ICredentialsResponse } from '@/features/credentials/credentials.types';
import type { INodeUi, INodeUpdatePropertiesInformation } from '@/Interface';

import { useWorkflowsStore } from '@/app/stores/workflows.store';
import { useNodeTypesStore } from '@/app/stores/nodeTypes.store';
import { useCredentialsStore } from '@/features/credentials/credentials.store';
import { useI18n } from '@n8n/i18n';
import { EnableNodeToggleCommand } from '@/app/models/history';
import { useTelemetry } from './useTelemetry';
import { hasPermission } from '@/app/utils/rbac/permissions';
import { useSettingsStore } from '@/app/stores/settings.store';
import { hasProxyAuth, displayParameter } from '@/app/utils/nodeIssueUtils';

declare namespace HttpRequestNode {
	namespace V2 {
		type AuthParams = {
			authentication: 'none' | 'genericCredentialType' | 'predefinedCredentialType';
			genericAuthType: string;
			nodeCredentialType: string;
		};
	}
}

interface WorkflowNodeIssuesDeps {
	setNodeIssue: (data: INodeIssueData) => void;
	updateNodeProperties: (info: INodeUpdatePropertiesInformation) => void;
}

export function useWorkflowNodeIssuesState(deps: WorkflowNodeIssuesDeps) {
	const { setNodeIssue, updateNodeProperties } = deps;

	const credentialsStore = useCredentialsStore();
	const historyStore = useHistoryStore();
	const nodeTypesStore = useNodeTypesStore();
	const workflowsStore = useWorkflowsStore();
	const settingsStore = useSettingsStore();
	const i18n = useI18n();

	// Helper to get the current workflow object from the store
	function getWorkflowObject(): Workflow {
		return workflowsStore.workflowObject as Workflow;
	}

	////
	// Internal helpers
	////

	/**
	 * Whether the node has no selected credentials, or none of the node's
	 * selected credentials are of the specified type.
	 */
	function selectedCredsAreUnusable(node: INodeUi, credentialType: string) {
		return !node.credentials || !Object.keys(node.credentials).includes(credentialType);
	}

	/**
	 * Whether the node's selected credentials of the specified type
	 * can no longer be found in the database.
	 */
	function selectedCredsDoNotExist(
		node: INodeUi,
		nodeCredentialType: string,
		storedCredsByType: ICredentialsResponse[] | null,
	) {
		if (!node.credentials || !storedCredsByType) return false;

		const selectedCredsByType = node.credentials[nodeCredentialType];

		if (!selectedCredsByType) return false;

		return !storedCredsByType.find((c) => c.id === selectedCredsByType.id);
	}

	function reportUnsetCredential(credentialType: ICredentialType) {
		return {
			credentials: {
				[credentialType.name]: [
					i18n.baseText('nodeHelpers.credentialsUnset', {
						interpolate: {
							credentialType: credentialType.displayName,
						},
					}),
				],
			},
		};
	}

	// Set the status on all the nodes which produced an error so that it can be
	// displayed in the node-view
	function hasNodeExecutionIssues(node: INodeUi): boolean {
		const workflowResultData = workflowsStore.getWorkflowRunData;

		if (!workflowResultData?.hasOwnProperty(node.name)) {
			return false;
		}

		for (const taskData of workflowResultData[node.name]) {
			if (taskData.error !== undefined) {
				return true;
			}
		}

		return false;
	}

	function getNodeInputIssues(
		workflowInstance: Workflow,
		node: INodeUi,
		nodeType?: INodeTypeDescription,
	): INodeIssues | null {
		const foundIssues: INodeIssueObjectProperty = {};

		const workflowNode = workflowInstance.getNode(node.name);
		let inputs: Array<NodeConnectionType | INodeInputConfiguration> = [];
		if (nodeType && workflowNode) {
			inputs = NodeHelpers.getNodeInputs(workflowInstance, workflowNode, nodeType);
		}

		inputs.forEach((input) => {
			if (typeof input === 'string' || input.required !== true) {
				return;
			}

			const parentNodes = workflowInstance.getParentNodes(node.name, input.type, 1);

			if (parentNodes.length === 0) {
				foundIssues[input.type] = [
					i18n.baseText('nodeIssues.input.missing', {
						interpolate: { inputName: input.displayName || input.type },
					}),
				];
			}
		});

		if (Object.keys(foundIssues).length) {
			return {
				input: foundIssues,
			};
		}

		return null;
	}

	function getNodeCredentialIssues(
		node: INodeUi,
		nodeType?: INodeTypeDescription,
	): INodeIssues | null {
		const localNodeType = nodeType ?? nodeTypesStore.getNodeType(node.type, node.typeVersion);
		if (node.disabled) {
			// Node is disabled
			return null;
		}
		if (!localNodeType?.credentials) {
			// Node does not need any credentials or nodeType could not be found
			return null;
		}

		const foundIssues: INodeIssueObjectProperty = {};

		let userCredentials: ICredentialsResponse[] | null;
		let credentialType: ICredentialType | undefined;
		let credentialDisplayName: string;
		let selectedCredentials: INodeCredentialsDetails;

		const { authentication, genericAuthType, nodeCredentialType } =
			node.parameters as HttpRequestNode.V2.AuthParams;

		if (
			authentication === 'genericCredentialType' &&
			genericAuthType !== '' &&
			selectedCredsAreUnusable(node, genericAuthType)
		) {
			const credential = credentialsStore.getCredentialTypeByName(genericAuthType);
			return credential ? reportUnsetCredential(credential) : null;
		}

		if (
			hasProxyAuth(node) &&
			authentication === 'predefinedCredentialType' &&
			nodeCredentialType !== '' &&
			node.credentials !== undefined
		) {
			const stored = credentialsStore.getCredentialsByType(nodeCredentialType);
			// Prevents HTTP Request node from being unusable if a sharee does not have direct
			// access to a credential
			const isCredentialUsedInWorkflow =
				workflowsStore.usedCredentials?.[node.credentials?.[nodeCredentialType]?.id as string];

			if (
				selectedCredsDoNotExist(node, nodeCredentialType, stored) &&
				!isCredentialUsedInWorkflow
			) {
				const credential = credentialsStore.getCredentialTypeByName(nodeCredentialType);
				return credential ? reportUnsetCredential(credential) : null;
			}
		}

		if (
			hasProxyAuth(node) &&
			authentication === 'predefinedCredentialType' &&
			nodeCredentialType !== '' &&
			selectedCredsAreUnusable(node, nodeCredentialType)
		) {
			const credential = credentialsStore.getCredentialTypeByName(nodeCredentialType);
			return credential ? reportUnsetCredential(credential) : null;
		}

		for (const credentialTypeDescription of localNodeType.credentials) {
			// Check if credentials should be displayed else ignore
			const nodeTypeDescription = node?.type
				? nodeTypesStore.getNodeType(node.type, node.typeVersion)
				: null;
			if (
				!displayParameter(node.parameters, credentialTypeDescription, '', node, nodeTypeDescription)
			) {
				continue;
			}

			// Get the display name of the credential type
			credentialType = credentialsStore.getCredentialTypeByName(credentialTypeDescription.name);
			if (!credentialType) {
				credentialDisplayName = credentialTypeDescription.name;
			} else {
				credentialDisplayName = credentialType.displayName;
			}

			if (!node.credentials?.[credentialTypeDescription.name]) {
				// Credentials are not set
				if (credentialTypeDescription.required) {
					foundIssues[credentialTypeDescription.name] = [
						i18n.baseText('nodeIssues.credentials.notSet', {
							interpolate: { type: localNodeType.displayName },
						}),
					];
				}
			} else {
				// If they are set check if the value is valid
				selectedCredentials = node.credentials[credentialTypeDescription.name];
				if (typeof selectedCredentials === 'string') {
					selectedCredentials = {
						id: null,
						name: selectedCredentials,
					};
				}

				userCredentials = credentialsStore.getCredentialsByType(credentialTypeDescription.name);

				if (userCredentials === null) {
					userCredentials = [];
				}

				if (selectedCredentials.id) {
					const idMatch = userCredentials.find(
						(credentialData) => credentialData.id === selectedCredentials.id,
					);
					if (idMatch) {
						continue;
					}
				}

				const nameMatches = userCredentials.filter(
					(credentialData) => credentialData.name === selectedCredentials.name,
				);
				if (nameMatches.length > 1) {
					foundIssues[credentialTypeDescription.name] = [
						i18n.baseText('nodeIssues.credentials.notIdentified', {
							interpolate: { name: selectedCredentials.name, type: credentialDisplayName },
						}),
						i18n.baseText('nodeIssues.credentials.notIdentified.hint'),
					];
					continue;
				}

				if (nameMatches.length === 0) {
					const isCredentialUsedInWorkflow =
						workflowsStore.usedCredentials?.[selectedCredentials.id as string];

					if (
						!isCredentialUsedInWorkflow &&
						!hasPermission(['rbac'], { rbac: { scope: 'credential:read' } })
					) {
						foundIssues[credentialTypeDescription.name] = [
							i18n.baseText('nodeIssues.credentials.doNotExist', {
								interpolate: { name: selectedCredentials.name, type: credentialDisplayName },
							}),
							i18n.baseText('nodeIssues.credentials.doNotExist.hint'),
						];
					}
				}
			}
		}

		// TODO: Could later check also if the node has access to the credentials
		if (Object.keys(foundIssues).length === 0) {
			return null;
		}

		return {
			credentials: foundIssues,
		};
	}

	/**
	 * Returns a list of credential IDs that the current user does not have access to,
	 * if the Sharing feature is enabled.
	 *
	 * These are considered "foreign" credentials: the user can't view or manage them,
	 * but can still execute workflows that use them.
	 */
	function getForeignCredentialsIfSharingEnabled(
		credentials: INodeCredentials | undefined,
	): string[] {
		if (
			!credentials ||
			!settingsStore.isEnterpriseFeatureEnabled[EnterpriseEditionFeature.Sharing]
		) {
			return [];
		}

		const usedCredentials = workflowsStore.usedCredentials;

		return Object.values(credentials)
			.map(({ id }) => id)
			.filter((id) => id !== null)
			.filter((id) => id in usedCredentials && !usedCredentials[id]?.currentUserHasAccess);
	}

	function getNodeIssues(
		nodeType: INodeTypeDescription | null,
		node: INodeUi,
		workflowInstance: Workflow,
		ignoreIssues?: string[],
	): INodeIssues | null {
		const pinDataNodeNames = Object.keys(workflowsStore.pinnedWorkflowData ?? {});

		let nodeIssues: INodeIssues | null = null;
		ignoreIssues = ignoreIssues ?? [];

		if (node.disabled === true || pinDataNodeNames.includes(node.name)) {
			// Ignore issues on disabled and pindata nodes
			return null;
		}

		if (nodeType === null) {
			// Node type is not known
			if (!ignoreIssues.includes('typeUnknown')) {
				nodeIssues = {
					typeUnknown: true,
				};
			}
		} else {
			// Node type is known

			// Add potential parameter issues
			if (!ignoreIssues.includes('parameters')) {
				nodeIssues = NodeHelpers.getNodeParametersIssues(nodeType.properties, node, nodeType);
			}

			if (!ignoreIssues.includes('credentials')) {
				// Add potential credential issues
				const nodeCredentialIssues = getNodeCredentialIssues(node, nodeType);
				if (nodeIssues === null) {
					nodeIssues = nodeCredentialIssues;
				} else {
					NodeHelpers.mergeIssues(nodeIssues, nodeCredentialIssues);
				}
			}

			const nodeInputIssues = getNodeInputIssues(workflowInstance, node, nodeType);
			if (nodeIssues === null) {
				nodeIssues = nodeInputIssues;
			} else {
				NodeHelpers.mergeIssues(nodeIssues, nodeInputIssues);
			}
		}

		if (hasNodeExecutionIssues(node) && !ignoreIssues.includes('execution')) {
			if (nodeIssues === null) {
				nodeIssues = {};
			}
			nodeIssues.execution = true;
		}

		return nodeIssues;
	}

	////
	// Public functions
	////

	function updateNodeInputIssues(node: INodeUi): void {
		const nodeType = nodeTypesStore.getNodeType(node.type, node.typeVersion);
		if (!nodeType) {
			return;
		}

		const nodeInputIssues = getNodeInputIssues(getWorkflowObject(), node, nodeType);

		setNodeIssue({
			node: node.name,
			type: 'input',
			value: nodeInputIssues?.input ? nodeInputIssues.input : null,
		});
	}

	function updateNodesInputIssues() {
		const nodes = workflowsStore.allNodes;

		for (const node of nodes) {
			updateNodeInputIssues(node);
		}
	}

	function updateNodesExecutionIssues() {
		const nodes = workflowsStore.allNodes;

		for (const node of nodes) {
			setNodeIssue({
				node: node.name,
				type: 'execution',
				value: hasNodeExecutionIssues(node) ? true : null,
			});
		}
	}

	function updateNodesParameterIssues() {
		const nodes = workflowsStore.allNodes;

		for (const node of nodes) {
			updateNodeParameterIssues(node);
		}
	}

	function updateNodeCredentialIssuesByName(name: string): void {
		const node = workflowsStore.getNodeByName(name);

		if (node) {
			updateNodeCredentialIssues(node);
		}
	}

	function updateNodeCredentialIssues(node: INodeUi): void {
		const fullNodeIssues: INodeIssues | null = getNodeCredentialIssues(node);

		let newIssues: INodeIssueObjectProperty | null = null;
		if (fullNodeIssues !== null) {
			newIssues = fullNodeIssues.credentials!;
		}

		setNodeIssue({
			node: node.name,
			type: 'credentials',
			value: newIssues,
		});
	}

	function updateNodeParameterIssuesByName(name: string): void {
		const node = workflowsStore.getNodeByName(name);

		if (node) {
			updateNodeParameterIssues(node);
		}
	}

	function updateNodeParameterIssues(node: INodeUi, nodeType?: INodeTypeDescription | null): void {
		const localNodeType = nodeType ?? nodeTypesStore.getNodeType(node.type, node.typeVersion);

		if (localNodeType === null) {
			// Could not find localNodeType so can not update issues
			return;
		}

		// All data got updated everywhere so update now the issues
		const fullNodeIssues: INodeIssues | null = NodeHelpers.getNodeParametersIssues(
			localNodeType.properties,
			node,
			localNodeType,
		);

		let newIssues: INodeIssueObjectProperty | null = null;
		if (fullNodeIssues !== null) {
			newIssues = fullNodeIssues.parameters!;
		}

		setNodeIssue({
			node: node.name,
			type: 'parameters',
			value: newIssues,
		});
	}

	function updateNodesCredentialsIssues() {
		const nodes = workflowsStore.allNodes;
		let issues: INodeIssues | null;

		for (const node of nodes) {
			issues = getNodeCredentialIssues(node);

			setNodeIssue({
				node: node.name,
				type: 'credentials',
				value: issues?.credentials ?? null,
			});
		}
	}

	function disableNodes(nodes: INodeUi[], { trackHistory = false, trackBulk = true } = {}) {
		const telemetry = useTelemetry();

		if (trackHistory && trackBulk) {
			historyStore.startRecordingUndo();
		}

		const newDisabledState = nodes.some((node) => !node.disabled);
		for (const node of nodes) {
			if (newDisabledState === node.disabled) {
				continue;
			}

			// Toggle disabled flag
			const updateInformation: INodeUpdatePropertiesInformation = {
				name: node.name,
				properties: {
					disabled: newDisabledState,
				},
			};

			telemetry.track('User set node enabled status', {
				node_type: node.type,
				is_enabled: node.disabled,
				workflow_id: workflowsStore.workflowId,
			});

			updateNodeProperties(updateInformation);
			workflowsStore.clearNodeExecutionData(node.name);
			updateNodeParameterIssues(node);
			updateNodeCredentialIssues(node);
			updateNodesInputIssues();
			if (trackHistory) {
				historyStore.pushCommandToUndo(
					new EnableNodeToggleCommand(
						node.name,
						node.disabled === true,
						newDisabledState,
						Date.now(),
					),
				);
			}
		}

		if (trackHistory && trackBulk) {
			historyStore.stopRecordingUndo();
		}
	}

	/**
	 * Merges the given issues into an existing node's issues.
	 * This is used to update issues without recalculating all of them.
	 */
	function mergeNodeIssues(nodeName: string, issues: INodeIssues): void {
		const node = workflowsStore.getNodeByName(nodeName);
		if (!node) return;

		updateNodeProperties({
			name: nodeName,
			properties: {
				issues: {
					...node.issues,
					...issues,
				},
			},
		});
	}

	return {
		// Node issue update functions
		updateNodeInputIssues,
		updateNodesInputIssues,
		updateNodesExecutionIssues,
		updateNodesParameterIssues,
		updateNodeCredentialIssuesByName,
		updateNodeCredentialIssues,
		updateNodeParameterIssuesByName,
		updateNodeParameterIssues,
		updateNodesCredentialsIssues,
		disableNodes,
		mergeNodeIssues,

		// Helper functions that may be needed externally
		getNodeIssues,
		getNodeCredentialIssues,
		getNodeInputIssues,
		hasNodeExecutionIssues,
		getForeignCredentialsIfSharingEnabled,
	};
}

export type WorkflowNodeIssuesState = ReturnType<typeof useWorkflowNodeIssuesState>;
