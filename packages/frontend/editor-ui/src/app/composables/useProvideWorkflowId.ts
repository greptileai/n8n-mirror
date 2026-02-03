import { computed, provide } from 'vue';
import { useRoute } from 'vue-router';
import { WorkflowIdKey } from '@/app/constants';

/**
 * Provides WorkflowIdKey to descendant components.
 * Derives the workflow ID from route.params.name.
 */
export function useProvideWorkflowId() {
	const route = useRoute();

	const workflowId = computed(() => {
		const name = route.params.name;
		return (Array.isArray(name) ? name[0] : name) as string;
	});

	provide(WorkflowIdKey, workflowId);

	return { workflowId };
}
