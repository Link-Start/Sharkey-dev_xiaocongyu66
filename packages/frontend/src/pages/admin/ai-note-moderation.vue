<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :actions="headerActions" :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 700px; --MI_SPACER-min: 16px; --MI_SPACER-max: 32px;">
		<div class="_gaps">
			<MkFolder :defaultOpen="true">
				<template #icon><i class="ti ti-robot"></i></template>
				<template #label>{{ t('title') }}</template>
				<template v-if="form.savedState.enableLocalNotes || form.savedState.enableRemoteNotes" #suffix>{{ t('on') }}</template>
				<template v-else #suffix>{{ t('off') }}</template>
				<template v-if="form.modified.value" #footer>
					<MkFormFooter :form="form"/>
				</template>

				<div class="_gaps">
					<MkInfo>{{ t('info') }}</MkInfo>

					<MkSwitch v-model="form.state.enableLocalNotes">
						<template #label>{{ t('enableLocal') }}<span v-if="form.modifiedStates.enableLocalNotes" class="_modified">{{ i18n.ts.modified }}</span></template>
						<template #caption>{{ t('enableLocalCaption') }}</template>
					</MkSwitch>

					<MkSwitch v-model="form.state.enableRemoteNotes">
						<template #label>{{ t('enableRemote') }}<span v-if="form.modifiedStates.enableRemoteNotes" class="_modified">{{ i18n.ts.modified }}</span></template>
						<template #caption>{{ t('enableRemoteCaption') }}</template>
					</MkSwitch>

					<MkInput v-model="form.state.baseUrl" type="url">
						<template #label>{{ t('baseUrl') }}<span v-if="form.modifiedStates.baseUrl" class="_modified">{{ i18n.ts.modified }}</span></template>
						<template #caption>{{ t('baseUrlCaption') }}</template>
					</MkInput>

					<MkInput v-model="form.state.apiKey" type="password">
						<template #label>{{ t('apiKey') }}<span v-if="form.modifiedStates.apiKey" class="_modified">{{ i18n.ts.modified }}</span></template>
						<template #caption>{{ t('apiKeyCaption') }}</template>
					</MkInput>

					<MkInput v-model="form.state.model">
						<template #label>{{ t('model') }}<span v-if="form.modifiedStates.model" class="_modified">{{ i18n.ts.modified }}</span></template>
						<template #caption>{{ t('modelCaption') }}</template>
					</MkInput>

					<MkSelect v-model="form.state.apiStyle">
						<template #label>{{ t('apiStyle') }}<span v-if="form.modifiedStates.apiStyle" class="_modified">{{ i18n.ts.modified }}</span></template>
						<option value="auto">{{ t('apiStyleAuto') }}</option>
						<option value="chat.completions">chat/completions</option>
						<option value="responses">responses</option>
					</MkSelect>

					<MkSelect v-model="form.state.action">
						<template #label>{{ t('action') }}<span v-if="form.modifiedStates.action" class="_modified">{{ i18n.ts.modified }}</span></template>
						<option value="reject">{{ t('actionReject') }}</option>
						<option value="cw">{{ t('actionCw') }}</option>
						<option value="hide">{{ t('actionHide') }}</option>
						<option value="home">{{ t('actionHome') }}</option>
					</MkSelect>

					<MkInput v-model="form.state.requestTimeoutMs" type="number">
						<template #label>{{ t('timeout') }}<span v-if="form.modifiedStates.requestTimeoutMs" class="_modified">{{ i18n.ts.modified }}</span></template>
					</MkInput>

					<MkSwitch v-model="form.state.failOpen">
						<template #label>{{ t('failOpen') }}<span v-if="form.modifiedStates.failOpen" class="_modified">{{ i18n.ts.modified }}</span></template>
						<template #caption>{{ t('failOpenCaption') }}</template>
					</MkSwitch>

					<MkTextarea v-model="form.state.systemPrompt">
						<template #label>{{ t('systemPrompt') }}<span v-if="form.modifiedStates.systemPrompt" class="_modified">{{ i18n.ts.modified }}</span></template>
						<template #caption>{{ t('systemPromptCaption') }}</template>
					</MkTextarea>
				</div>
			</MkFolder>
		</div>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { fetchInstance } from '@/instance.js';
