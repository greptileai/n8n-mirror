import {
	createTestMigrationContext,
	initDbUpToMigration,
	runSingleMigration,
	undoLastSingleMigration,
	type TestMigrationContext,
} from '@n8n/backend-test-utils';
import { DbConnection } from '@n8n/db';
import { Container } from '@n8n/di';
import { DataSource } from '@n8n/typeorm';

const MIGRATION_NAME = 'AddWorkflowUnpublishScopeToCustomRoles1769900001000';
const PERSONAL_OWNER_ROLE_SLUG = 'project:personalOwner';

interface ScopeData {
	slug: string;
	displayName: string;
	description: string;
}

interface RoleData {
	slug: string;
	displayName: string;
	roleType: string;
	systemRole?: boolean;
}

interface RoleScopeData {
	roleSlug: string;
	scopeSlug: string;
}

interface RoleScopeRow {
	roleSlug: string;
	scopeSlug: string;
}

describe('AddWorkflowUnpublishScopeToCustomRoles Migration', () => {
	let dataSource: DataSource;

	beforeEach(async () => {
		const dbConnection = Container.get(DbConnection);
		await dbConnection.init();

		dataSource = Container.get(DataSource);
		const context = createTestMigrationContext(dataSource);
		await context.queryRunner.clearDatabase();
		await context.queryRunner.release();

		await initDbUpToMigration(MIGRATION_NAME);
	});

	afterEach(async () => {
		const dbConnection = Container.get(DbConnection);
		await dbConnection.close();
	});

	async function insertTestScope(
		context: TestMigrationContext,
		scopeData: ScopeData,
	): Promise<void> {
		const tableName = context.escape.tableName('scope');
		const slugColumn = context.escape.columnName('slug');
		const displayNameColumn = context.escape.columnName('displayName');
		const descriptionColumn = context.escape.columnName('description');

		const existingScope = await context.runQuery<unknown[]>(
			`SELECT ${slugColumn} FROM ${tableName} WHERE ${slugColumn} = :slug`,
			{ slug: scopeData.slug },
		);

		if (existingScope.length === 0) {
			await context.runQuery(
				`INSERT INTO ${tableName} (${slugColumn}, ${displayNameColumn}, ${descriptionColumn}) VALUES (:slug, :displayName, :description)`,
				{
					slug: scopeData.slug,
					displayName: scopeData.displayName,
					description: scopeData.description,
				},
			);
		}
	}

	async function insertTestRole(context: TestMigrationContext, roleData: RoleData): Promise<void> {
		const tableName = context.escape.tableName('role');
		const slugColumn = context.escape.columnName('slug');
		const displayNameColumn = context.escape.columnName('displayName');
		const roleTypeColumn = context.escape.columnName('roleType');
		const systemRoleColumn = context.escape.columnName('systemRole');
		const createdAtColumn = context.escape.columnName('createdAt');
		const updatedAtColumn = context.escape.columnName('updatedAt');

		const systemRole = roleData.systemRole ?? false;

		await context.runQuery(
			`INSERT INTO ${tableName} (${slugColumn}, ${displayNameColumn}, ${roleTypeColumn}, ${systemRoleColumn}, ${createdAtColumn}, ${updatedAtColumn}) VALUES (:slug, :displayName, :roleType, :systemRole, :createdAt, :updatedAt)`,
			{
				slug: roleData.slug,
				displayName: roleData.displayName,
				roleType: roleData.roleType,
				systemRole,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		);
	}

	async function insertTestRoleScope(
		context: TestMigrationContext,
		roleScopeData: RoleScopeData,
	): Promise<void> {
		const tableName = context.escape.tableName('role_scope');
		const roleSlugColumn = context.escape.columnName('roleSlug');
		const scopeSlugColumn = context.escape.columnName('scopeSlug');

		await context.runQuery(
			`INSERT INTO ${tableName} (${roleSlugColumn}, ${scopeSlugColumn}) VALUES (:roleSlug, :scopeSlug)`,
			{ roleSlug: roleScopeData.roleSlug, scopeSlug: roleScopeData.scopeSlug },
		);
	}

	async function getRoleScopesByRole(
		context: TestMigrationContext,
		roleSlug: string,
	): Promise<RoleScopeRow[]> {
		const tableName = context.escape.tableName('role_scope');
		const roleSlugColumn = context.escape.columnName('roleSlug');
		const scopeSlugColumn = context.escape.columnName('scopeSlug');

		// Use double-quoted aliases so PostgreSQL returns camelCase keys (otherwise lowercases to roleslug/scopeslug)
		const scopes = await context.runQuery<Array<{ roleSlug: string; scopeSlug: string }>>(
			`SELECT ${roleSlugColumn} AS "roleSlug", ${scopeSlugColumn} AS "scopeSlug" FROM ${tableName} WHERE ${roleSlugColumn} = :roleSlug`,
			{ roleSlug },
		);

		return scopes as RoleScopeRow[];
	}

	async function getRoleScopesByScope(
		context: TestMigrationContext,
		scopeSlug: string,
	): Promise<RoleScopeRow[]> {
		const tableName = context.escape.tableName('role_scope');
		const roleSlugColumn = context.escape.columnName('roleSlug');
		const scopeSlugColumn = context.escape.columnName('scopeSlug');

		// Use double-quoted aliases so PostgreSQL returns camelCase keys
		const rows = await context.runQuery<Array<{ roleSlug: string; scopeSlug: string }>>(
			`SELECT ${roleSlugColumn} AS "roleSlug", ${scopeSlugColumn} AS "scopeSlug" FROM ${tableName} WHERE ${scopeSlugColumn} = :scopeSlug`,
			{ scopeSlug },
		);

		return rows as RoleScopeRow[];
	}

	describe('up migration', () => {
		it('adds workflow:unpublish to roles that have workflow:publish, excluding project:personalOwner', async () => {
			const context = createTestMigrationContext(dataSource);

			await insertTestScope(context, {
				slug: 'workflow:publish',
				displayName: 'Publish Workflow',
				description: 'Allows publishing workflows.',
			});
			await insertTestScope(context, {
				slug: 'workflow:read',
				displayName: 'Read Workflow',
				description: 'Allows reading workflows.',
			});

			await insertTestRole(context, {
				slug: 'test1-custom-editor',
				displayName: 'Test1 Custom Editor',
				roleType: 'project',
				systemRole: false,
			});
			await insertTestRole(context, {
				slug: 'test1-project-admin',
				displayName: 'Test1 Project Admin',
				roleType: 'project',
				systemRole: true,
			});
			await insertTestRole(context, {
				slug: 'test1-custom-viewer',
				displayName: 'Test1 Custom Viewer',
				roleType: 'project',
				systemRole: false,
			});

			await insertTestRoleScope(context, {
				roleSlug: 'test1-custom-editor',
				scopeSlug: 'workflow:publish',
			});
			await insertTestRoleScope(context, {
				roleSlug: 'test1-project-admin',
				scopeSlug: 'workflow:publish',
			});
			await insertTestRoleScope(context, {
				roleSlug: 'test1-custom-viewer',
				scopeSlug: 'workflow:read',
			});

			const personalOwnerUnpublishBefore = (
				await getRoleScopesByRole(context, PERSONAL_OWNER_ROLE_SLUG)
			).filter((s) => s.scopeSlug === 'workflow:unpublish').length;

			const unpublishScopesBefore = await getRoleScopesByScope(context, 'workflow:unpublish');
			expect(unpublishScopesBefore).toHaveLength(0);

			await runSingleMigration(MIGRATION_NAME);
			dataSource = Container.get(DataSource);

			await context.queryRunner.release();

			const postContext = createTestMigrationContext(dataSource);

			const customEditorScopes = await getRoleScopesByRole(postContext, 'test1-custom-editor');
			expect(customEditorScopes.map((s) => s.scopeSlug).sort()).toContain('workflow:unpublish');

			const adminScopes = await getRoleScopesByRole(postContext, 'test1-project-admin');
			expect(adminScopes.map((s) => s.scopeSlug).sort()).toContain('workflow:unpublish');

			const personalOwnerUnpublishAfter = (
				await getRoleScopesByRole(postContext, PERSONAL_OWNER_ROLE_SLUG)
			).filter((s) => s.scopeSlug === 'workflow:unpublish').length;
			expect(personalOwnerUnpublishAfter).toBe(personalOwnerUnpublishBefore);

			const viewerScopes = await getRoleScopesByRole(postContext, 'test1-custom-viewer');
			expect(viewerScopes.map((s) => s.scopeSlug)).not.toContain('workflow:unpublish');

			await postContext.queryRunner.release();
		});

		it('does nothing if role already has workflow:unpublish', async () => {
			const context = createTestMigrationContext(dataSource);

			await insertTestScope(context, {
				slug: 'workflow:publish',
				displayName: 'Publish Workflow',
				description: 'Allows publishing workflows.',
			});
			await insertTestScope(context, {
				slug: 'workflow:unpublish',
				displayName: 'Unpublish Workflow',
				description: 'Allows unpublishing workflows.',
			});

			await insertTestRole(context, {
				slug: 'test2-custom-already-has-unpublish',
				displayName: 'Test2 Custom Already Has Unpublish',
				roleType: 'project',
				systemRole: false,
			});

			await insertTestRoleScope(context, {
				roleSlug: 'test2-custom-already-has-unpublish',
				scopeSlug: 'workflow:publish',
			});
			await insertTestRoleScope(context, {
				roleSlug: 'test2-custom-already-has-unpublish',
				scopeSlug: 'workflow:unpublish',
			});

			const scopesBefore = await getRoleScopesByRole(context, 'test2-custom-already-has-unpublish');
			expect(scopesBefore).toHaveLength(2);

			await runSingleMigration(MIGRATION_NAME);
			dataSource = Container.get(DataSource);

			await context.queryRunner.release();

			const postContext = createTestMigrationContext(dataSource);
			const scopesAfter = await getRoleScopesByRole(
				postContext,
				'test2-custom-already-has-unpublish',
			);
			expect(scopesAfter).toHaveLength(2);
			expect(scopesAfter.map((s) => s.scopeSlug).sort()).toEqual([
				'workflow:publish',
				'workflow:unpublish',
			]);

			await postContext.queryRunner.release();
		});
	});

	describe('down migration', () => {
		it('removes workflow:unpublish from all roles', async () => {
			// beforeEach gives a clean DB; insert data and run migration so we have workflow:unpublish to remove
			const context = createTestMigrationContext(dataSource);

			await insertTestScope(context, {
				slug: 'workflow:publish',
				displayName: 'Publish Workflow',
				description: 'Allows publishing workflows.',
			});
			await insertTestRole(context, {
				slug: 'test-down-role',
				displayName: 'Test Down Role',
				roleType: 'project',
				systemRole: false,
			});
			await insertTestRoleScope(context, {
				roleSlug: 'test-down-role',
				scopeSlug: 'workflow:publish',
			});

			await context.queryRunner.release();

			await runSingleMigration(MIGRATION_NAME);
			dataSource = Container.get(DataSource);

			const postUpContext = createTestMigrationContext(dataSource);
			const unpublishScopesBefore = await getRoleScopesByScope(postUpContext, 'workflow:unpublish');
			expect(unpublishScopesBefore.length).toBeGreaterThan(0);

			await postUpContext.queryRunner.release();

			await undoLastSingleMigration();
			dataSource = Container.get(DataSource);

			const postDownContext = createTestMigrationContext(dataSource);
			const unpublishScopesAfter = await getRoleScopesByScope(
				postDownContext,
				'workflow:unpublish',
			);
			expect(unpublishScopesAfter).toHaveLength(0);

			await postDownContext.queryRunner.release();
		});
	});
});
