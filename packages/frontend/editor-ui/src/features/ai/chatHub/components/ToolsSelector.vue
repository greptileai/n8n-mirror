<script setup lang="ts">
import NodeIcon from '@/app/components/NodeIcon.vue';
import { useNodeTypesStore } from '@/app/stores/nodeTypes.store';
import { computed, onMounted } from 'vue';
import { type DropdownMenuItemProps, N8nButton, N8nDropdownMenu } from '@n8n/design-system';
import type { INode, INodeTypeDescription } from 'n8n-workflow';
import { useI18n } from '@n8n/i18n';
import { useUIStore } from '@/app/stores/ui.store';
import { TOOL_SETTINGS_MODAL_KEY, TOOLS_MANAGER_MODAL_KEY } from '@/features/ai/chatHub/constants';

const { selected, transparentBg = false } = defineProps<{
	disabled: boolean;
	selected: INode[];
	transparentBg?: boolean;
	disabledTooltip?: string;
}>();

const emit = defineEmits<{
	change: [tools: INode[]];
}>();

const nodeTypesStore = useNodeTypesStore();
const uiStore = useUIStore();
const i18n = useI18n();

const toolCount = computed(() => selected.length);

const displayToolNodeTypes = computed(() => {
	return selected
		.slice(0, 3)
		.map((t) => nodeTypesStore.getNodeType(t.type))
		.filter(Boolean);
});

const toolsLabel = computed(() => {
	if (toolCount.value > 0) {
		return i18n.baseText('chatHub.tools.selector.label.count', { adjustToNumber: toolCount.value });
	}
	return i18n.baseText('chatHub.tools.selector.label.default');
});

function openToolsManager() {
	uiStore.openModalWithData({
		name: TOOLS_MANAGER_MODAL_KEY,
		data: {
			tools: selected,
			onConfirm: (tools: INode[]) => {
				emit('change', tools);
			},
		},
	});
}

const menuItems = computed<Array<DropdownMenuItemProps<string, INodeTypeDescription>>>(() => [
	...selected.map((sel) => ({
		id: `selected::${sel.id}`,
		label: sel.name,
		checked: true,
		data: nodeTypesStore.getNodeType(sel.type, sel.typeVersion) ?? undefined,
		children: [
			{
				id: `configure::${sel.id}`,
				label: i18n.baseText('chatHub.toolsManager.configure'),
				icon: { type: 'icon' as const, value: 'settings' as const },
			},
			{
				id: `remove::${sel.id}`,
				label: i18n.baseText('chatHub.toolsManager.remove'),
				icon: { type: 'icon' as const, value: 'trash-2' as const },
			},
		],
	})),
	{
		id: 'manage',
		label: i18n.baseText('chatHub.toolsManager.manageTools'),
		divided: true,
		icon: { type: 'icon', value: 'settings' },
	},
]);

function handleSelect(id: string) {
	const [command, target] = id.split('::');

	if (command === 'manage') {
		openToolsManager();
		return;
	}

	const targetNode = selected.find((sel) => sel.id === target);

	if (!targetNode) {
		return;
	}

	if (command === 'remove') {
		emit(
			'change',
			selected.filter((s) => s.id !== targetNode.id),
		);
	}

	if (command === 'configure') {
		const otherToolNames = selected.filter((s) => s.id !== targetNode.id).map((s) => s.name);

		uiStore.openModalWithData({
			name: TOOL_SETTINGS_MODAL_KEY,
			data: {
				node: targetNode,
				existingToolNames: otherToolNames,
				onConfirm: (configuredNode: INode) => {
					emit(
						'change',
						selected.map((sel) => (sel.id === targetNode.id ? configuredNode : sel)),
					);
				},
			},
		});
	}
}

onMounted(async () => {
	await nodeTypesStore.loadNodeTypesIfNotLoaded();
});

/**
 * TODO
 * - tooltip doesn't work well with dropdown
 * - for personal agent, click to open edit modal as before
 */
</script>

<template>
	<!-- <N8nTooltip :content="disabledTooltip" :disabled="!disabledTooltip" placement="top"> -->
	<div :class="$style.container">
		<N8nDropdownMenu
			:items="menuItems"
			placement="bottom-start"
			:disabled="selected.length === 0"
			extra-popper-class="tools-selector-dropdown"
			@select="handleSelect"
		>
			<template #trigger>
				<N8nButton
					type="secondary"
					native-type="button"
					:class="[$style.toolsButton, { [$style.transparentBg]: transparentBg }]"
					:disabled="disabled"
					:icon="toolCount > 0 ? undefined : 'plus'"
					@click="selected.length === 0 ? openToolsManager() : undefined"
				>
					<span v-if="toolCount" :class="$style.iconStack">
						<NodeIcon
							v-for="(nodeType, i) in displayToolNodeTypes"
							:key="`${nodeType?.name}-${i}`"
							:style="{ zIndex: displayToolNodeTypes.length - i }"
							:node-type="nodeType"
							:class="[$style.icon, { [$style.iconOverlap]: i !== 0 }]"
							:circle="true"
							:size="12"
						/>
					</span>
					{{ toolsLabel }}
				</N8nButton>
			</template>

			<template #item-leading="{ item }">
				<NodeIcon v-if="item.data" :node-type="item.data" :size="16" />
			</template>
		</N8nDropdownMenu>
	</div>
</template>

<style lang="scss" module>
.container {
	display: flex;
	align-items: center;
}

.toolsButton {
	display: flex;
	align-items: center;
	gap: var(--spacing--2xs);

	&.transparentBg {
		background-color: transparent !important;
	}
}

.iconStack {
	display: flex;
	align-items: center;
	position: relative;

	/* maintain component height regardless of icon */
	margin-block: -4px;
}

.icon {
	padding: var(--spacing--4xs);
	background-color: var(--color--background--light-2);
	border-radius: 50%;
	outline: 2px var(--color--background--light-3) solid;
}

.iconOverlap {
	margin-left: -6px;
}
</style>

<style lang="scss">
.tools-selector-dropdown {
	z-index: 10000;
}
</style>
