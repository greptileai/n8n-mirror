import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from '@n8n/i18n';
import { useToast } from '@/app/composables/useToast';
import { useDocumentTitle } from '@/app/composables/useDocumentTitle';
import { useExternalHooks } from '@/app/composables/useExternalHooks';
import { useCanvasOperations } from '@/app/composables/useCanvasOperations';
import { useParentFolder } from '@/features/core/folders/composables/useParentFolder';
import { useWorkflowsStore } from '@/app/stores/workflows.store';
import { useWorkflowsListStore } from '@/app/stores/workflowsList.store';
import { useUIStore } from '@/app/stores/ui.store';
import { useNodeTypesStore } from '@/app/stores/nodeTypes.store';
import { useCredentialsStore } from '@/features/credentials/credentials.store';
import { useEnvironmentsStore } from '@/features/settings/environments.ee/environments.store';
import { useExternalSecretsStore } from '@/features/integrations/externalSecrets.ee/externalSecrets.ee.store';
import { useSettingsStore } from '@/app/stores/settings.store';
import { useProjectsStore } from '@/features/collaboration/projects/projects.store';
import { useHistoryStore } from '@/app/stores/history.store';
import { useBuilderStore } from '@/features/ai/assistant/builder.store';
import { EnterpriseEditionFeature, VIEWS } from '@/app/constants';
import type { WorkflowState } from '@/app/composables/useWorkflowState';
import type { IWorkflowDb } from '@/Interface';

