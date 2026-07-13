/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** Distance from bottom under which we treat as "at live edge" (newest) */
export const LIVE_EDGE_PX = 48;
/** Near top of normal scroll → may load older history */
export const HISTORY_TOP_PX = 80;

export function distanceFromLiveEdge(container: HTMLElement): number {
	// Normal scroll: bottom = live edge
	return container.scrollHeight - container.scrollTop - container.clientHeight;
}

export function isNearLiveEdge(container: HTMLElement | null): boolean {
	if (!container) return false;
	return distanceFromLiveEdge(container) <= LIVE_EDGE_PX;
}

export function isNearHistoryTop(container: HTMLElement | null): boolean {
	if (!container) return false;
	return container.scrollTop <= HISTORY_TOP_PX;
}

export function scrollElementToLiveEdge(
	sc: HTMLElement,
	behavior: ScrollBehavior | 'instant' = 'instant',
) {
	// 'instant' is widely supported; fall back via cast for TS lib
	sc.scrollTo({ top: sc.scrollHeight, behavior: behavior as ScrollBehavior });
}

/**
 * After prepending older messages (top of chronological list), keep viewport
 * fixed with height-delta. Works reliably with normal (non-reversed) scroll.
 *
 * Uses **current** scrollTop + delta (not a frozen prevTop) so a fling that
 * moved between measure and apply is not yanked back. Optional element anchor
 * fine-tunes once only.
 */
export function preserveScrollAfterPrepend(
	scrollContainer: HTMLElement,
	prevHeight: number,
	_prevTop: number,
	anchorId: string | null,
	anchorTopBefore: number | null,
) {
	const delta = scrollContainer.scrollHeight - prevHeight;
	if (delta === 0 && (anchorId == null || anchorTopBefore == null)) return;

	// Relative correction: keep whatever the user/browser already scrolled to
	if (delta !== 0) {
		scrollContainer.scrollTop += delta;
	}

	// One anchor fine-tune only (avoid second write unless needed)
	if (anchorId != null && anchorTopBefore != null) {
		const el = window.document.getElementById(`chat-msg-${anchorId}`);
		if (el) {
			const drift = el.getBoundingClientRect().top - anchorTopBefore;
			if (Math.abs(drift) > 1) {
				scrollContainer.scrollTop += drift;
			}
		}
	}
}

/**
 * Tracks recent user scroll so auto stick-to-live / history restore can be
 * suppressed during flings (stops multi-frame "hit with a stick" twitch).
 */
export function createUserScrollGuard() {
	let userScrollUntil = 0;
	let lastScrollTop = 0;
	let lastScrollAt = 0;
	/** EMA of |Δscroll| / Δt (px/ms) */
	let velocityEma = 0;

	return {
		markUserScrolling(container: HTMLElement) {
			const top = container.scrollTop;
			const now = performance.now();
			const dt = Math.max(1, now - (lastScrollAt || now));
			const dy = Math.abs(top - lastScrollTop);
			if (dy > 0.5) {
				const v = dy / dt;
				velocityEma = velocityEma * 0.55 + v * 0.45;
				// Fast fling → longer grace so stick-to-live / restore don't fight inertia
				const grace =
					velocityEma > 2.5 ? 1400
						: velocityEma > 1.0 ? 1000
							: velocityEma > 0.35 ? 700
								: 500;
				userScrollUntil = Date.now() + grace;
			}
			lastScrollTop = top;
			lastScrollAt = now;
		},
		setLastScrollTop(top: number) {
			lastScrollTop = top;
			lastScrollAt = performance.now();
		},
		/** True while user scroll grace window is active */
		get blocked() {
			return Date.now() < userScrollUntil;
		},
		get until() {
			return userScrollUntil;
		},
		/** Recent fling speed (px/ms EMA) — for pause/throttle decisions */
		get velocity() {
			return velocityEma;
		},
		/** Decay velocity when idle (call from rAF if needed) */
		idleTick() {
			if (Date.now() >= userScrollUntil) {
				velocityEma *= 0.85;
				if (velocityEma < 0.05) velocityEma = 0;
			}
		},
	};
}

/**
 * Coalesce multiple scroll restorations into one rAF (history prefetch bursts).
 */
export function createScrollRestoreCoalescer() {
	let pending: (() => void) | null = null;
	let raf = 0;

	return {
		schedule(fn: () => void) {
			pending = fn;
			if (raf) return;
			raf = requestAnimationFrame(() => {
				raf = 0;
				const job = pending;
				pending = null;
				job?.();
			});
		},
		cancel() {
			if (raf) cancelAnimationFrame(raf);
			raf = 0;
			pending = null;
		},
	};
}

/**
 * Page-level scroll (PageWithHeader _pageScrollable) save/restore.
 * Used when chat pane is hidden via v-show and scrollHeight collapses.
 */
export function createPageScrollMemory(getContainer: () => HTMLElement | null) {
	let savedTop: number | null = null;

	return {
		save() {
			const sc = getContainer();
			if (sc) savedTop = sc.scrollTop;
		},
		/**
		 * Restore after DOM shows the tall timeline again.
		 * Applies in nextTick + rAF (caller supplies nextTick).
		 */
		restore(schedule: (fn: () => void) => void) {
			const top = savedTop;
			if (top == null) return;
			const apply = () => {
				const sc = getContainer();
				if (!sc) return;
				sc.scrollTop = top;
				// Layout (footer / sticky header) may settle one frame later
				requestAnimationFrame(() => {
					const sc2 = getContainer();
					if (sc2) sc2.scrollTop = top;
				});
			};
			schedule(apply);
		},
		get saved() {
			return savedTop;
		},
	};
}
