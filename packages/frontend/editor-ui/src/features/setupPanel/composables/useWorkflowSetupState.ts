import { computed, type Ref } from 'vue';

import type { INodeUi } from '@/Interface';
import type { NodeCredentialRequirement, NodeSetupState } from '../setupPanel.types';

import { useWorkflowsStore } from '@/app/stores/workflows.store';
import { useCredentialsStore } from '@/features/credentials/credentials.store';
import { useNodeHelpers } from '@/app/composables/useNodeHelpers';
import { useNodeTypesStore } from '@/app/stores/nodeTypes.store';
import { injectWorkflowState } from '@/app/composables/useWorkflowState';
import { getNodeTypeDisplayableCredentials } from '@/app/utils/nodes/nodeTransforms';
import { useToast } from '@/app/composables/useToast';
import { useI18n } from '@n8n/i18n';

/**
 * Composable that manages workflow setup state for credential configuration.
 * Derives state from node type definitions and current node credentials,
 * marking nodes as complete/incomplete based on credential selection and issues.
 * @param nodes Optional sub-set of nodes to check (defaults to full workflow)
 */
export const useWorkflowSetupState = (nodes?: Ref<INodeUi[]>) => {
	const workflowsStore = useWorkflowsStore();
	const credentialsStore = useCredentialsStore();
	const nodeTypesStore = useNodeTypesStore();
	const nodeHelpers = useNodeHelpers();
	const workflowState = injectWorkflowState();
	const toast = useToast();
	const i18n = useI18n();

	const sourceNodes = computed(() => nodes?.value ?? workflowsStore.allNodes);

	const getCredentialDisplayName = (credentialType: string): string => {
		const credentialTypeInfo = credentialsStore.getCredentialTypeByName(credentialType);
		return credentialTypeInfo?.displayName ?? credentialType;
	};

	/**
	 * Get all credential types that a node requires.
	 * Combines credentials from:
	 * 1. Node type definition (via getNodeTypeDisplayableCredentials)
	 * 2. Node issues (for credentials in parameters like HTTP Request auth)
	 * 3. Currently assigned credentials on the node
	 */
	const getNodeCredentialTypes = (node: INodeUi): string[] => {
		const credentialTypes = new Set<string>();

		const displayableCredentials = getNodeTypeDisplayableCredentials(nodeTypesStore, node);
		for (const cred of displayableCredentials) {
			credentialTypes.add(cred.name);
		}

		const credentialIssues = node.issues?.credentials ?? {};
		for (const credType of Object.keys(credentialIssues)) {
			credentialTypes.add(credType);
		}

		if (node.credentials) {
			for (const credType of Object.keys(node.credentials)) {
				credentialTypes.add(credType);
			}
		}

		return Array.from(credentialTypes);
	};

	const isTriggerNode = (node: INodeUi): boolean => {
		return nodeTypesStore.isTriggerNode(node.type);
	};

	const hasTriggerExecutedSuccessfully = (nodeName: string): boolean => {
		const runData = workflowsStore.getWorkflowResultDataByNodeName(nodeName);
		return runData !== null && runData.length > 0;
	};

	/**
	 * Get nodes that require setup:
	 * - Nodes with credential requirements
	 * - Trigger nodes (regardless of credentials)
	 * Sorted with triggers first, then by X position.
	 */
	const nodesRequiringSetup = computed(() => {
		const nodesForSetup = sourceNodes.value
			.filter((node) => !node.disabled)
			.map((node) => ({
				node,
				credentialTypes: getNodeCredentialTypes(node),
				isTrigger: isTriggerNode(node),
			}))
			.filter(({ credentialTypes, isTrigger }) => credentialTypes.length > 0 || isTrigger);

		return nodesForSetup.sort((a, b) => {
			if (a.isTrigger && !b.isTrigger) return -1;
			if (!a.isTrigger && b.isTrigger) return 1;
			return a.node.position[0] - b.node.position[0];
		});
	});

	/**
	 * Map of credential type -> node names that require it (for shared credential awareness in UI)
	 */
	const credentialTypeToNodeNames = computed(() => {
		const map = new Map<string, string[]>();
		for (const { node, credentialTypes } of nodesRequiringSetup.value) {
			for (const credType of credentialTypes) {
				const existing = map.get(credType) ?? [];
				existing.push(node.name);
				map.set(credType, existing);
			}
		}
		return map;
	});

	/**
	 * Node setup states - one entry per node that requires setup.
	 * This data is used by cards component.
	 */
	const nodeSetupStates = computed<NodeSetupState[]>(() => {
		return nodesRequiringSetup.value.map(({ node, credentialTypes, isTrigger }) => {
			const credentialIssues = node.issues?.credentials ?? {};

			// Build requirements from all credential types
			const credentialRequirements: NodeCredentialRequirement[] = credentialTypes.map(
				(credType) => {
					const credValue = node.credentials?.[credType];
					const selectedCredentialId =
						typeof credValue === 'string' ? undefined : (credValue?.id ?? undefined);

					const issues = credentialIssues[credType];
					const issueMessages = issues ? (Array.isArray(issues) ? issues : [issues]) : [];

					return {
						credentialType: credType,
						credentialDisplayName: getCredentialDisplayName(credType),
						selectedCredentialId,
						issues: issueMessages,
						nodesWithSameCredential: credentialTypeToNodeNames.value.get(credType) ?? [],
					};
				},
			);

			const credentialsConfigured = credentialRequirements.every(
				(req) => req.selectedCredentialId && req.issues.length === 0,
			);

			// For triggers: complete only after successful execution
			// For regular nodes: complete when credentials are configured
			const isComplete = isTrigger
				? credentialsConfigured && hasTriggerExecutedSuccessfully(node.name)
				: credentialsConfigured;

			return {
				node,
				credentialRequirements,
				isComplete,
				isTrigger,
			};
		});
	});

	const totalCredentialsMissing = computed(() => {
		return nodeSetupStates.value.reduce((total, state) => {
			const missing = state.credentialRequirements.filter(
				(req) => !req.selectedCredentialId || req.issues.length > 0,
			);
			return total + missing.length;
		}, 0);
	});

	const totalNodesRequiringSetup = computed(() => {
		return nodeSetupStates.value.length;
	});

	const isAllComplete = computed(() => {
		return (
			nodeSetupStates.value.length > 0 && nodeSetupStates.value.every((state) => state.isComplete)
		);
	});

	/**
	 * Sets a credential for a node and auto-assigns it to other nodes in setup panel that need it.
	 * @param nodeName
	 * @param credentialType
	 * @param credentialId
	 * @returns
	 */
	const setCredential = (nodeName: string, credentialType: string, credentialId: string): void => {
		const credential = credentialsStore.getCredentialById(credentialId);
		if (!credential) return;

		const node = workflowsStore.getNodeByName(nodeName);
		if (!node) return;

		const credentialDetails = { id: credentialId, name: credential.name };

		workflowState.updateNodeProperties({
			name: nodeName,
			properties: {
				credentials: {
					...node.credentials,
					[credentialType]: credentialDetails,
				},
			},
		});
		nodeHelpers.updateNodeCredentialIssuesByName(nodeName);

		const otherNodesUpdated: string[] = [];

		for (const state of nodeSetupStates.value) {
			if (state.node.name === nodeName) continue;

			const needsThisCredential = state.credentialRequirements.some(
				(req) => req.credentialType === credentialType && !req.selectedCredentialId,
			);

			if (needsThisCredential) {
				const targetNode = workflowsStore.getNodeByName(state.node.name);
				if (targetNode) {
					workflowState.updateNodeProperties({
						name: state.node.name,
						properties: {
							credentials: {
								...targetNode.credentials,
								[credentialType]: credentialDetails,
							},
						},
					});
					otherNodesUpdated.push(state.node.name);
				}
			}
		}

		if (otherNodesUpdated.length > 0) {
			nodeHelpers.updateNodesCredentialsIssues();
			toast.showMessage({
				title: i18n.baseText('nodeCredentials.showMessage.title'),
				message: i18n.baseText('nodeCredentials.autoAssigned.message', {
					interpolate: { count: String(otherNodesUpdated.length) },
				}),
				type: 'success',
			});
		}
	};

	const unsetCredential = (nodeName: string, credentialType: string): void => {
		const node = workflowsStore.getNodeByName(nodeName);
		if (!node) return;

		const updatedCredentials = { ...node.credentials };
		delete updatedCredentials[credentialType];

		workflowState.updateNodeProperties({
			name: nodeName,
			properties: {
				credentials: updatedCredentials,
			},
		});
		nodeHelpers.updateNodeCredentialIssuesByName(nodeName);
	};

	return {
		nodeSetupStates,
		totalCredentialsMissing,
		totalNodesRequiringSetup,
		isAllComplete,
		setCredential,
		unsetCredential,
	};
};
