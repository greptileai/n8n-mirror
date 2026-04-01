import { readFile, writeFile } from 'fs/promises';
import * as path from 'path';

/**
 * Updates packages/nodes-base/package.json to register new nodes and credentials.
 */
export async function updatePackageJson(
	nodesBaseDir: string,
	nodeDistPaths: string[],
	credentialDistPaths: string[],
): Promise<void> {
	const packageJsonPath = path.join(nodesBaseDir, 'package.json');
	const content = await readFile(packageJsonPath, 'utf-8');
	const pkg = JSON.parse(content) as {
		n8n: {
			nodes: string[];
			credentials: string[];
		};
		[key: string]: unknown;
	};

	let modified = false;

	for (const nodePath of nodeDistPaths) {
		if (!pkg.n8n.nodes.includes(nodePath)) {
			pkg.n8n.nodes.push(nodePath);
			modified = true;
		}
	}

	for (const credPath of credentialDistPaths) {
		if (!pkg.n8n.credentials.includes(credPath)) {
			pkg.n8n.credentials.push(credPath);
			modified = true;
		}
	}

	if (modified) {
		pkg.n8n.nodes.sort();
		pkg.n8n.credentials.sort();
		await writeFile(packageJsonPath, JSON.stringify(pkg, null, '\t') + '\n');
	}
}
