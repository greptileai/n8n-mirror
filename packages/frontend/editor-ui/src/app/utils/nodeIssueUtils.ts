import { NodeHelpers } from 'n8n-workflow';
import type {
	INodeCredentialDescription,
	INodeParameters,
	INodeProperties,
	INodeTypeDescription,
} from 'n8n-workflow';
import type { INodeUi } from '@/Interface';

export function hasProxyAuth(node: INodeUi): boolean {
	return Object.keys(node.parameters).includes('nodeCredentialType');
}

/**
 * Returns if the given parameter should be displayed or not
 */
export function displayParameter(
	nodeValues: INodeParameters,
	parameter: INodeProperties | INodeCredentialDescription,
	path: string,
	node: INodeUi | null,
	nodeTypeDescription: INodeTypeDescription | null,
	displayKey: 'displayOptions' | 'disabledOptions' = 'displayOptions',
) {
	return NodeHelpers.displayParameterPath(
		nodeValues,
		parameter,
		path,
		node,
		nodeTypeDescription,
		displayKey,
	);
}
