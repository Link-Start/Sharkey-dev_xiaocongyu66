/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { NestFactory } from '@nestjs/core';
import { QueueProcessorService } from '@/queue/QueueProcessorService.js';
import { NestLogger } from '@/NestLogger.js';
import { QueueProcessorModule } from '@/queue/QueueProcessorModule.js';
import { ServerService } from '@/server/ServerService.js';
import { MainModule } from '@/MainModule.js';
import { DI } from '@/di-symbols.js';
import { initRsaSignPool, destroyRsaSignPool } from '@/misc/rsa-sign-pool.js';
import type { Config } from '@/config.js';
import type { IEntryNestModule, INestApplicationContext } from '@nestjs/common';

export async function server() {
	const app = await createContext(MainModule);

	const serverService = app.get(ServerService);
	await serverService.launch();

	return app;
}

export async function jobQueue() {
	const app = await createContext(QueueProcessorModule);

	const queueProcessorService = app.get(QueueProcessorService);
	queueProcessorService.start();

	return app;
}

async function createContext(rootModule: IEntryNestModule): Promise<INestApplicationContext> {
	// Load all modules and providers
	const logger = new NestLogger();
	const app = await NestFactory.createApplicationContext(rootModule, { logger });

	// Init RSA sign thread pool before any federation signing (Misskey threadPoolSize).
	const config = app.get<Config>(DI.config);
	initRsaSignPool(config.threadPoolSize);

	// Call startup hooks
	await app.init();

	// Register shutdown hooks, but only after successful init.
	app.enableShutdownHooks();
	// Destroy RSA worker pool on process exit
	process.once('beforeExit', () => destroyRsaSignPool());

	return app;
}
