/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { AccessTokensRepository, PasswordResetRequestsRepository, UsersRepository } from '@/models/_.js';
import type { MiUser } from '@/models/User.js';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import { generateNativeUserToken } from '@/misc/token.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { InternalEventService } from '@/global/InternalEventService.js';
import { LoggerService } from '@/core/LoggerService.js';
import type { Logger } from '@/logger.js';

/**
 * SK-2026-068: after password change/reset, kill surviving API sessions.
 */
@Injectable()
export class SessionRevocationService {
	private readonly logger: Logger;

	constructor(
		@Inject(DI.usersRepository)
		private readonly usersRepository: UsersRepository,

		@Inject(DI.accessTokensRepository)
		private readonly accessTokensRepository: AccessTokensRepository,

		@Inject(DI.passwordResetRequestsRepository)
		private readonly passwordResetRequestsRepository: PasswordResetRequestsRepository,

		private readonly globalEventService: GlobalEventService,
		private readonly internalEventService: InternalEventService,
		loggerService: LoggerService,
	) {
		this.logger = loggerService.getLogger('session-revoke');
	}

	/**
	 * Rotate native user.token, delete app access_tokens, clear password-reset rows.
	 * Optionally notify main stream (forces web client re-login).
	 */
	@bindThis
	public async revokeAllSessionsForUser(
		userId: MiUser['id'],
		opts?: { publishTokenEvent?: boolean },
	): Promise<{ newToken: string }> {
		const user = await this.usersRepository.findOneBy({ id: userId });
		if (user == null) {
			throw new Error('user not found');
		}

		const oldToken = user.token;
		const newToken = generateNativeUserToken();

		await this.usersRepository.update(userId, {
			token: newToken,
		});

		const deletedTokens = await this.accessTokensRepository.delete({ userId });
		const deletedResets = await this.passwordResetRequestsRepository.delete({ userId });

		await this.internalEventService.emit('userTokenRegenerated', {
			id: userId,
			oldToken,
			newToken,
		});

		if (opts?.publishTokenEvent !== false) {
			await this.globalEventService.publishMainStream(userId, 'myTokenRegenerated', {});
		}

		this.logger.info(
			`revoked sessions user=${userId} accessTokens=${(deletedTokens as any)?.affected ?? '?'} resets=${(deletedResets as any)?.affected ?? '?'}`,
		);

		return { newToken };
	}
}
