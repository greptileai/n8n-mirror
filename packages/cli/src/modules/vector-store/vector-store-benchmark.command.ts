import { Command } from '@n8n/decorators';
import { Container } from '@n8n/di';
import { nanoid } from 'nanoid';
import z from 'zod';

import type { VectorStoreDataRepository } from './vector-store-data.repository';

import { BaseCommand } from '@/commands/base-command';

const flagsSchema = z.object({
	'num-vectors': z
		.number()
		.int()
		.default(1000)
		.describe('Number of vectors to use for benchmarking'),
	'vector-dimension': z
		.number()
		.int()
		.default(1536)
		.describe('Dimension of the vectors (e.g., 1536 for OpenAI embeddings)'),
	'batch-size': z.number().int().default(100).describe('Number of vectors to add in each batch'),
	'search-k': z.number().int().default(5).describe('Number of results to return per search'),
	'num-tables': z.number().int().default(1).describe('Number of tables to create for benchmarking'),
	'random-access-count': z
		.number()
		.int()
		.default(100)
		.describe('Number of random table accesses to perform'),
	iterations: z.number().int().default(3).describe('Number of iterations to run for averaging'),
	'insertion-query-interval': z
		.number()
		.int()
		.default(0)
		.describe('Interval in seconds to wait between insertion and query operations'),
	'max-insertions-per-sec': z
		.number()
		.int()
		.default(0)
		.describe('Maximum insertions per second (0 = unlimited)'),
	'max-queries-per-sec': z
		.number()
		.int()
		.default(0)
		.describe('Maximum queries per second (0 = unlimited)'),
});

interface BenchmarkResults {
	operation: string;
	totalTime: number;
	avgTime: number;
	throughput?: number;
	unit?: string;
}

@Command({
	name: 'vector-store:benchmark',
	description: 'Benchmark LanceDB vector store operations',
	examples: [
		'',
		'--num-vectors=5000 --vector-dimension=768',
		'--batch-size=500 --num-tables=10',
		'--num-tables=10 --random-access-count=1000',
		'--iterations=5',
		'--insertion-query-interval=30',
		'--max-insertions-per-sec=100 --max-queries-per-sec=50',
	],
	flagsSchema,
})
export class VectorStoreBenchmark extends BaseCommand<z.infer<typeof flagsSchema>> {
	private tableIdentifiers: Array<{ memoryKey: string; projectId: string }> = [];

	async run() {
		const { flags } = this;

		this.log('Starting LanceDB benchmark...');
		this.log('Configuration:');
		this.log(`  Vectors: ${flags['num-vectors']}`);
		this.log(`  Dimension: ${flags['vector-dimension']}`);
		this.log(`  Batch size: ${flags['batch-size']}`);
		this.log(`  Results per search (k): ${flags['search-k']}`);
		this.log(`  Tables: ${flags['num-tables']}`);
		this.log(`  Random accesses: ${flags['random-access-count']}`);
		this.log(`  Iterations: ${flags.iterations}`);
		this.log(`  Insertion-Query Interval: ${flags['insertion-query-interval']}s`);
		this.log(`  Max Insertions/sec: ${flags['max-insertions-per-sec'] || 'unlimited'}`);
		this.log(`  Max Queries/sec: ${flags['max-queries-per-sec'] || 'unlimited'}`);
		this.log('');

		// Get the repository
		const { VectorStoreDataRepository } = await import('./vector-store-data.repository');
		const repository = Container.get(VectorStoreDataRepository);

		const results: BenchmarkResults[] = [];

		try {
			// Generate table identifiers
			this.tableIdentifiers = this.generateTableIdentifiers(flags['num-tables']);

			// Run benchmark iterations
			for (let iteration = 1; iteration <= flags.iterations; iteration++) {
				this.log(`\nIteration ${iteration}/${flags.iterations}`);
				this.log('='.repeat(50));

				// First, populate all tables with data
				const insertionResults = await this.populateTables(
					repository,
					flags['num-vectors'],
					flags['vector-dimension'],
					flags['batch-size'],
					flags['max-insertions-per-sec'],
				);
				results.push(insertionResults);

				// Wait interval between insertion and query operations
				if (flags['insertion-query-interval'] > 0) {
					this.log(
						`\nWaiting ${flags['insertion-query-interval']} seconds before query operations...`,
					);
					await this.sleep(flags['insertion-query-interval'] * 1000);
					this.log('Resuming benchmark...');
				}

				// Then benchmark random access
				const queryResults = await this.benchmarkRandomTableAccess(
					repository,
					flags['vector-dimension'],
					flags['random-access-count'],
					flags['search-k'],
					flags['max-queries-per-sec'],
				);
				results.push(queryResults);

				// Clear all tables after each iteration
				for (const table of this.tableIdentifiers) {
					await repository.clearStore(table.memoryKey, table.projectId);
				}
			}

			// Calculate and display aggregate results
			this.displayAggregateResults(results, flags.iterations);
		} finally {
			// Cleanup
			await this.cleanup(repository);
		}
	}

