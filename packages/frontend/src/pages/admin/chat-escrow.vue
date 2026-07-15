<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 700px; --MI_SPACER-min: 16px; --MI_SPACER-max: 32px;">
		<div class="_gaps">
			<MkInfo>
				{{ t.scope }}
			</MkInfo>
			<MkInfo warn>
				{{ t.warn }}
			</MkInfo>

			<div v-if="loading" class="_fullinfo">
				<MkLoading/>
			</div>

			<template v-else>
				<!-- Primary on/off switch (always visible) -->
				<div class="_panel" style="padding: 16px;">
					<div class="_gaps">
						<MkSwitch v-model="enabledDraft" :disabled="busy" @update:modelValue="onToggleEnabled">
							<template #label>{{ t.enable }}</template>
							<template #caption>{{ t.enableCaption }}</template>
						</MkSwitch>
						<div style="font-size: 0.9em; opacity: 0.85;">
							<span v-if="status.enabled && status.operational" style="color: var(--MI_THEME-accent);">
								{{ t.statusOn }}
							</span>
							<span v-else-if="status.enabled && !status.operational">
								{{ t.statusNeedKey }}
							</span>
							<span v-else>
								{{ t.statusOff }}
							</span>
						</div>
					</div>
				</div>

				<MkFolder :defaultOpen="true">
					<template #icon><i class="ti ti-lock"></i></template>
					<template #label>{{ t.title }}</template>
					<template #suffix>{{ status.enabled ? i18n.ts.enabled : i18n.ts.disabled }}</template>

					<div class="_gaps">
						<div v-if="status.hasConfigFallback" style="opacity: 0.85; font-size: 0.9em;">
							{{ t.configFallback }}
						</div>

						<div class="_buttons">
							<MkButton primary :disabled="busy" @click="rotate">
								<i class="ti ti-refresh"></i> {{ t.rotate }}
							</MkButton>
							<MkButton :disabled="busy" @click="refresh">
								<i class="ti ti-reload"></i> {{ i18n.ts.reload }}
							</MkButton>
						</div>

						<div v-if="lastGenerated" class="_panel" style="padding: 12px;">
							<div style="font-weight: bold; margin-bottom: 8px;">{{ t.newSecretTitle }}</div>
							<div style="margin-bottom: 8px; opacity: 0.85; font-size: 0.9em;">{{ t.newSecretHint }}</div>
							<code style="word-break: break-all; display: block; margin-bottom: 8px;">{{ lastGenerated.secret }}</code>
							<div style="margin-bottom: 8px;">ID: <code>{{ lastGenerated.keyId }}</code></div>
							<div class="_buttons">
								<MkButton @click="copySecret"><i class="ti ti-copy"></i> {{ i18n.ts.copy }}</MkButton>
								<MkButton @click="lastGenerated = null">{{ i18n.ts.close }}</MkButton>
							</div>
						</div>
					</div>
				</MkFolder>

				<MkFolder :defaultOpen="true">
					<template #icon><i class="ti ti-key"></i></template>
					<template #label>{{ t.keyRing }}</template>
					<template #suffix>{{ status.keys.length }}</template>

					<div class="_gaps_s">
						<div v-if="status.keys.length === 0" style="opacity: 0.75;">
							{{ t.noKeys }}
						</div>
						<div
							v-for="k in status.keys"
							:key="k.id"
							class="_panel"
							style="padding: 12px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between;"
						>
							<div style="min-width: 0;">
								<div style="font-weight: 600;">
									<code>{{ k.id }}</code>
									<span v-if="k.active" style="margin-left: 8px; color: var(--MI_THEME-accent);">{{ t.active }}</span>
								</div>
								<div style="opacity: 0.75; font-size: 0.85em; margin-top: 4px;">
									{{ t.fingerprint }}: {{ k.fingerprint }}
								</div>
								<div style="opacity: 0.6; font-size: 0.8em; margin-top: 2px;">
									{{ k.createdAt }}
								</div>
							</div>
							<div class="_buttons">
								<MkButton
									v-if="!k.active && k.id !== 'cfg'"
									danger
									:disabled="busy"
									@click="retire(k.id)"
								>
									{{ t.retire }}
								</MkButton>
							</div>
						</div>
					</div>
				</MkFolder>
			</template>
		</div>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { copyToClipboard } from '@/utility/copy-to-clipboard.js';
