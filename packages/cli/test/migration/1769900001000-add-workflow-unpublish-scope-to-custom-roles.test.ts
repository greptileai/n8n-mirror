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

	beforeAll(async () => {
		const dbConnection = Container.get(DbConnection);
		await dbConnection.init();

		dataSource = Container.get(DataSource);

		await initDbUpToMigration(MIGRATION_NAME);
	});

	afterAll(async () => {
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

		const existingScope = await context.queryRunner.query(
			`SELECT ${slugColumn} FROM ${tableName} WHERE ${slugColumn} = ?`,
			[scopeData.slug],
		);

		if (existingScope.length === 0) {
			await context.queryRunner.query(
				`INSERT INTO ${tableName} (${slugColumn}, ${displayNameColumn}, ${descriptionColumn}) VALUES (?, ?, ?)`,
				[scopeData.slug, scopeData.displayName, scopeData.description],
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

		await context.queryRunner.query(
			`INSERT INTO ${tableName} (${slugColumn}, ${displayNameColumn}, ${roleTypeColumn}, ${systemRoleColumn}, ${createdAtColumn}, ${updatedAtColumn}) VALUES (?, ?, ?, ?, ?, ?)`,
			[roleData.slug, roleData.displayName, roleData.roleType, systemRole, new Date(), new Date()],
		);
	}

	async function insertTestRoleScope(
		context: TestMigrationContext,
		roleScopeData: RoleScopeData,
	): Promise<void> {
		const tableName = context.escape.tableName('role_scope');
		const roleSlugColumn = context.escape.columnName('roleSlug');
		const scopeSlugColumn = context.escape.columnName('scopeSlug');

		await context.queryRunner.query(
			`INSERT INTO ${tableName} (${roleSlugColumn}, ${scopeSlugColumn}) VALUES (?, ?)`,
			[roleScopeData.roleSlug, roleScopeData.scopeSlug],
		);
	}

	async function getRoleScopesByRole(
		context: TestMigrationContext,
		roleSlug: string,
	): Promise<RoleScopeRow[]> {
		const tableName = context.escape.tableName('role_scope');
		const roleSlugColumn = context.escape.columnName('roleSlug');
		const scopeSlugColumn = context.escape.columnName('scopeSlug');

		const scopes = await context.queryRunner.query(
			`SELECT ${roleSlugColumn} as roleSlug, ${scopeSlugColumn} as scopeSlug FROM ${tableName} WHERE ${roleSlugColumn} = ?`,
			[roleSlug],
		);

		return scopes;
	}

	async function getRoleScopesByScope(
		context: TestMigrationContext,
		scopeSlug: string,
	): Promise<RoleScopeRow[]> {
		const tableName = context.escape.tableName('role_scope');
		const roleSlugColumn = context.escape.columnName('roleSlug');
		const scopeSlugColumn = context.escape.columnName('scopeSlug');

		const roleScopeEntries = await context.queryRunner.query(
			`SELECT ${roleSlugColumn} as roleSlug, ${scopeSlugColumn} as scopeSlug FROM ${tableName} WHERE ${scopeSlugColumn} = ?`,
			[scopeSlug],
		);

		return roleScopeEntries;
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

			// Use test-unique slugs to avoid UNIQUE constraint (project:admin / project:personalOwner may already exist)
			// Custom role with workflow:publish → should get workflow:unpublish
			await insertTestRole(context, {
				slug: 'test1-custom-editor',
				displayName: 'Test1 Custom Editor',
				roleType: 'project',
				systemRole: false,
			});

			// Another role with workflow:publish → should get workflow:unpublish
			await insertTestRole(context, {
				slug: 'test1-project-admin',
				displayName: 'Test1 Project Admin',
				roleType: 'project',
				systemRole: true,
			});

			// Role with workflow:read only → should NOT get workflow:unpublish
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

			// project:personalOwner may already exist from earlier migrations; migration must not add workflow:unpublish to it
			const personalOwnerUnpublishCountBefore = (
				await getRoleScopesByRole(context, PERSONAL_OWNER_ROLE_SLUG)
			).filter((s) => s.scopeSlug === 'workflow:unpublish').length;

			const unpublishScopesBefore = await getRoleScopesByScope(context, 'workflow:unpublish');
			expect(unpublishScopesBefore).toHaveLength(0);

			await runSingleMigration(MIGRATION_NAME);

			await context.queryRunner.release();

			const postContext = createTestMigrationContext(dataSource);

			// test1-custom-editor should have workflow:unpublish
			const customEditorScopes = await getRoleScopesByRole(postContext, 'test1-custom-editor');
			expect(customEditorScopes.map((s) => s.scopeSlug).sort()).toContain('workflow:unpublish');

			// test1-project-admin should have workflow:unpublish
			const adminScopes = await getRoleScopesByRole(postContext, 'test1-project-admin');
			expect(adminScopes.map((s) => s.scopeSlug).sort()).toContain('workflow:unpublish');

			// project:personalOwner is excluded by migration: count of workflow:unpublish for it must be unchanged
			const personalOwnerUnpublishCountAfter = (
				await getRoleScopesByRole(postContext, PERSONAL_OWNER_ROLE_SLUG)
			).filter((s) => s.scopeSlug === 'workflow:unpublish').length;
			expect(personalOwnerUnpublishCountAfter).toBe(personalOwnerUnpublishCountBefore);

			// test1-custom-viewer should NOT have workflow:unpublish
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
		it('removes workflow:unpublish from all roles except project:personalOwner', async () => {
			// Up migration was already run in beforeAll (initDbUpToMigration runs before our migration).
			// Run our migration to add workflow:unpublish to some roles.
			await runSingleMigration(MIGRATION_NAME);

			const context = createTestMigrationContext(dataSource);

			const unpublishScopesBefore = await getRoleScopesByScope(context, 'workflow:unpublish');
			expect(unpublishScopesBefore.length).toBeGreaterThan(0);

			await context.queryRunner.release();

			await undoLastSingleMigration();

			const postContext = createTestMigrationContext(dataSource);

			// Down removes workflow:unpublish only from non-personal-owner roles.
			// In our test we did not add workflow:unpublish to project:personalOwner (migration excludes them),
			// so after down there should be no workflow:unpublish entries.
			const unpublishScopesAfter = await getRoleScopesByScope(postContext, 'workflow:unpublish');
			expect(unpublishScopesAfter).toHaveLength(0);

			await postContext.queryRunner.release();
		});
	});
});
