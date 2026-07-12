<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<!--
  Lazy mount for chat rows: keep a light placeholder until near viewport,
  then async-mount XMessage (reduces DOM/media cost for long histories).
-->
<template>
<div
	ref="rootEl"
	:class="[$style.root, { [$style.mounted]: mounted }]"
	:style="placeholderStyle"
>
	<XMessage
		v-if="mounted"
		:message="message"
		:highlighted="highlighted"
		@reply="(m) => emit('reply', m)"
		@scrollToReply="(id) => emit('scrollToReply', id)"
	/>
	<div v-else :class="$style.placeholder" aria-hidden="true">
		<div :class="$style.phAvatar"/>
		<div :class="$style.phBody">
			<div :class="$style.phLine"/>
			<div :class="[$style.phLine, $style.phLineShort]"/>
		</div>
	</div>
</div>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue';
import type { NormalizedChatMessage } from './room.vue';
import XMessage from './XMessage.vue';

const props = defineProps<{
	message: NormalizedChatMessage;
	highlighted?: boolean;
	/** Always mount (e.g. pinned / jump target) */
	forceMount?: boolean;
	/** Estimated height before real content measures */
	estimateHeight?: number;
}>();

const emit = defineEmits<{
	(ev: 'reply', message: NormalizedChatMessage): void;
	(ev: 'scrollToReply', id: string): void;
}>();

const rootEl = useTemplateRef<HTMLElement>('rootEl');
const mounted = ref(!!props.forceMount);
const measuredH = shallowRef(0);

const placeholderStyle = computed(() => {
	if (mounted.value && measuredH.value > 0) return undefined;
	const h = measuredH.value || props.estimateHeight || 72;
	return mounted.value ? undefined : { minHeight: `${h}px` };
});

let io: IntersectionObserver | null = null;
let unmountTimer: ReturnType<typeof setTimeout> | null = null;

function setupIo() {
	io?.disconnect();
	io = null;
	if (props.forceMount) {
		mounted.value = true;
		return;
	}
	const el = rootEl.value;
	if (!el || typeof IntersectionObserver === 'undefined') {
		mounted.value = true;
		return;
	}

	// Find scroll root if any
	let root: Element | null = null;
	let p: HTMLElement | null = el.parentElement;
	while (p) {
		const oy = getComputedStyle(p).overflowY;
		if (oy === 'auto' || oy === 'scroll') {
			root = p;
			break;
		}
		p = p.parentElement;
	}

	io = new IntersectionObserver((entries) => {
		for (const e of entries) {
			if (e.isIntersecting) {
				if (unmountTimer) {
					clearTimeout(unmountTimer);
					unmountTimer = null;
				}
				mounted.value = true;
			} else if (mounted.value && !props.forceMount && !props.highlighted) {
				// Far off-screen: free heavy VNodes/media after a delay
				if (unmountTimer) clearTimeout(unmountTimer);
				unmountTimer = setTimeout(() => {
					const r = el.getBoundingClientRect();
					const margin = 800;
					if (r.bottom < -margin || r.top > window.innerHeight + margin) {
						// Remember height so scroll doesn't collapse
						measuredH.value = Math.max(el.offsetHeight, measuredH.value || 0);
						mounted.value = false;
					}
				}, 1200);
			}
		}
	}, {
		root: root ?? null,
		// Prefetch a screen above/below
		rootMargin: '200% 0px',
		threshold: 0,
	});
	io.observe(el);
}

watch(() => props.forceMount, (v) => {
	if (v) mounted.value = true;
});

watch(() => props.highlighted, (v) => {
	if (v) mounted.value = true;
});

onMounted(() => {
	setupIo();
});

onBeforeUnmount(() => {
	io?.disconnect();
	io = null;
	if (unmountTimer) clearTimeout(unmountTimer);
});
</script>

<style lang="scss" module>
.root {
	width: 100%;
}

.placeholder {
	display: flex;
	gap: 12px;
	padding: 6px 0;
	opacity: 0.35;
	pointer-events: none;
}

.phAvatar {
	width: 42px;
	height: 42px;
	border-radius: 999px;
	background: var(--MI_THEME-divider);
	flex-shrink: 0;
}

.phBody {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding-top: 4px;
}

.phLine {
	height: 12px;
	border-radius: 6px;
	background: var(--MI_THEME-divider);
	width: 70%;
}

.phLineShort {
	width: 40%;
}
</style>