import { i18n } from '@/i18n.js';
import { miLocalStorage } from '@/local-storage.js';
import { definePage } from '@/page.js';
import MkFolder from '@/components/MkFolder.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkInput from '@/components/MkInput.vue';
import MkSelect from '@/components/MkSelect.vue';
import MkTextarea from '@/components/MkTextarea.vue';
import MkInfo from '@/components/MkInfo.vue';
import { useForm } from '@/use/use-form.js';
import MkFormFooter from '@/components/MkFormFooter.vue';

type LangPack = { en: string; zh: string; 'zh-TW'?: string; ja?: string };

const FB: Record<string, LangPack> = {
	title: { en: 'AI note moderation', zh: '帖子 AI 审核', 'zh-TW': '貼文 AI 審核', ja: 'ノートAI審査' },
	on: { en: 'On', zh: '开启', 'zh-TW': '開啟', ja: 'オン' },
	off: { en: 'Off', zh: '关闭', 'zh-TW': '關閉', ja: 'オフ' },
	info: {
		en: 'Uses any OpenAI-compatible /v1 API (OpenAI, xAI/Grok, local gateways, etc.). Separate switches for local and remote notes.',
		zh: '兼容任意 OpenAI /v1 接口（OpenAI、xAI/Grok、自建网关等）。本地帖与远程帖可分别开关。',
		'zh-TW': '相容任意 OpenAI /v1 介面。本機與遠端貼文可分別開關。',
		ja: 'OpenAI互換 /v1 API を利用。ローカル/リモートノートを個別に有効化できます。',
	},
	enableLocal: { en: 'Moderate local notes', zh: '审核本地帖子', 'zh-TW': '審核本機貼文', ja: 'ローカルノートを審査' },
	enableLocalCaption: {
		en: 'When on, notes from users on this instance are checked before publish.',
		zh: '开启后，本站用户发帖/改帖前会调用 AI 审核。',
		'zh-TW': '開啟後，本站使用者發文/改文前會呼叫 AI 審核。',
		ja: '有効にすると、このインスタンスのユーザーの投稿前にAI審査します。',
	},
	enableRemote: { en: 'Moderate remote notes', zh: '审核远程帖子', 'zh-TW': '審核遠端貼文', ja: 'リモートノートを審査' },
	enableRemoteCaption: {
		en: 'When on, federated notes are checked on ingest (may slow federation).',
		zh: '开启后，联合进来的远程帖会在入库时审核（可能拖慢联邦）。',
		'zh-TW': '開啟後，聯邦進來的遠端貼文會在入庫時審核。',
		ja: '有効にすると、連合で受信したノートを取り込み時に審査します。',
	},
	baseUrl: { en: 'API base URL', zh: 'API 基址', 'zh-TW': 'API 基址', ja: 'APIベースURL' },
	baseUrlCaption: {
		en: 'OpenAI-compatible base, e.g. https://api.openai.com/v1 or https://api.x.ai/v1 ( /v1 is appended if missing ).',
		zh: 'OpenAI 兼容基址，例如 https://api.openai.com/v1 或 https://api.x.ai/v1（无 /v1 会自动补上）。',
		'zh-TW': 'OpenAI 相容基址，例如 https://api.openai.com/v1 。',
		ja: '例: https://api.openai.com/v1 / https://api.x.ai/v1 （/v1 が無ければ付与）',
	},
	apiKey: { en: 'API key', zh: 'API 密钥', 'zh-TW': 'API 金鑰', ja: 'APIキー' },
	apiKeyCaption: {
		en: 'Leave blank when saving to keep the current key. Never share this value.',
		zh: '留空保存可保留原密钥。请勿泄露。',
		'zh-TW': '留空儲存可保留原金鑰。',
		ja: '空のまま保存すると既存キーを維持します。',
	},
	model: { en: 'Model', zh: '模型', 'zh-TW': '模型', ja: 'モデル' },
	modelCaption: {
		en: 'Provider model id, e.g. gpt-4o-mini, grok-4.5',
		zh: '提供商模型 ID，如 gpt-4o-mini、grok-4.5',
		'zh-TW': '供應商模型 ID',
		ja: 'モデルID（例: gpt-4o-mini）',
	},
	apiStyle: { en: 'API style', zh: '接口类型', 'zh-TW': '介面類型', ja: 'API形式' },
	apiStyleAuto: { en: 'Auto (chat/completions → responses)', zh: '自动（先 chat/completions，失败再 responses）', 'zh-TW': '自動', ja: '自動' },
	action: { en: 'Action when flagged', zh: '判定违规时的处理', 'zh-TW': '判定違規時的處理', ja: 'フラグ時の動作' },
	actionReject: { en: 'Reject (block post)', zh: '拒绝发布', 'zh-TW': '拒絕發佈', ja: '投稿拒否' },
	actionCw: { en: 'Force content warning', zh: '强制内容警告 (CW)', 'zh-TW': '強制內容警告', ja: 'CW を付与' },
	actionHide: { en: 'Soft-hide note', zh: '软隐藏帖子', 'zh-TW': '軟隱藏貼文', ja: 'ソフト非表示' },
	actionHome: { en: 'Downgrade public → home', zh: '公开降级为首页可见', 'zh-TW': '公開降為首頁可見', ja: 'public を home に' },
	timeout: { en: 'Timeout (ms)', zh: '超时 (毫秒)', 'zh-TW': '逾時 (毫秒)', ja: 'タイムアウト (ms)' },
	failOpen: { en: 'Fail open on API error', zh: 'API 失败时放行', 'zh-TW': 'API 失敗時放行', ja: 'API失敗時は通す' },
	failOpenCaption: {
		en: 'If off, posts are blocked when the AI endpoint is unreachable.',
		zh: '关闭后，AI 接口不可用时会拦截发帖。',
		'zh-TW': '關閉後，AI 介面不可用時會攔截發文。',
		ja: 'オフにするとAI不通時に投稿を拒否します。',
	},
	systemPrompt: { en: 'Custom system prompt (optional)', zh: '自定义系统提示（可选）', 'zh-TW': '自訂系統提示（可選）', ja: 'システムプロンプト（任意）' },
	systemPromptCaption: {
		en: 'Leave empty to use the built-in JSON classifier prompt.',
		zh: '留空使用内置 JSON 分类提示词。',
		'zh-TW': '留空使用內建提示。',
		ja: '空なら内蔵プロンプトを使用',
	},
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

const meta = await misskeyApi('admin/meta') as any;
const cfg = meta.aiNoteModerationConfig ?? {};

const form = useForm({
	enableLocalNotes: cfg.enableLocalNotes === true,
	enableRemoteNotes: cfg.enableRemoteNotes === true,
	baseUrl: cfg.baseUrl ?? '',
	apiKey: '',
	model: cfg.model ?? 'gpt-4o-mini',
	apiStyle: cfg.apiStyle ?? 'auto',
	action: cfg.action ?? 'reject',
	requestTimeoutMs: cfg.requestTimeoutMs ?? 8000,
	failOpen: cfg.failOpen !== false,
	systemPrompt: cfg.systemPrompt ?? '',
}, async (state) => {
	const payload: any = {
		enableLocalNotes: state.enableLocalNotes,
		enableRemoteNotes: state.enableRemoteNotes,
		baseUrl: state.baseUrl?.trim() ? state.baseUrl.trim() : null,
		model: state.model?.trim() || 'gpt-4o-mini',
		apiStyle: state.apiStyle,
		action: state.action,
		requestTimeoutMs: Number(state.requestTimeoutMs) || 8000,
		failOpen: state.failOpen,
		systemPrompt: state.systemPrompt?.trim() ? state.systemPrompt.trim() : null,
	};
	// Only send apiKey when user typed a new one (empty keeps previous)
	if (state.apiKey && state.apiKey !== '<redacted>') {
		payload.apiKey = state.apiKey;
	}
	await os.apiWithDialog('admin/update-meta', {
		aiNoteModerationConfig: payload,
	});
	// clear password field after save so we don't re-send
	form.state.apiKey = '';
	await fetchInstance(true);
});

const headerActions = computed(() => []);
const headerTabs = computed(() => []);

definePage(() => ({
	title: t('title'),
	icon: 'ti ti-robot',
}));
</script>
