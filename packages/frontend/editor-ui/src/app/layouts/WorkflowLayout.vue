<script lang="ts" setup>
import { provide, watch, onMounted, onBeforeUnmount } from 'vue';
import BaseLayout from './BaseLayout.vue';
import { useLayoutProps } from '@/app/composables/useLayoutProps';
import { useWorkflowState } from '@/app/composables/useWorkflowState';
import { useWorkflowInitialization } from '@/app/composables/useWorkflowInitialization';
import AskAssistantFloatingButton from '@/features/ai/assistant/components/Chat/AskAssistantFloatingButton.vue';
import { useAssistantStore } from '@/features/ai/assistant/assistant.store';
import AppHeader from '@/app/components/app/AppHeader.vue';
import AppSidebar from '@/app/components/app/AppSidebar.vue';
import LogsPanel from '@/features/execution/logs/components/LogsPanel.vue';
import LoadingView from '@/app/views/LoadingView.vue';
import { WorkflowIdKey, WorkflowStateKey } from '@/app/constants/injectionKeys';

const { layoutProps } = useLayoutProps();
const assistantStore = useAssistantStore();

const workflowState = useWorkflowState();
provide(WorkflowStateKey, workflowState);

const {
	isLoading,
	workflowId,
	isTemplateRoute,
	isOnboardingRoute,
	initializeData,
	initializeWorkflow,
	cleanup,
} = useWorkflowInitialization(workflowState);

provide(WorkflowIdKey, workflowId);

onMounted(async () => {
	await initializeData();
	await initializeWorkflow();
});

watch(
	workflowId,
	async (newId, oldId) => {
		if (isTemplateRoute.value || isOnboardingRoute.value) return;
		if (newId !== oldId && newId) {
			await initializeWorkflow(true);
		}
	},
	{ flush: 'post' },
);

onBeforeUnmount(() => cleanup());
</script>

<template>
	<BaseLayout>
		<template #header>
			<AppHeader />
		</template>
		<template #sidebar>
			<AppSidebar />
		</template>
		<LoadingView v-if="isLoading" />
		<RouterView v-else />
		<template v-if="layoutProps.logs" #footer>
			<LogsPanel />
		</template>
		<template #overlays>
			<AskAssistantFloatingButton v-if="assistantStore.isFloatingButtonShown" />
		</template>
	</BaseLayout>
</template>
