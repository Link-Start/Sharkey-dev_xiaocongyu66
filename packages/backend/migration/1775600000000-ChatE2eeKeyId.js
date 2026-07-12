/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class ChatE2eeKeyId1775600000000 {
	name = 'ChatE2eeKeyId1775600000000';

	async up(queryRunner) {
		await queryRunner.query(`
			ALTER TABLE "chat_e2ee_key"
			ADD COLUMN IF NOT EXISTS "keyId" character varying(64)
		`);
	}

	async down(queryRunner) {
		await queryRunner.query(`
			ALTER TABLE "chat_e2ee_key"
			DROP COLUMN IF EXISTS "keyId"
		`);
	}
}