export function useWorkflowInitialization(workflowState: WorkflowState) {
	const route = useRoute();
	const router = useRouter();
	const i18n = useI18n();
	const toast = useToast();
	const documentTitle = useDocumentTitle();
	const externalHooks = useExternalHooks();

	const workflowsStore = useWorkflowsStore();
	const workflowsListStore = useWorkflowsListStore();
	const uiStore = useUIStore();
	const nodeTypesStore = useNodeTypesStore();
	const credentialsStore = useCredentialsStore();
	const environmentsStore = useEnvironmentsStore();
	const externalSecretsStore = useExternalSecretsStore();
	const settingsStore = useSettingsStore();
	const projectsStore = useProjectsStore();
	const historyStore = useHistoryStore();
	const builderStore = useBuilderStore();

	const { resetWorkspace, initializeWorkspace, fitView } = useCanvasOperations();
	const { fetchAndSetParentFolder } = useParentFolder();

	const isLoading = ref(true);
	const initializedWorkflowId = ref<string | undefined>();

	const workflowId = computed(() => {
		const name = route.params.name;
		return (Array.isArray(name) ? name[0] : name) ?? '';
	});

	const isNewWorkflowRoute = computed(() => route.query.new === 'true');
	const isDemoRoute = computed(() => route.name === VIEWS.DEMO);
	const isTemplateRoute = computed(() => route.name === VIEWS.TEMPLATE_IMPORT);
	const isOnboardingRoute = computed(() => route.name === VIEWS.WORKFLOW_ONBOARDING);
	const isWorkflowRoute = computed(() => !!route?.meta?.nodeView || isDemoRoute.value);

	async function loadCredentials() {
		let options: { workflowId: string } | { projectId: string };

		if (workflowId.value && !isNewWorkflowRoute.value) {
			options = { workflowId: workflowId.value };
		} else {
			const queryParam =
				typeof route.query?.projectId === 'string' ? route.query?.projectId : undefined;
			const projectId = queryParam ?? projectsStore.personalProject?.id;
			if (projectId === undefined) {
				throw new Error(
					'Could not find projectId in the query nor could I find the personal project in the project store',
				);
			}

			options = { projectId };
		}

		await credentialsStore.fetchAllCredentialsForWorkflow(options);
	}

	async function initializeData() {
		const loadPromises = (() => {
			if (settingsStore.isPreviewMode && isDemoRoute.value) return [];

			const promises: Array<Promise<unknown>> = [
				workflowsListStore.fetchActiveWorkflows(),
				credentialsStore.fetchCredentialTypes(true),
				loadCredentials(),
			];

			if (settingsStore.isEnterpriseFeatureEnabled[EnterpriseEditionFeature.Variables]) {
				promises.push(environmentsStore.fetchAllVariables());
			}

			if (settingsStore.isEnterpriseFeatureEnabled[EnterpriseEditionFeature.ExternalSecrets]) {
				promises.push(externalSecretsStore.fetchGlobalSecrets());
				const shouldFetchProjectSecrets =
					route?.params?.projectId !== projectsStore.personalProject?.id;
				if (shouldFetchProjectSecrets && typeof route?.params?.projectId === 'string') {
					promises.push(externalSecretsStore.fetchProjectSecrets(route.params.projectId));
				}
			}

			return promises;
		})();

		if (nodeTypesStore.allNodeTypes.length === 0) {
			loadPromises.push(nodeTypesStore.getNodeTypes());
		}

		try {
			await Promise.all(loadPromises);
			void nodeTypesStore.fetchCommunityNodePreviews();
		} catch (error) {
			toast.showError(
				error,
				i18n.baseText('nodeView.showError.mounted1.title'),
				i18n.baseText('nodeView.showError.mounted1.message') + ':',
			);
		}
	}

	async function openWorkflow(data: IWorkflowDb) {
		resetWorkspace();

		if (builderStore.streaming) {
			documentTitle.setDocumentTitle(data.name, 'AI_BUILDING');
		} else {
			documentTitle.setDocumentTitle(data.name, 'IDLE');
		}

		await initializeWorkspace(data);

		void externalHooks.run('workflow.open', {
			workflowId: data.id,
			workflowName: data.name,
		});

		fitView();
	}

	async function initializeWorkspaceForNewWorkflow() {
		resetWorkspace();

		const parentFolderId = route.query.parentFolderId as string | undefined;

		await workflowState.getNewWorkflowDataAndMakeShareable(
			undefined,
			projectsStore.currentProjectId,
			parentFolderId,
		);

		workflowState.setWorkflowId(workflowId.value);

		await projectsStore.refreshCurrentProject();
		await fetchAndSetParentFolder(parentFolderId);

		uiStore.nodeViewInitialized = true;
		initializedWorkflowId.value = workflowId.value;

		fitView();
	}

	async function initializeWorkspaceForExistingWorkflow(id: string) {
		try {
			const workflowData = await workflowsListStore.fetchWorkflow(id);

			await openWorkflow(workflowData);

			if (workflowData.parentFolder) {
				workflowsStore.setParentFolder(workflowData.parentFolder);
			}

			await projectsStore.setProjectNavActiveIdByWorkflowHomeProject(
				workflowData.homeProject,
				workflowData.sharedWithProjects,
			);
			void workflowsStore.fetchLastSuccessfulExecution();
		} catch (error) {
			if ((error as { httpStatusCode?: number }).httpStatusCode === 404) {
				return await router.replace({
					name: VIEWS.ENTITY_NOT_FOUND,
					params: { entityType: 'workflow' },
				});
			}
			if ((error as { httpStatusCode?: number }).httpStatusCode === 403) {
				return await router.replace({
					name: VIEWS.ENTITY_UNAUTHORIZED,
					params: { entityType: 'workflow' },
				});
			}

			toast.showError(error, i18n.baseText('openWorkflow.workflowNotFoundError'));
			void router.push({
				name: VIEWS.NEW_WORKFLOW,
			});
		} finally {
			uiStore.nodeViewInitialized = true;
			initializedWorkflowId.value = workflowId.value;
		}
	}

	async function initializeWorkflow(force = false) {
		// Skip if no workflowId (shouldn't happen in WorkflowLayout)
		if (!workflowId.value) {
			isLoading.value = false;
			return;
		}

		// Handle blank redirect (used by template import to prevent double initialization)
		// Also check for templateId in query - this indicates a template import in progress
		// where NodeView's openWorkflowTemplate handles the initialization
		const isTemplateImportInProgress = uiStore.isBlankRedirect || route.query.templateId;
		if (isTemplateImportInProgress) {
			isLoading.value = false;
			return;
		}

		const isAlreadyInitialized =
			!force && initializedWorkflowId.value && initializedWorkflowId.value === workflowId.value;

		if (isAlreadyInitialized) {
			isLoading.value = false;
			return;
		}

		isLoading.value = true;

		try {
			historyStore.reset();

			if (isDemoRoute.value) {
				await initializeWorkspaceForNewWorkflow();
				return;
			}

			if (isNewWorkflowRoute.value) {
				const exists = await workflowsListStore.checkWorkflowExists(workflowId.value);
				if (!exists && route.meta?.nodeView === true) {
					await initializeWorkspaceForNewWorkflow();
					return;
				} else {
					await router.replace({
						...route,
						query: {
							...route.query,
							new: undefined,
						},
					});
				}
			}

			await initializeWorkspaceForExistingWorkflow(workflowId.value);
		} finally {
			isLoading.value = false;
		}
	}

	function cleanup() {
		resetWorkspace();
		uiStore.nodeViewInitialized = false;
	}

	return {
		isLoading,
		initializedWorkflowId,
		workflowId,
		isNewWorkflowRoute,
		isDemoRoute,
		isTemplateRoute,
		isOnboardingRoute,
		isWorkflowRoute,
		loadCredentials,
		initializeData,
		openWorkflow,
		initializeWorkspaceForNewWorkflow,
		initializeWorkspaceForExistingWorkflow,
		initializeWorkflow,
		cleanup,
	};
}