import MkButton from '@/components/MkButton.vue';
import MkFolder from '@/components/MkFolder.vue';
import MkInfo from '@/components/MkInfo.vue';
import MkSwitch from '@/components/MkSwitch.vue';

const CE = (i18n.ts as any)._chatEscrow ?? {};
const t = new Proxy(CE as Record<string, string>, {
	get(target, prop: string) {
		const v = target[prop];
		return typeof v === 'string' && v.length ? v : prop;
	},
}) as Record<string, string>;


type KeyInfo = {
	id: string;
	fingerprint: string;
	createdAt: string;
	active: boolean;
};

type Status = {
	enabled: boolean;
	operational?: boolean;
	activeKeyId: string | null;
	hasConfigFallback: boolean;
	keys: KeyInfo[];
	generatedSecret?: string | null;
	generatedKeyId?: string | null;
};

const loading = ref(true);
const busy = ref(false);
const status = ref<Status>({
	enabled: false,
	operational: false,
	activeKeyId: null,
	hasConfigFallback: false,
	keys: [],
});
const enabledDraft = ref(false);
const lastGenerated = ref<{ secret: string; keyId: string } | null>(null);

async function call(action: string, body: Record<string, unknown> = {}) {
	return await misskeyApi('admin/chat-escrow' as any, { action, ...body } as any) as Status;
}

function applyStatus(s: Status) {
	status.value = s;
	enabledDraft.value = s.enabled;
}

async function refresh() {
	loading.value = true;
	try {
		applyStatus(await call('get'));
	} catch (e: any) {
		os.alert({ type: 'error', text: e?.message || String(e) });
	} finally {
		loading.value = false;
	}
}

async function onToggleEnabled(v: boolean) {
	busy.value = true;
	try {
		applyStatus(await call('setEnabled', { enabled: v }));
		os.success();
	} catch (e: any) {
		enabledDraft.value = status.value.enabled;
		os.alert({ type: 'error', text: e?.message || String(e) });
	} finally {
		busy.value = false;
	}
}

async function rotate() {
	const { canceled } = await os.confirm({
		type: 'warning',
		text: t.rotateConfirm || 'Rotate key?',
	});
	if (canceled) return;
	busy.value = true;
	try {
		const s = await call('rotate');
		applyStatus(s);
		if (s.generatedSecret && s.generatedKeyId) {
			lastGenerated.value = { secret: s.generatedSecret, keyId: s.generatedKeyId };
		}
		os.success();
	} catch (e: any) {
		os.alert({ type: 'error', text: e?.message || String(e) });
	} finally {
		busy.value = false;
	}
}

async function retire(keyId: string) {
	const { canceled } = await os.confirm({
		type: 'warning',
		text: (t.retireConfirm || 'Retire key?') + (keyId ? ` (${keyId})` : ''),
	});
	if (canceled) return;
	busy.value = true;
	try {
		applyStatus(await call('retire', { keyId }));
		os.success();
	} catch (e: any) {
		os.alert({ type: 'error', text: e?.message || String(e) });
	} finally {
		busy.value = false;
	}
}

function copySecret() {
	if (!lastGenerated.value) return;
	copyToClipboard(lastGenerated.value.secret);
}

onMounted(() => {
	void refresh();
});

const headerTabs = computed(() => []);

definePage(() => ({
	title: t.title,
	icon: 'ti ti-message-2-lock',
}));
</script>
