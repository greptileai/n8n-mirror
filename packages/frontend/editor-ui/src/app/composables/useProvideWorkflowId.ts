import { provide, computed, type ComputedRef } from 'vue';
import { useRoute } from 'vue-router';
import { WorkflowIdKey } from '@/app/constants/injectionKeys';

export function useProvideWorkflowId(): ComputedRef<string | undefined> {
	const route = useRoute();
	const workflowId = computed(() => {
		const name = route.params.name;
		return Array.isArray(name) ? name[0] : name;
	});
	provide(WorkflowIdKey, workflowId);
	return workflowId;
}
