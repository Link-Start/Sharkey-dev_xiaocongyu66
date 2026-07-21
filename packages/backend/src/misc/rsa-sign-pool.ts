/*
 * SPDX-FileCopyrightText: Sharkey contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * RSA-SHA256 signing offloaded to a Piscina thread pool (Misskey threadPoolSize).
 * Sharkey keeps slacc 0.0.10 for ZipReader/AhoCorasick; RSA uses Node crypto in workers.
 */

import { createSign } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Piscina } from 'piscina';

let pool: Piscina | null = null;
let initSize = 0;

/**
 * Initialize (or resize) the RSA sign thread pool.
 * Safe to call multiple times; no-op if size is unchanged.
 */
export function initRsaSignPool(threadPoolSize = 1): void {
	const size = Math.max(1, Math.floor(threadPoolSize));
	if (pool && initSize === size) return;

	// Destroy previous pool if size changed
	if (pool) {
		void pool.destroy();
		pool = null;
	}

	const filename = path.join(
		path.dirname(fileURLToPath(import.meta.url)),
		'rsa-sign-worker.cjs',
	);

	pool = new Piscina({
		filename,
		minThreads: size,
		maxThreads: size,
		idleTimeout: 30_000,
	});
	initSize = size;
}

export function destroyRsaSignPool(): void {
	if (pool) {
		void pool.destroy();
		pool = null;
		initSize = 0;
	}
}

/**
 * RSA-SHA256 sign; uses thread pool when initialized, else main-thread fallback.
 */
export async function rsaSignSha256Base64(
	data: string | Buffer,
	privateKeyPem: string,
): Promise<string> {
	const buf = typeof data === 'string' ? Buffer.from(data) : data;

	if (pool) {
		return await pool.run({
			dataBase64: buf.toString('base64'),
			privateKeyPem,
		}) as string;
	}

	// Fallback (tests / before init)
	const signer = createSign('sha256');
	signer.update(buf);
	signer.end();
	return signer.sign(privateKeyPem, 'base64');
}
