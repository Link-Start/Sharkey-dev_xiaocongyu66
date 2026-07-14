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
import { miLocalStorage } from '@/local-storage.js';
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

type LangPack = { en: string; zh: string; 'zh-TW'?: string; ja?: string };

const FB: Record<string, LangPack> = {
	title: { en: 'AI translation', zh: 'AI 翻译', 'zh-TW': 'AI 翻譯', ja: 'AI翻訳' },
	info: {
		en: 'Language prefs sync to your account. Optional API key/base URL stay only on this device and are never sent to the server.',
		zh: '目标语言等偏好会同步到账号。可选的 API 基址/密钥只保存在本机，不会上传到服务器。',
		'zh-TW': '語言偏好會同步到帳號。API 基址/金鑰僅保存在本機，不會上傳伺服器。',
		ja: '言語設定はアカウントに同期。APIキー/ベースURLは端末のみ（サーバー非送信）。',
	},
	userKeyDisabled: {
		en: 'This instance does not allow local user AI endpoints. Instance-level translation still works if configured.',
		zh: '本站未开放用户本地 AI 端点。若管理员已配置实例翻译，仍可使用。',
		'zh-TW': '本站未開放本機 AI 端點。',
		ja: 'このサーバーはローカルAI端点を許可していません。',
	},
	prefs: { en: 'Preferences (synced)', zh: '偏好（同步到账号）', 'zh-TW': '偏好（同步）', ja: '設定（同期）' },
	targetLang: { en: 'Target language', zh: '目标语言', 'zh-TW': '目標語言', ja: '翻訳先言語' },
	targetLangCaption: {
		en: 'BCP-47 code, e.g. zh-CN, en, ja. Empty = use UI language.',
		zh: '语言代码，如 zh-CN、en、ja。留空则使用界面语言。',
		'zh-TW': '語言代碼，如 zh-TW、en。留空使用介面語言。',
		ja: '例: ja, en, zh-CN。空ならUI言語。',
	},
	selective: { en: 'Selective translation', zh: '选择性翻译', 'zh-TW': '選擇性翻譯', ja: '選択的翻訳' },
	selectiveCaption: {
		en: 'Only translate parts not already in the target language.',
		zh: '只翻译非目标语言部分（中英混排时只译外文）。',
		'zh-TW': '只翻譯非目標語言部分。',
		ja: '目標言語以外の部分だけ翻訳。',
	},
	ownKey: { en: 'Local AI endpoint (this device only)', zh: '本机 AI 端点（仅此设备）', 'zh-TW': '本機 AI 端點（僅此裝置）', ja: 'ローカルAI（この端末のみ）' },
	ownKeyInfo: {
		en: 'Stored in browser localStorage only. The server never receives or uses these credentials. Requests go from your browser to your API host.',
		zh: '仅保存在浏览器 localStorage。服务器不会接收或使用这些凭据。请求由你的浏览器直连你的 API。',
		'zh-TW': '僅存於瀏覽器 localStorage。伺服器不會接收或使用。',
		ja: 'ブラウザのlocalStorageのみ。サーバーは受信・使用しません。',
	},
	baseUrl: { en: 'API base URL', zh: 'API 基址', 'zh-TW': 'API 基址', ja: 'APIベースURL' },
	baseUrlCaption: {
		en: 'e.g. https://api.openai.com/v1 or https://api.x.ai/v1',
		zh: '例如 https://api.openai.com/v1 或 https://api.x.ai/v1',
		'zh-TW': '例如 https://api.openai.com/v1',
		ja: '例: https://api.openai.com/v1',
	},
	apiKey: { en: 'API key', zh: 'API 密钥', 'zh-TW': 'API 金鑰', ja: 'APIキー' },
	apiKeyCaption: {
		en: 'Leave blank when saving to keep the existing local key.',
		zh: '留空保存可保留本机已有密钥。',
		'zh-TW': '留空儲存可保留本機金鑰。',
		ja: '空なら既存のローカルキーを維持。',
	},
	keySaved: { en: 'saved locally', zh: '已保存在本机', 'zh-TW': '已保存在本機', ja: '端末に保存済み' },
	model: { en: 'Model', zh: '模型', 'zh-TW': '模型', ja: 'モデル' },
	preferLocal: { en: 'Prefer local endpoint', zh: '优先使用本机端点', 'zh-TW': '優先使用本機端點', ja: 'ローカルを優先' },
	preferLocalCaption: {
		en: 'When on, translation uses your local API first; falls back to the instance if local fails or is empty.',
		zh: '开启后翻译优先走本机 API；失败或未配置时回退实例翻译。',
		'zh-TW': '開啟後優先本機 API，失敗則回退站點。',
		ja: 'オンならローカルAPI優先、失敗時はインスタンスにフォールバック。',
	},
	saveLocal: { en: 'Save on this device', zh: '保存到本机', 'zh-TW': '儲存到本機', ja: 'この端末に保存' },
	clearKey: { en: 'Clear local credentials', zh: '清除本机凭据', 'zh-TW': '清除本機憑證', ja: 'ローカル認証情報を削除' },
	localSaved: { en: 'Saved on this device only.', zh: '已仅保存到本机。', 'zh-TW': '已僅儲存到本機。', ja: 'この端末のみに保存しました。' },
	localCleared: { en: 'Local credentials cleared.', zh: '已清除本机凭据。', 'zh-TW': '已清除本機憑證。', ja: 'ローカル認証情報を削除しました。' },
};

function t(key: keyof typeof FB): string {
	const fb = FB[key];
	const lang = (
		miLocalStorage.getItem('lang')
		|| (typeof navigator !== 'undefined' ? navigator.language : 'en-US')
		|| 'en-US'
	).replace('_', '-').toLowerCase();
	if (lang.startsWith('zh-tw') || lang.startsWith('zh-hk') || lang.startsWith('zh-hant')) {
		return fb['zh-TW'] || fb.zh;
	}
	if (lang.startsWith('zh')) return fb.zh;
	if (lang.startsWith('ja') && fb.ja) return fb.ja;
	return fb.en;
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
