import { BinaryDataRepository, In, SourceTypeSchema, type SourceType } from '@n8n/db';
import { Service } from '@n8n/di';
import {
	BinaryDataConfig,
	type BinaryData,
	BinaryDataFileNotFoundError,
	binaryToBuffer,
	FileTooLargeError,
	InvalidSourceTypeError,
	MissingSourceIdError,
} from 'n8n-core';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { v4 as uuid } from 'uuid';

@Service()
export class DatabaseManager implements BinaryData.Manager {
	constructor(
		private readonly repository: BinaryDataRepository,
		private readonly config: BinaryDataConfig,
	) {}

	async init() {
		// managed centrally by typeorm
	}

	async store(
		location: BinaryData.FileLocation,
		bufferOrStream: Buffer | Readable,
		metadata: BinaryData.PreWriteMetadata,
	) {
		const buffer = await binaryToBuffer(bufferOrStream);
		const fileSizeBytes = buffer.length;
		const fileSizeMb = fileSizeBytes / (1024 * 1024);
		const fileId = uuid();

		if (fileSizeMb > this.config.dbMaxFileSize) {
			throw new FileTooLargeError({
				fileSizeMb,
				maxFileSizeMb: this.config.dbMaxFileSize,
				fileId,
				fileName: metadata.fileName,
			});
		}

		const { sourceType, sourceId } = this.toSource(location);

		await this.repository.insert({
			fileId,
			sourceType,
			sourceId,
			data: buffer,
			mimeType: metadata.mimeType ?? null,
			fileName: metadata.fileName ?? null,
			fileSize: fileSizeBytes,
		});

		return { fileId, fileSize: fileSizeBytes };
	}

	getPath(fileId: string) {
		return `database://${fileId}`;
	}

	async getAsBuffer(fileId: string) {
		const file = await this.repository.findOneOrFail({
			where: { fileId },
			select: ['data'],
		});

		return file.data;
	}

	async getAsStream(fileId: string) {
		const buffer = await this.getAsBuffer(fileId);

		return Readable.from(buffer);
	}

	async getMetadata(fileId: string): Promise<BinaryData.Metadata> {
		const file = await this.repository.findOneOrFail({
			where: { fileId },
			select: ['fileName', 'mimeType', 'fileSize'],
		});

		return {
			fileName: file.fileName ?? undefined,
			mimeType: file.mimeType ?? undefined,
			fileSize: file.fileSize,
		};
	}

	async deleteMany(locations: BinaryData.FileLocation[]) {
		if (locations.length === 0) return;

		// method intended _only_ for executions, see other managers

		const executionIds = locations.flatMap((location) =>
			location.type === 'execution' ? [location.executionId] : [],
		);

		if (executionIds.length === 0) return;

		await this.repository.delete({ sourceType: 'execution', sourceId: In(executionIds) });
	}

	async deleteManyByFileId(ids: string[]) {
		if (ids.length === 0) return;

		await this.repository.delete({ fileId: In(ids) });
	}

	async copyByFileId(targetLocation: BinaryData.FileLocation, sourceFileId: string) {
		const targetFileId = uuid();
		const { sourceType, sourceId } = this.toSource(targetLocation);

		const success = await this.repository.copyStoredFile(
			sourceFileId,
			targetFileId,
			sourceType,
			sourceId,
		);

		if (!success) throw new BinaryDataFileNotFoundError(sourceFileId);

		return targetFileId;
	}

	async copyByFilePath(
		targetLocation: BinaryData.FileLocation,
		sourcePath: string, // temp file written to FS by Webhook/SSH/FTP nodes
		metadata: BinaryData.PreWriteMetadata,
	) {
		const fileId = uuid();
		const buffer = await readFile(sourcePath);
		const fileSizeBytes = buffer.length;
		const fileSizeMb = fileSizeBytes / (1024 * 1024);

		if (fileSizeMb > this.config.dbMaxFileSize) {
			throw new FileTooLargeError({
				fileSizeMb,
				maxFileSizeMb: this.config.dbMaxFileSize,
				fileId,
				fileName: metadata.fileName,
			});
		}

		const { sourceType, sourceId } = this.toSource(targetLocation);

		await this.repository.insert({
			fileId,
			sourceType,
			sourceId,
			data: buffer,
			mimeType: metadata.mimeType ?? null,
			fileName: metadata.fileName ?? null,
			fileSize: fileSizeBytes,
		});

		return { fileId, fileSize: fileSizeBytes };
	}

	async rename(oldFileId: string, newFileId: string) {
		const result = await this.repository.update({ fileId: oldFileId }, { fileId: newFileId });

		if (result.affected === 0) throw new BinaryDataFileNotFoundError(oldFileId);
	}

	getStorageConfig(): BinaryData.StorageConfig {
		return {
			mode: 'filesystem',
		};
	}

	/**
	 * Database doesn't have directories - returns database URI for the location
	 * @returns Database URI (e.g., database://custom/path/segments)
	 */
	async ensureLocation(location: BinaryData.FileLocation): Promise<string> {
		if (location.type === 'execution') {
			return `database://workflows/${location.workflowId}/executions/${location.executionId}`;
		}
		return `database://${location.pathSegments.join('/')}`;
	}

	/**
	 * Calculate total size by summing file sizes from database
	 * @returns Size in bytes
	 */
	async getSize(location: BinaryData.FileLocation): Promise<number> {
		const { sourceType, sourceId } = this.toSource(location);

		const result = await this.repository
			.createQueryBuilder('binary_data')
			.select('SUM(binary_data.fileSize)', 'totalSize')
			.where('binary_data.sourceType = :sourceType', { sourceType })
			.andWhere('binary_data.sourceId LIKE :sourceId', { sourceId: `${sourceId}%` })
			.getRawOne();

		return parseInt(result?.totalSize ?? '0', 10);
	}

	private toSource(location: BinaryData.FileLocation): {
		sourceType: SourceType;
		sourceId: string;
	} {
		if (location.type === 'execution') {
			return {
				sourceType: 'execution',
				sourceId: location.executionId || 'temp', // missing only in edge case, see PR #7244
			};
		}

		if (typeof location.sourceId !== 'string') {
			throw new MissingSourceIdError(location.pathSegments);
		}

		const validationResult = SourceTypeSchema.safeParse(location.sourceType);

		if (!validationResult.success) {
			throw new InvalidSourceTypeError(location.sourceType ?? 'unknown');
		}

		return {
			sourceType: validationResult.data,
			sourceId: location.sourceId,
		};
	}
}
