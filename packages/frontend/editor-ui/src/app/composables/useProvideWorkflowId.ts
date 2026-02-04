import { provide, computed, type ComputedRef } from 'vue';
import { useRoute } from 'vue-router';
import { WorkflowIdKey } from '@/app/constants/injectionKeys';

export function useProvideWorkflowId(): ComputedRef<string> {
	const route = useRoute();
	const workflowId = computed(() => {
		// Only workflow routes (layout: 'workflow') have the :name param for workflow ID
		if (route.meta?.layout !== 'workflow') return '';
		const name = route.params.name;
		if (!name) return '';
		return Array.isArray(name) ? name[0] : name;
	});
	provide(WorkflowIdKey, workflowId);
	return workflowId;
}
