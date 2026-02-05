import type { Embeddings } from '@langchain/core/embeddings';
import { Document } from '@langchain/core/documents';
import { VectorStore } from '@langchain/core/vectorstores';
import type { Connection, Table } from '@lancedb/lancedb';
import { nanoid } from 'nanoid';
import { jsonParse } from 'n8n-workflow';

interface LanceDBRecord extends Record<string, unknown> {
	id: string;
	vector: number[];
	content: string;
	metadata: string; // Store as JSON string to avoid schema inference issues
	createdAt: string; // Store as ISO string to avoid schema inference issues
	updatedAt: string; // Store as ISO string to avoid schema inference issues
}

export interface BinaryDataCredentials {
	mode: 'filesystem' | 's3';
	storagePath: string;
	bucket?: string;
	region?: string;
	accessKeyId?: string;
	secretAccessKey?: string;
	endpoint?: string;
}

/**
 * DatabaseVectorStore - A VectorStore implementation that persists vectors using LanceDB
 *
 * This class bridges LangChain's VectorStore interface with LanceDB backend
 */
export class DatabaseVectorStore extends VectorStore {
	private connection?: Connection;
	private readonly storageConfig: BinaryDataCredentials;

	constructor(
		binaryDataCredentials: BinaryDataCredentials,
		embeddings: Embeddings,
		private readonly memoryKey: string,
	) {
		super(embeddings, {});
		this.storageConfig = binaryDataCredentials;
	}

	/**
	 * List all available vector stores (tables) for given credentials
	 */
	static async listStores(
		binaryDataCredentials: BinaryDataCredentials,
		filter?: string,
	): Promise<string[]> {
		const storageConfig = binaryDataCredentials;
		try {
			// Lazy-load LanceDB
			const { connect } = await import('@lancedb/lancedb');

			// Connect to LanceDB
			let connection;
			if (storageConfig.mode === 's3') {
				connection = await connect({
					uri: storageConfig.storagePath,
					storageOptions: {
						region: storageConfig.region!,
						accessKeyId: storageConfig.accessKeyId!,
						secretAccessKey: storageConfig.secretAccessKey!,
						...(storageConfig.endpoint && { endpoint: storageConfig.endpoint }),
					},
				});
			} else {
				connection = await connect(storageConfig.storagePath);
			}

			// List tables
			let tableNames = await connection.tableNames();

			// Apply filter if provided
			if (filter) {
				const filterLower = filter.toLowerCase();
				tableNames = tableNames.filter((name) => name.toLowerCase().includes(filterLower));
			}

			return tableNames;
		} catch (error) {
			// Directory doesn't exist yet or connection failed
			return [];
		}
	}

	/**
	 * Get or create a LanceDB connection
	 */
	private async getConnection(): Promise<Connection> {
		if (!this.connection) {
			// Lazy-load LanceDB to avoid startup overhead
			const { connect } = await import('@lancedb/lancedb');

			if (this.storageConfig.mode === 's3') {
				// S3 backend - connect with credentials
				this.connection = await connect({
					uri: this.storageConfig.storagePath,
					storageOptions: {
						region: this.storageConfig.region!,
						accessKeyId: this.storageConfig.accessKeyId!,
						secretAccessKey: this.storageConfig.secretAccessKey!,
						...(this.storageConfig.endpoint && { endpoint: this.storageConfig.endpoint }),
					},
				});
			} else {
				// Filesystem backend - connect directly with path
				this.connection = await connect(this.storageConfig.storagePath);
			}
		}

		return this.connection;
	}

	/**
	 * Sanitize memory key for use as a table name (filesystem-safe)
	 */
	private sanitizeTableName(memoryKey: string): string {
		// Replace invalid filesystem characters with underscores
		return memoryKey.replace(/[^a-zA-Z0-9_-]/g, '_');
	}

	/**
	 * Get or create a LanceDB table
	 */
	private async getTable(createIfMissing: boolean = false): Promise<Table | null> {
		const connection = await this.getConnection();
		const tableName = this.sanitizeTableName(this.memoryKey);

		const tableNames = await connection.tableNames();

		if (!tableNames.includes(tableName)) {
			if (!createIfMissing) {
				return null;
			}
			// Table will be created in addVectors when we have actual data
			throw new Error(`Table ${tableName} does not exist yet`);
		}

		return await connection.openTable(tableName);
	}

