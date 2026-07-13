/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * Async concurrent chat history loading (UI-thread pool; not OS threads).
 * - Background pipeline prefetches older pages without scroll-coupling
 * - Concurrent workers for independent jobs (e.g. multi-page warm after jump)
 * - Yields to the browser between pages to avoid jank
 */

export type HistoryPageFetcher<T> = (args: {
	limit: number;
	untilId: string | null;
}) => Promise<T[]>;

export type HistoryPrefetchOptions<T extends { id: string }> = {
	/** Newest-first page fetcher (API shape) */
	fetchPage: HistoryPageFetcher<T>;
	pageSize: number;
	/** Hard cap on background pages (safety) */
	maxPages?: number;
	/** Soft cap on total messages held in memory by this loader */
	maxMessages?: number;
	/** Called after each page (newest-first page); merge into store yourself */
	onPage: (page: T[], meta: { pageIndex: number; oldestId: string | null }) => void;
	/** Optional: pause when returns true (e.g. tab hidden) */
	shouldPause?: () => boolean;
};

function idle(ms = 0): Promise<void> {
	return new Promise(resolve => {
		if (ms > 0) {
			window.setTimeout(() => resolve(), ms);
			return;
		}
		if (typeof requestIdleCallback === 'function') {
			requestIdleCallback(() => resolve(), { timeout: 120 });
		} else {
			requestAnimationFrame(() => resolve());
		}
	});
}

/**
 * Run independent async jobs with a fixed concurrency pool.
 */
export async function runPool<T, R>(
	items: T[],
	concurrency: number,
	worker: (item: T, index: number) => Promise<R>,
	opts?: { signal?: { aborted: boolean } },
): Promise<R[]> {
	const n = Math.max(1, Math.min(concurrency, items.length || 1));
	const results: R[] = new Array(items.length);
	let next = 0;

	async function runOne() {
		while (next < items.length) {
			if (opts?.signal?.aborted) return;
			const i = next++;
			results[i] = await worker(items[i], i);
		}
	}

	await Promise.all(Array.from({ length: Math.min(n, items.length) }, () => runOne()));
	return results;
}

/**
 * Background history prefetcher: walks older pages via untilId pipeline.
 * API pages are sequential (cursor), but work is fully async and yields to UI.
 * Optional "burst" starts the next request as soon as the previous resolves
 * while the previous page is still being merged (overlap).
 */
export class ChatHistoryPrefetcher<T extends { id: string }> {
	private aborted = false;
	private running = false;
	private pageIndex = 0;
	private untilId: string | null = null;
	private exhausted = false;
	private readonly maxPages: number;
	private readonly maxMessages: number;
	private messagesSeen = 0;

	constructor(private readonly opts: HistoryPrefetchOptions<T>) {
		this.maxPages = opts.maxPages ?? 40;
		this.maxMessages = opts.maxMessages ?? 800;
	}

	get isRunning(): boolean {
		return this.running;
	}

	get isExhausted(): boolean {
		return this.exhausted;
	}

	/** Start from current oldest loaded id (or null = first page). */
	start(fromUntilId: string | null) {
		if (this.running || this.aborted) return;
		this.untilId = fromUntilId;
		this.pageIndex = 0;
		this.exhausted = false;
		this.messagesSeen = 0;
		this.running = true;
		void this.loop();
	}

	/** Continue after more headroom (e.g. user still needs older). */
	resume(fromUntilId: string | null) {
		if (this.aborted || this.running) return;
		if (this.exhausted && fromUntilId === this.untilId) return;
		this.untilId = fromUntilId;
		this.running = true;
		void this.loop();
	}

	stop() {
		this.aborted = true;
		this.running = false;
	}

	reset() {
		this.stop();
		this.aborted = false;
		this.exhausted = false;
		this.pageIndex = 0;
		this.untilId = null;
		this.messagesSeen = 0;
	}

	private async loop() {
		try {
			while (!this.aborted && this.running) {
				if (this.opts.shouldPause?.()) {
					await idle(200);
					continue;
				}
				if (this.pageIndex >= this.maxPages || this.messagesSeen >= this.maxMessages) {
					this.running = false;
					return;
				}
				if (this.untilId == null && this.pageIndex > 0) {
					this.exhausted = true;
					this.running = false;
					return;
				}

				const page = await this.opts.fetchPage({
					limit: this.opts.pageSize,
					untilId: this.untilId,
				});

				if (this.aborted) return;

				if (!page.length) {
					this.exhausted = true;
					this.running = false;
					this.opts.onPage([], { pageIndex: this.pageIndex, oldestId: this.untilId });
					return;
				}

				this.messagesSeen += page.length;
				const oldestId = page[page.length - 1]?.id ?? null;
				this.opts.onPage(page, { pageIndex: this.pageIndex, oldestId });
				this.pageIndex++;

				// Next cursor: oldest of this page
				if (page.length < this.opts.pageSize) {
					this.exhausted = true;
					this.running = false;
					return;
				}
				this.untilId = oldestId;

				// Yield longer so scroll fling isn't starved by merge/layout every frame
				await idle(this.opts.shouldPause?.() ? 280 : 48);
			}
		} catch {
			// Network blip — stop; user can retry via load more
			this.running = false;
		} finally {
			this.running = false;
		}
	}
}

/**
 * Concurrent multi-page fetch for jump-to-message: walk older pages with
 * limited parallel post-processing (normalize) while pages arrive sequentially.
 */
export async function loadUntilMessageFound<T extends { id: string }>(opts: {
	targetId: string;
	/** Current oldest id already loaded (newest-first list) */
	oldestId: string | null;
	pageSize: number;
	maxPages: number;
	fetchPage: HistoryPageFetcher<T>;
	/** Concurrent normalize/map workers per page */
	mapConcurrency?: number;
	mapPage?: (page: T[]) => Promise<T[]> | T[];
	signal?: { aborted: boolean };
}): Promise<{ pages: T[][]; found: boolean; exhausted: boolean }> {
	const pages: T[][] = [];
	let untilId = opts.oldestId;
	let found = false;
	let exhausted = false;
	const mapConcurrency = opts.mapConcurrency ?? 4;

	for (let i = 0; i < opts.maxPages; i++) {
		if (opts.signal?.aborted) break;
		if (untilId == null && i > 0) {
			exhausted = true;
			break;
		}

		const raw = await opts.fetchPage({
			limit: opts.pageSize,
			untilId,
		});

		if (!raw.length) {
			exhausted = true;
			break;
		}

		let page = raw;
		if (opts.mapPage) {
			page = await opts.mapPage(raw);
		} else if (mapConcurrency > 1) {
			// Concurrent async slots for per-item work hooks (identity by default)
			page = await runPool(raw, mapConcurrency, async (m) => m, { signal: opts.signal });
		}

		pages.push(page);

		if (page.some(m => m.id === opts.targetId)) {
			found = true;
			break;
		}

		const oldest = page[page.length - 1]?.id;
		if (!oldest || oldest < opts.targetId) {
			// Past target snowflake without finding it
			if (oldest && oldest < opts.targetId && !page.some(m => m.id === opts.targetId)) {
				break;
			}
		}
		if (page.length < opts.pageSize) {
			exhausted = true;
			break;
		}
		untilId = oldest ?? null;
		await idle(0);
	}

	return { pages, found, exhausted };
}
