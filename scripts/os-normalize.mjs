#!/usr/bin/env node

/**
 * Created to ease the running of binaries on cross-platform teams.
 * Enabled writing startup scripts once, but defaulting to platform specific runners.
 *
 * Usage: node scripts/os-normalize.mjs --dir packages/cli/bin n8n
 * Usage (with args): node scripts/os-normalize.mjs --dir packages/cli/bin -- n8n --help
 * */

import { $, argv, cd, chalk, echo, fs } from 'zx';

/**
 * @type { string } baseName
 * */
function normalizeCommand(baseName) {
	const isWindows = process.platform === 'win32';
	if (!isWindows) {
		// On mac/linux, run local executable
		return `./${baseName}`;
	}

	// On Windows, prefer .cmd then .exe, then bare name
	const candidates = [`${baseName}.cmd`, `${baseName}.exe`, baseName];
	const found = candidates.find((c) => fs.existsSync(c));
	return found ?? `${baseName}.cmd`; // last resort: try .cmd anyway
}

function printUsage() {
	echo(chalk.red('Usage: node scripts/os-normalize.mjs --dir <dir> <run>'));
	echo(
		chalk.red('Usage (with args): node scripts/os-normalize.mjs --dir <dir> -- <run> [args...]'),
	);
}

const { dir = '.' } = argv;
const [run, ...args] = argv._;

if (!dir || !run) {
	printUsage();
	process.exit(2);
}

cd(dir ?? '.');

const cmd = normalizeCommand(run);

if (run) {
	echo(chalk.cyan(`$ Running (dir: ${dir}) ${cmd} ${args.join(' ')}`));
	await $({ stdio: 'inherit' })`${cmd} ${args}`;
} else {
	echo(chalk.red('No runnable command provided.'));
	echo('\n');
	printUsage();
}
