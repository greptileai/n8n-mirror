import type { MigrationContext, ReversibleMigration } from '../migration-types';

const table = {
	tools: 'chat_hub_tools',
	user: 'user',
} as const;

export class CreateChatHubToolsTable1770000000000 implements ReversibleMigration {
	async up({ schemaBuilder: { createTable, column } }: MigrationContext) {
		await createTable(table.tools)
			.withColumns(
				column('id').uuid.primary,
				column('name').varchar(128).notNull,
				column('ownerId').uuid.notNull,
				column('definition').json.notNull,
				column('enabled').bool.notNull.default(true),
			)
			.withForeignKey('ownerId', {
				tableName: table.user,
				columnName: 'id',
				onDelete: 'CASCADE',
			})
			.withIndexOn(['ownerId', 'name'], true).withTimestamps;
	}

	async down({ schemaBuilder: { dropTable } }: MigrationContext) {
		await dropTable(table.tools);
	}
}
