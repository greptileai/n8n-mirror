<script setup lang="ts">
import { useWorkflowSetupState } from '@/features/setupPanel/composables/useWorkflowSetupState';
import NodeSetupCard from './NodeSetupCard.vue';

const { nodeSetupStates, isAllComplete, setCredential, unsetCredential } = useWorkflowSetupState();

const onCredentialSelected = (
	nodeName: string,
	payload: { credentialType: string; credentialId: string },
) => {
	setCredential(nodeName, payload.credentialType, payload.credentialId);
};

const onCredentialDeselected = (nodeName: string, credentialType: string) => {
	unsetCredential(nodeName, credentialType);
};

const onTestNode = (_nodeName: string) => {
	// TODO: Implement node execution
};
</script>

<template>
	<div :class="$style.container">
		<NodeSetupCard
			v-for="state in nodeSetupStates"
			:key="state.node.id"
			:state="state"
			@credential-selected="onCredentialSelected(state.node.name, $event)"
			@credential-deselected="onCredentialDeselected(state.node.name, $event)"
			@test-node="onTestNode(state.node.name)"
		/>
		<div v-if="isAllComplete && nodeSetupStates.length > 0" :class="$style.completeMessage">
			All credentials are configured!
		</div>
		<div v-if="nodeSetupStates.length === 0" :class="$style.emptyMessage">
			No credentials need to be configured.
		</div>
	</div>
</template>

<style module lang="scss">
.container {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--sm);
}

.completeMessage,
.emptyMessage {
	text-align: center;
	color: var(--color--text--tint-1);
	font-size: var(--font-size--sm);
	padding: var(--spacing--sm);
}
</style>