	/**
	 * Build SQL WHERE clause from metadata filter
	 * Note: Metadata is stored as JSON string, so we use LIKE for simple string matching
	 */
	private buildWhereClause(filter?: Record<string, unknown>): string | undefined {
		if (!filter || Object.keys(filter).length === 0) {
			return undefined;
		}

		const conditions: string[] = [];

		for (const [key, value] of Object.entries(filter)) {
			// Build a JSON pattern to search for the key-value pair
			// This is a simple approach that works for basic filtering
			const escapedKey = key.replace(/'/g, "''");

			// Use LIKE to search for the pattern in the JSON string
			conditions.push(`metadata LIKE '%"${escapedKey}":${JSON.stringify(value)}%'`);
		}

		return conditions.join(' AND ');
	}

	/**
	 * Add documents to the vector store
	 */
	async addDocuments(documents: Document[]): Promise<string[]> {
		const texts = documents.map((doc) => doc.pageContent);
		const embeddings = await this.embeddings.embedDocuments(texts);

		return await this.addVectors(embeddings, documents);
	}

	/**
	 * Add vectors to the store
	 */
	async addVectors(vectors: number[][], documents: Document[]): Promise<string[]> {
		const connection = await this.getConnection();
		const tableName = this.sanitizeTableName(this.memoryKey);
		const tableNames = await connection.tableNames();
		const tableExists = tableNames.includes(tableName);

		const now = new Date().toISOString();
		const records: LanceDBRecord[] = documents.map((doc, i) => ({
			id: nanoid(),
			vector: vectors[i],
			content: doc.pageContent,
			metadata: JSON.stringify(doc.metadata), // Serialize metadata to JSON string
			createdAt: now,
			updatedAt: now,
		}));

		if (!tableExists) {
			// Create table with the first batch of records
			if (records.length === 0) {
				throw new Error('Cannot create table with no records');
			}
			await connection.createTable(tableName, records);
		} else {
			const table = await connection.openTable(tableName);

			if (records.length > 0) {
				await table.add(records);
			}
		}

		return records.map(({ id }) => id);
	}

	/**
	 * Perform similarity search and return documents with scores
	 */
	async similaritySearchVectorWithScore(
		query: number[],
		k: number,
		filter?: Record<string, unknown>,
	): Promise<Array<[Document, number]>> {
		const table = await this.getTable();

		if (!table) {
			// Table doesn't exist yet, return empty results
			return [];
		}

		let lanceQuery = table.search(query).limit(k);

		const whereClause = this.buildWhereClause(filter);
		if (whereClause) {
			lanceQuery = lanceQuery.where(whereClause);
		}

		const results = await lanceQuery.toArray();

		return results.map((row: LanceDBRecord & { _distance: number }) => {
			const doc = new Document({
				pageContent: row.content,
				metadata: jsonParse(row.metadata), // Deserialize metadata from JSON string
			});
			const score = 1 - row._distance; // Convert distance to similarity score (cosine: 0=identical, 2=opposite)
			return [doc, score];
		});
	}

	/**
	 * Return documents selected using the maximal marginal relevance
	 * Not implemented for LanceDB vector store
	 */
	async maxMarginalRelevanceSearch(
		_query: string,
		_options: { k: number; fetchK?: number; lambda?: number; filter?: Record<string, unknown> },
	): Promise<Document[]> {
		throw new Error('maxMarginalRelevanceSearch is not supported for DatabaseVectorStore');
	}

	/**
	 * Get type identifier
	 */
	_vectorstoreType(): string {
		return 'lancedb';
	}

	/**
	 * Clear all vectors for this memory key
	 */
	async clearStore(): Promise<void> {
		const table = await this.getTable();
		if (!table) {
			// Table doesn't exist, nothing to clear
			return;
		}
		await table.delete('true'); // Delete all rows
	}

	/**
	 * Get count of vectors in the store
	 */
	async getVectorCount(): Promise<number> {
		const table = await this.getTable();
		if (!table) {
			// Table doesn't exist yet
			return 0;
		}
		return await table.countRows();
	}
}
