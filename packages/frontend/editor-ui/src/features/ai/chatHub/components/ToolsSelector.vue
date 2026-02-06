<script setup lang="ts">
import NodeIcon from '@/app/components/NodeIcon.vue';
import { useNodeTypesStore } from '@/app/stores/nodeTypes.store';
import { computed, onMounted, ref } from 'vue';
import { N8nButton, N8nDropdownMenu, N8nIconButton } from '@n8n/design-system';
import type { DropdownMenuItemProps } from '@n8n/design-system';
import type { INode, INodeTypeDescription } from 'n8n-workflow';
import { useI18n } from '@n8n/i18n';
import { useUIStore } from '@/app/stores/ui.store';
import { useToast } from '@/app/composables/useToast';
import { TOOLS_MANAGER_MODAL_KEY } from '@/features/ai/chatHub/constants';
import { useChatStore } from '@/features/ai/chatHub/chat.store';

const { selected, transparentBg = false } = defineProps<{
	disabled: boolean;
	selected: INode[];
	transparentBg?: boolean;
	disabledTooltip?: string;
}>();

const nodeTypesStore = useNodeTypesStore();
const uiStore = useUIStore();
const chatStore = useChatStore();
const toast = useToast();
const i18n = useI18n();

const searchQuery = ref('');

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
			onConfirm: () => {},
		},
	});
}

type ToolMenuItem = DropdownMenuItemProps<
	string,
	{ nodeType: INodeTypeDescription | null; tool: INode }
>;

const menuItems = computed<ToolMenuItem[]>(() => {
	const query = searchQuery.value.toLowerCase();

	return chatStore.configuredTools
		.filter((tool) => {
			if (!query) return true;
			const def = tool.definition;
			const nodeType = nodeTypesStore.getNodeType(def.type, def.typeVersion);
			const nameMatch = def.name.toLowerCase().includes(query);
			const typeMatch = nodeType?.displayName.toLowerCase().includes(query);
			return nameMatch || typeMatch;
		})
		.map((tool) => ({
			id: `tool::${tool.definition.id}`,
			label: tool.definition.name,
			checked: tool.enabled,
			data: {
				nodeType: nodeTypesStore.getNodeType(tool.definition.type, tool.definition.typeVersion),
				tool: tool.definition,
			},
		}));
});

async function handleSelect(id: string) {
	const [command, toolId] = id.split('::');

	if (command === 'tool') {
		const tool = chatStore.configuredTools.find((t) => t.definition.id === toolId);
		if (tool) {
			try {
				await chatStore.toggleToolEnabled(toolId, !tool.enabled);
			} catch (error) {
				toast.showError(error, i18n.baseText('chatHub.error.updateToolsFailed'));
			}
		}
	}
}

function handleSearch(query: string) {
	searchQuery.value = query;
}

onMounted(async () => {
	await nodeTypesStore.loadNodeTypesIfNotLoaded();
});
</script>

<template>
	<div :class="$style.container">
		<!-- When no tools configured, show just the button that opens the manager -->
		<N8nButton
			v-if="chatStore.configuredTools.length === 0"
			type="secondary"
			native-type="button"
			:class="[$style.toolsButton, { [$style.transparentBg]: transparentBg }]"
			:disabled="disabled"
			icon="plus"
			@click="openToolsManager"
		>
			{{ toolsLabel }}
		</N8nButton>

		<!-- When tools are selected, show the dropdown -->
		<N8nDropdownMenu
			v-else
			:items="menuItems"
			placement="bottom-start"
			extra-popper-class="tools-selector-dropdown"
			searchable
			:search-placeholder="i18n.baseText('chatHub.toolsManager.searchPlaceholder')"
			:empty-text="i18n.baseText('chatHub.toolsManager.noResults')"
			@select="handleSelect"
			@search="handleSearch"
		>
			<template #trigger>
				<N8nButton
					type="secondary"
					native-type="button"
					:class="[$style.toolsButton, { [$style.transparentBg]: transparentBg }]"
					:disabled="disabled"
				>
					<span :class="$style.iconStack">
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

			<template #search-suffix>
				<N8nIconButton
					icon="settings"
					type="tertiary"
					size="medium"
					text
					:class="$style.settingsButton"
					@click.stop="openToolsManager"
				/>
			</template>

			<template #item-leading="{ item }">
				<NodeIcon v-if="item.data?.nodeType" :node-type="item.data.nodeType" :size="16" />
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

.settingsButton {
	color: var(--button--color--text--secondary);
	margin-right: -2px;

	&:hover {
		color: var(--button--color--text--secondary--hover-active-focus);
	}
}
</style>

<style lang="scss">
.tools-selector-dropdown {
	z-index: 10000;
	min-width: 220px;
}
</style>
