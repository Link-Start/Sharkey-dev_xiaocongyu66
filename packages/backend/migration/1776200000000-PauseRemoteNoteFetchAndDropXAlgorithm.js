/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class PauseRemoteNoteFetchAndDropXAlgorithm1776200000000 {
	name = 'PauseRemoteNoteFetchAndDropXAlgorithm1776200000000';

	async up(queryRunner) {
		await queryRunner.query(`
			ALTER TABLE "meta"
			ADD COLUMN IF NOT EXISTS "pauseRemoteNoteFetch" boolean NOT NULL DEFAULT false
		`);
		// X/Musk algorithm fully removed from application code
		await queryRunner.query(`
			ALTER TABLE "meta" DROP COLUMN IF EXISTS "xAlgorithmConfig"
		`);
	}

	async down(queryRunner) {
		await queryRunner.query(`
			ALTER TABLE "meta" DROP COLUMN IF EXISTS "pauseRemoteNoteFetch"
		`);
		await queryRunner.query(`
			ALTER TABLE "meta"
			ADD COLUMN IF NOT EXISTS "xAlgorithmConfig" jsonb NOT NULL DEFAULT '{"enabled":false}'
		`);
	}
}
