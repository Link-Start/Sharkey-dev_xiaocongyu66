/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AiNoteModerationConfig1775900000000 {
	name = 'AiNoteModerationConfig1775900000000';

	async up(queryRunner) {
		await queryRunner.query(`
			ALTER TABLE "meta"
			ADD COLUMN IF NOT EXISTS "aiNoteModerationConfig" jsonb
			NOT NULL
			DEFAULT '{"enableLocalNotes":false,"enableRemoteNotes":false,"baseUrl":null,"apiKey":null,"model":"gpt-4o-mini","apiStyle":"auto","requestTimeoutMs":8000,"systemPrompt":null,"action":"reject","failOpen":true}'::jsonb
		`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "aiNoteModerationConfig"`);
	}
}