	private async benchmarkRandomTableAccess(
		repository: VectorStoreDataRepository,
		dimension: number,
		accessCount: number,
		k: number,
		maxQueriesPerSec: number,
	): Promise<BenchmarkResults> {
		const rateLimitMessage =
			maxQueriesPerSec > 0 ? ` (rate limited to ${maxQueriesPerSec} queries/sec)` : '';
		this.log(
			`\nBenchmark: Random table access (${accessCount} accesses across ${this.tableIdentifiers.length} tables)${rateLimitMessage}`,
		);

		const startTime = performance.now();
		const minDelayMs = maxQueriesPerSec > 0 ? 1000 / maxQueriesPerSec : 0;
		let lastOperationTime = startTime;

		for (let i = 0; i < accessCount; i++) {
			// Rate limiting: wait if needed to maintain the desired rate
			if (maxQueriesPerSec > 0) {
				const now = performance.now();
				const timeSinceLastOp = now - lastOperationTime;
				if (timeSinceLastOp < minDelayMs) {
					await this.sleep(minDelayMs - timeSinceLastOp);
				}
			}

			// Randomly select a table
			const randomTable =
				this.tableIdentifiers[Math.floor(Math.random() * this.tableIdentifiers.length)];
			const queryEmbedding = this.generateRandomEmbedding(dimension);

			// Perform similarity search on random table
			await repository.similaritySearch(
				randomTable.memoryKey,
				randomTable.projectId,
				queryEmbedding,
				k,
			);
		}

		const endTime = performance.now();
		const totalTime = endTime - startTime;
		const avgTime = totalTime / accessCount;
		const throughput = (accessCount / totalTime) * 1000; // accesses per second

		this.log(`  Total time: ${totalTime.toFixed(2)}ms`);
		this.log(`  Avg per access: ${avgTime.toFixed(2)}ms`);
		this.log(`  Throughput: ${throughput.toFixed(1)} accesses/sec`);

		return {
			operation: 'random_table_access',
			totalTime,
			avgTime,
			throughput,
			unit: 'accesses/sec',
		};
	}

	private async populateTables(
		repository: VectorStoreDataRepository,
		numVectors: number,
		dimension: number,
		batchSize: number,
		maxInsertionsPerSec: number,
	): Promise<BenchmarkResults> {
		const rateLimitMessage =
			maxInsertionsPerSec > 0 ? ` (rate limited to ${maxInsertionsPerSec} vectors/sec)` : '';
		this.log(
			`\nBenchmark: Populating ${this.tableIdentifiers.length} tables with ${numVectors} vectors (${dimension}d) each...${rateLimitMessage}`,
		);

		const startTime = performance.now();
		let totalVectorsAdded = 0;

		for (let tableIdx = 0; tableIdx < this.tableIdentifiers.length; tableIdx++) {
			const table = this.tableIdentifiers[tableIdx];

			for (let i = 0; i < numVectors; i += batchSize) {
				const currentBatchSize = Math.min(batchSize, numVectors - i);

				// Rate limiting: wait if needed to maintain the desired rate
				if (maxInsertionsPerSec > 0 && totalVectorsAdded > 0) {
					const now = performance.now();
					const elapsedSec = (now - startTime) / 1000;
					const expectedVectors = elapsedSec * maxInsertionsPerSec;
					if (totalVectorsAdded > expectedVectors) {
						const delayMs = ((totalVectorsAdded - expectedVectors) / maxInsertionsPerSec) * 1000;
						await this.sleep(delayMs);
					}
				}

				const documents = this.generateTestDocuments(currentBatchSize);
				const embeddings = this.generateRandomEmbeddings(currentBatchSize, dimension);

				await repository.addVectors(table.memoryKey, table.projectId, documents, embeddings, false);
				totalVectorsAdded += currentBatchSize;
			}

			this.log(`  Table ${tableIdx + 1}/${this.tableIdentifiers.length} populated`);
		}

		const endTime = performance.now();
		const totalTime = endTime - startTime;
		const throughput = (totalVectorsAdded / totalTime) * 1000; // vectors per second

		this.log(`  Total time: ${totalTime.toFixed(2)}ms`);
		this.log(`  Total vectors: ${totalVectorsAdded}`);
		this.log(`  Throughput: ${throughput.toFixed(0)} vectors/sec`);

		return {
			operation: 'populate_tables',
			totalTime,
			avgTime: totalTime / this.tableIdentifiers.length,
			throughput,
			unit: 'vectors/sec',
		};
	}

