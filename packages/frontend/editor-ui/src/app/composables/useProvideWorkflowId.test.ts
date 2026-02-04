import { mount } from '@vue/test-utils';
import { defineComponent, h, inject } from 'vue';
import { useProvideWorkflowId } from './useProvideWorkflowId';
import { WorkflowIdKey } from '@/app/constants/injectionKeys';

const mockRoute: { params: { name?: string | string[] }; meta: { layout?: string } } = {
	params: { name: 'test-workflow-id' },
	meta: { layout: 'workflow' },
};

vi.mock('vue-router', () => ({
	useRoute: () => mockRoute,
}));

describe('useProvideWorkflowId', () => {
	beforeEach(() => {
		mockRoute.params = { name: 'test-workflow-id' };
		mockRoute.meta = { layout: 'workflow' };
	});

	it('should provide workflow ID from route params on workflow routes', () => {
		const ChildComponent = defineComponent({
			setup() {
				const workflowId = inject(WorkflowIdKey);
				return () => h('div', workflowId?.value);
			},
		});

		const ParentComponent = defineComponent({
			setup() {
				useProvideWorkflowId();
				return () => h('div', [h(ChildComponent)]);
			},
		});

		const wrapper = mount(ParentComponent);
		expect(wrapper.text()).toBe('test-workflow-id');
	});

	it('should return the workflow ID as a computed ref', () => {
		const TestComponent = defineComponent({
			setup() {
				const workflowId = useProvideWorkflowId();
				return () => h('div', workflowId.value);
			},
		});

		const wrapper = mount(TestComponent);
		expect(wrapper.text()).toBe('test-workflow-id');
	});

	it('should handle array route params by using the first value', () => {
		mockRoute.params = { name: ['first-id', 'second-id'] };

		const TestComponent = defineComponent({
			setup() {
				const workflowId = useProvideWorkflowId();
				return () => h('div', workflowId.value ?? 'undefined');
			},
		});

		const wrapper = mount(TestComponent);
		expect(wrapper.text()).toBe('first-id');
	});

	it('should return empty string when route has no name param', () => {
		mockRoute.params = {};

		const TestComponent = defineComponent({
			setup() {
				const workflowId = useProvideWorkflowId();
				return () => h('div', `[${workflowId.value}]`);
			},
		});

		const wrapper = mount(TestComponent);
		expect(wrapper.text()).toBe('[]');
	});

	it('should return empty string when not on a workflow route', () => {
		mockRoute.params = { name: 'some-id' };
		mockRoute.meta = { layout: 'settings' };

		const TestComponent = defineComponent({
			setup() {
				const workflowId = useProvideWorkflowId();
				return () => h('div', `[${workflowId.value}]`);
			},
		});

		const wrapper = mount(TestComponent);
		expect(wrapper.text()).toBe('[]');
	});

	it('should return empty string when route has no layout meta', () => {
		mockRoute.params = { name: 'some-id' };
		mockRoute.meta = {};

		const TestComponent = defineComponent({
			setup() {
				const workflowId = useProvideWorkflowId();
				return () => h('div', `[${workflowId.value}]`);
			},
		});

		const wrapper = mount(TestComponent);
		expect(wrapper.text()).toBe('[]');
	});
});
