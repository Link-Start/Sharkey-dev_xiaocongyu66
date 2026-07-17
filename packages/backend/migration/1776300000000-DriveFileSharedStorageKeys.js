/*
 * SPDX-FileCopyrightText: syuilo and other Sharkey contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * Allow multiple drive_file rows to share the same physical storage keys
 * (content-hash dedup). Unique indexes on accessKey / thumbnailAccessKey /
 * webpublicAccessKey are dropped so refcounted storage can be reused.
 */
export class DriveFileSharedStorageKeys1776300000000 {
	name = 'DriveFileSharedStorageKeys1776300000000';

	async up(queryRunner) {
		// Drop unique indexes (names from Init migration; IF EXISTS for safety)
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_d85a184c2540d2deba33daf642"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_e74022ce9a074b3866f70e0d27"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_c55b2b7c284d9fef98026fc88e"`);

		// Non-unique indexes for lookup / refcount
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_drive_file_accessKey" ON "drive_file" ("accessKey")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_drive_file_thumbnailAccessKey" ON "drive_file" ("thumbnailAccessKey")`);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_drive_file_webpublicAccessKey" ON "drive_file" ("webpublicAccessKey")`);
		// Help content-hash reuse scans
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_drive_file_md5_size_local" ON "drive_file" ("md5", "size") WHERE "isLink" = false`);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_drive_file_md5_size_local"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_drive_file_webpublicAccessKey"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_drive_file_thumbnailAccessKey"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_drive_file_accessKey"`);

		// Restore unique indexes only if no duplicates exist
		await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_d85a184c2540d2deba33daf642" ON "drive_file" ("accessKey")`);
		await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_e74022ce9a074b3866f70e0d27" ON "drive_file" ("thumbnailAccessKey")`);
		await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_c55b2b7c284d9fef98026fc88e" ON "drive_file" ("webpublicAccessKey")`);
	}
}