	private displayAggregateResults(results: BenchmarkResults[], iterations: number) {
		this.log('\n');
		this.log('='.repeat(50));
		this.log('AGGREGATE RESULTS');
		this.log('='.repeat(50));

		// Group results by operation
		const grouped = new Map<string, BenchmarkResults[]>();
		for (const result of results) {
			if (!grouped.has(result.operation)) {
				grouped.set(result.operation, []);
			}
			grouped.get(result.operation)!.push(result);
		}

		// Calculate and display averages
		for (const [operation, operationResults] of grouped.entries()) {
			const avgTotalTime = operationResults.reduce((sum, r) => sum + r.totalTime, 0) / iterations;
			const avgAvgTime = operationResults.reduce((sum, r) => sum + r.avgTime, 0) / iterations;

			this.log(`\n${operation.toUpperCase().replace(/_/g, ' ')}`);
			this.log(`  Avg total time: ${avgTotalTime.toFixed(2)}ms`);

			if (operationResults[0].throughput !== undefined) {
				const avgThroughput =
					operationResults.reduce((sum, r) => sum + (r.throughput ?? 0), 0) / iterations;
				this.log(`  Avg throughput: ${avgThroughput.toFixed(1)} ${operationResults[0].unit}`);
			}

			if (operation === 'populate_tables') {
				this.log(`  Avg per table: ${avgAvgTime.toFixed(2)}ms`);
			}

			if (operation === 'random_table_access') {
				this.log(`  Avg per access: ${avgAvgTime.toFixed(2)}ms`);
			}
		}

		this.log('\n' + '='.repeat(50));
	}

	private async cleanup(repository: VectorStoreDataRepository) {
		this.log('\nCleaning up test data...');
		try {
			// Clean up all tables
			for (const table of this.tableIdentifiers) {
				await repository.deleteStore(table.memoryKey, table.projectId);
			}

			this.log('Cleanup complete');
		} catch (error) {
			this.logger.error('Error during cleanup', { error: error as Error });
		}
	}

	private generateTableIdentifiers(
		numTables: number,
	): Array<{ memoryKey: string; projectId: string }> {
		const tables = [];
		for (let i = 0; i < numTables; i++) {
			tables.push({
				memoryKey: `benchmark-table-${i}`,
				projectId: `benchmark-project-${nanoid()}`,
			});
		}
		return tables;
	}

	private generateTestDocuments(count: number) {
		const documents = [];
		for (let i = 0; i < count; i++) {
			documents.push({
				content: `Test document ${i} with some sample content for benchmarking purposes.`,
				metadata: {
					index: i,
					type: 'benchmark',
					timestamp: new Date().toISOString(),
				},
			});
		}
		return documents;
	}

	private generateRandomEmbedding(dimension: number): number[] {
		const embedding = [];
		for (let i = 0; i < dimension; i++) {
			embedding.push(Math.random() * 2 - 1); // Random values between -1 and 1
		}
		// Normalize the vector
		const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
		return embedding.map((val) => val / magnitude);
	}

	private generateRandomEmbeddings(count: number, dimension: number): number[][] {
		const embeddings = [];
		for (let i = 0; i < count; i++) {
			embeddings.push(this.generateRandomEmbedding(dimension));
		}
		return embeddings;
	}

	private async sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	async catch(error: Error) {
		this.logger.error('Failed to run benchmark');
		this.logger.error(error.message);
	}
}
