<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div class="_spacer" style="--MI_SPACER-w: 700px; --MI_SPACER-min: 16px; --MI_SPACER-max: 32px;">
	<div class="_gaps">
		<MkInfo>{{ t('info') }}</MkInfo>
		<MkInfo v-if="!allowUserKey" warn>{{ t('userKeyDisabled') }}</MkInfo>

		<FormSection>
			<template #label>{{ t('prefs') }}</template>
			<div class="_gaps">
				<MkInput v-model="targetLang">
					<template #label>{{ t('targetLang') }}</template>
					<template #caption>{{ t('targetLangCaption') }}</template>
				</MkInput>
				<MkSwitch v-model="selective">
					<template #label>{{ t('selective') }}</template>
					<template #caption>{{ t('selectiveCaption') }}</template>
				</MkSwitch>
			</div>
		</FormSection>

		<FormSection v-if="allowUserKey">
			<template #label>{{ t('ownKey') }}</template>
			<div class="_gaps">
				<MkInfo>{{ t('ownKeyInfo') }}</MkInfo>
				<MkInput v-model="baseUrl" type="url">
					<template #label>{{ t('baseUrl') }}</template>
					<template #caption>{{ t('baseUrlCaption') }}</template>
				</MkInput>
				<MkInput v-model="apiKey" type="password">
					<template #label>{{ t('apiKey') }}{{ hasApiKey ? ` (${t('keySaved')})` : '' }}</template>
					<template #caption>{{ t('apiKeyCaption') }}</template>
				</MkInput>
				<MkInput v-model="model">
					<template #label>{{ t('model') }}</template>
				</MkInput>
				<MkSwitch v-model="preferLocal">
					<template #label>{{ t('preferLocal') }}</template>
					<template #caption>{{ t('preferLocalCaption') }}</template>
				</MkSwitch>
				<div class="_buttons">
					<MkButton primary @click="saveLocal">{{ t('saveLocal') }}</MkButton>
					<MkButton danger :disabled="!hasApiKey && !baseUrl" @click="clearLocal">{{ t('clearKey') }}</MkButton>
				</div>
			</div>
		</FormSection>

		<div class="_buttons">
			<MkButton primary @click="savePrefs">{{ i18n.ts.save }}</MkButton>
		</div>
	</div>
</div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { instance } from '@/instance.js';
import { $i } from '@/i.js';
import { updateCurrentAccount } from '@/accounts.js';
import MkInput from '@/components/MkInput.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkButton from '@/components/MkButton.vue';
import MkInfo from '@/components/MkInfo.vue';
import FormSection from '@/components/form/section.vue';
import {
	loadAiTranslationLocal,
	saveAiTranslationLocal,
	clearAiTranslationLocalKey,
} from '@/utility/ai-translation-local.js';

const L = (i18n.ts as any)._aiTranslationSettings ?? {};
function t(key: string): string {
	const v = L[key];
	return typeof v === 'string' && v.length ? v : key;
}


const pageTitle = computed(() => t('title'));
const allowUserKey = computed(() => (instance as any).aiTranslationPublic?.allowUserApiKey === true);

const cfg = ($i as any)?.aiTranslationConfig ?? {};
const targetLang = ref(cfg.targetLang ?? '');
const selective = ref(
	typeof cfg.selective === 'boolean'
		? cfg.selective
		: ((instance as any).aiTranslationPublic?.selectiveByDefault !== false),
);

const local = loadAiTranslationLocal();
const baseUrl = ref(local.baseUrl);
const apiKey = ref('');
const model = ref(local.model);
const preferLocal = ref(local.preferLocal);
const hasApiKey = ref(!!local.apiKey);

async function savePrefs() {
	const updated = await os.apiWithDialog('i/update', {
		aiTranslationConfig: {
			targetLang: targetLang.value?.trim() ? targetLang.value.trim() : null,
			selective: selective.value,
		},
	});
	if (updated) updateCurrentAccount(updated);
}

function saveLocal() {
	const next = saveAiTranslationLocal({
		baseUrl: baseUrl.value,
		apiKey: apiKey.value && apiKey.value !== '<redacted>' ? apiKey.value : undefined,
		model: model.value,
		preferLocal: preferLocal.value,
	});
	hasApiKey.value = !!next.apiKey;
	apiKey.value = '';
	baseUrl.value = next.baseUrl;
	model.value = next.model;
	os.success();
	os.alert({ type: 'success', text: t('localSaved') });
}

async function clearLocal() {
	const { canceled } = await os.confirm({ type: 'warning', text: t('clearKey') });
	if (canceled) return;
	clearAiTranslationLocalKey();
	saveAiTranslationLocal({ baseUrl: '', model: 'gpt-4o-mini', apiKey: '__clear__', preferLocal: true });
	baseUrl.value = '';
	model.value = 'gpt-4o-mini';
	preferLocal.value = true;
	hasApiKey.value = false;
	apiKey.value = '';
	os.alert({ type: 'success', text: t('localCleared') });
}

definePage(() => ({
	title: pageTitle.value,
	icon: 'ti ti-language',
}));
</script>
