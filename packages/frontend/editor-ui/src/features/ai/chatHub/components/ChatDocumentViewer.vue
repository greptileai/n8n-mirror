<script setup lang="ts">
import { computed, useTemplateRef, type ComponentPublicInstance } from 'vue';
import { N8nText } from '@n8n/design-system';
import ChatMarkdownChunk from './ChatMarkdownChunk.vue';
import type { ChatDocument } from '@n8n/api-types';
import CopyButton from './CopyButton.vue';

const props = defineProps<{
	document: ChatDocument;
}>();

const isHtmlDocument = computed(() => props.document.type === 'html');
const isMarkdownDocument = computed(() => props.document.type === 'md');
const chunkRef = useTemplateRef<ComponentPublicInstance<{
	hoveredCodeBlockActions: HTMLElement | null;
	getHoveredCodeBlockContent: () => string | undefined;
}> | null>('markdownChunk');
const activeCodeBlockTeleport = computed<{
	target: HTMLElement;
	content: string;
} | null>(() => {
	if (chunkRef.value?.hoveredCodeBlockActions) {
		const content = chunkRef.value.getHoveredCodeBlockContent();
		if (content) {
			return { target: chunkRef.value.hoveredCodeBlockActions, content };
		}
	}
	return null;
});
</script>

<template>
	<div :class="$style.container">
		<div :class="$style.viewer">
			<div :class="$style.header">
				<N8nText :class="$style.title" tag="h3" bold>{{ document.title }}</N8nText>
			</div>

			<div :class="$style.content">
				<iframe
					v-if="isHtmlDocument"
					:srcdoc="document.content"
					:class="$style.iframe"
					sandbox=""
					:title="document.title"
				/>

				<ChatMarkdownChunk
					v-else
					ref="markdownChunk"
					:class="isMarkdownDocument ? $style.md : ''"
					:single-pre="!isMarkdownDocument"
					:source="
						isMarkdownDocument
							? document.content
							: `\`\`\`${document.type}\n${document.content}\n\`\`\``
					"
				/>
			</div>
		</div>
		<Teleport v-if="activeCodeBlockTeleport" :to="activeCodeBlockTeleport.target">
			<CopyButton :content="activeCodeBlockTeleport.content" />
		</Teleport>
	</div>
</template>

<style lang="scss" module>
.container {
	height: 100%;
	display: flex;
	flex-direction: column;
	background-color: var(--color--background--light-2);
	border-left: var(--border-width) var(--border-style) var(--color--foreground);
}

.viewer {
	display: flex;
	flex-direction: column;
	height: 100%;
	overflow: hidden;
}

.header {
	display: flex;
	align-items: center;
	gap: var(--spacing--4xs);
	padding-inline: var(--spacing--sm);
	height: 56px;
	flex-grow: 0;
	flex-shrink: 0;
	border-bottom: var(--border);
}

.md {
	padding-inline: var(--spacing--sm);
}

.title {
	flex-grow: 1;
	flex-shrink: 1;
	color: var(--color--text);
}

.type {
	text-transform: uppercase;
	letter-spacing: 0.05em;
}

.content {
	flex: 1;
	overflow-x: hidden;
}

.iframe {
	width: 100%;
	height: 100%;
	border: none;
	background-color: var(--color--background);
}
</style>
