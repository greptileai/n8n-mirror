import { Service } from '@n8n/di';
import fs from 'node:fs/promises';
import type { Readable } from 'node:stream';
import { v4 as uuid } from 'uuid';

import { ObjectStoreConfig } from './object-store/object-store.config';
import { ObjectStoreService } from './object-store/object-store.service.ee';
import type { BinaryData } from './types';
import { binaryToBuffer } from './utils';

@Service()
export class ObjectStoreManager implements BinaryData.Manager {
	constructor(
		private readonly objectStoreService: ObjectStoreService,
		private readonly config: ObjectStoreConfig,
	) {}

	async init() {
		await this.objectStoreService.checkConnection();
	}

	async store(
		location: BinaryData.FileLocation,
		bufferOrStream: Buffer | Readable,
		metadata: BinaryData.PreWriteMetadata,
	) {
		const fileId = this.toFileId(location);
		const buffer = await binaryToBuffer(bufferOrStream);

		await this.objectStoreService.put(fileId, buffer, metadata);

		return { fileId, fileSize: buffer.length };
	}

	getPath(fileId: string) {
		return fileId; // already full path, no transform needed
	}

	async getAsBuffer(fileId: string) {
		return await this.objectStoreService.get(fileId, { mode: 'buffer' });
	}

	async getAsStream(fileId: string) {
		return await this.objectStoreService.get(fileId, { mode: 'stream' });
	}

	async getMetadata(fileId: string): Promise<BinaryData.Metadata> {
		const {
			'content-length': contentLength,
			'content-type': contentType,
			'x-amz-meta-filename': fileName,
		} = await this.objectStoreService.getMetadata(fileId);

		const metadata: BinaryData.Metadata = { fileSize: Number(contentLength) };

		if (contentType) metadata.mimeType = contentType;
		if (fileName) metadata.fileName = fileName;

		return metadata;
	}

	async copyByFileId(targetLocation: BinaryData.FileLocation, sourceFileId: string) {
		const targetFileId = this.toFileId(targetLocation);

		const sourceFile = await this.objectStoreService.get(sourceFileId, { mode: 'buffer' });

		await this.objectStoreService.put(targetFileId, sourceFile);

		return targetFileId;
	}

	/**
	 * Copy to object store the temp file written by nodes like Webhook, FTP, and SSH.
	 */
	async copyByFilePath(
		targetLocation: BinaryData.FileLocation,
		sourcePath: string,
		metadata: BinaryData.PreWriteMetadata,
	) {
		const targetFileId = this.toFileId(targetLocation);
		const sourceFile = await fs.readFile(sourcePath);

		await this.objectStoreService.put(targetFileId, sourceFile, metadata);

		return { fileId: targetFileId, fileSize: sourceFile.length };
	}

	async rename(oldFileId: string, newFileId: string) {
		const oldFile = await this.objectStoreService.get(oldFileId, { mode: 'buffer' });
		const oldFileMetadata = await this.objectStoreService.getMetadata(oldFileId);

		await this.objectStoreService.put(newFileId, oldFile, oldFileMetadata);
		await this.objectStoreService.deleteOne(oldFileId);
	}

	getStorageConfig(): BinaryData.StorageConfig {
		return {
			mode: 's3',
			bucket: this.config.bucket.name,
			region: this.config.bucket.region,
			accessKeyId: this.config.credentials.accessKey,
			secretAccessKey: this.config.credentials.accessSecret,
			endpoint:
				this.config.host !== '' ? `${this.config.protocol}://${this.config.host}` : undefined,
		};
	}

	/**
	 * S3 doesn't have directories - returns S3 URI for the location
	 * @returns S3 URI (e.g., s3://bucket/path)
	 */
	async ensureLocation(location: BinaryData.FileLocation): Promise<string> {
		const path = this.toPath(location);
		return `s3://${this.config.bucket.name}/${path}`;
	}

	/**
	 * Size calculation would require listing all objects in S3, which is expensive
	 * Consider using CloudWatch metrics or S3 inventory reports instead
	 * @returns Always returns 0
	 */
	async getSize(_location: BinaryData.FileLocation): Promise<number> {
		return 0;
	}

	// ----------------------------------
	//         private methods
	// ----------------------------------

	private toPath(location: BinaryData.FileLocation): string {
		switch (location.type) {
			case 'execution': {
				const executionId = location.executionId || 'temp'; // missing only in edge case, see PR #7244
				return `workflows/${location.workflowId}/executions/${executionId}`;
			}
			case 'custom':
				return location.pathSegments.join('/');
		}
	}

	private toFileId(location: BinaryData.FileLocation) {
		return `${this.toPath(location)}/binary_data/${uuid()}`;
	}
}
