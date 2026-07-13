<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :actions="headerActions" :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 700px; --MI_SPACER-min: 16px; --MI_SPACER-max: 32px;">
		<div class="_gaps">
			<div class="_panel" style="padding: 16px;">
				<MkSwitch v-model="enableServerMachineStats" @change="onChange_enableServerMachineStats">
					<template #label>{{ i18n.ts.enableServerMachineStats }}</template>
					<template #caption>{{ i18n.ts.turnOffToImprovePerformance }}</template>
				</MkSwitch>
			</div>

			<div class="_panel" style="padding: 16px;">
				<MkSwitch v-model="enableIdenticonGeneration" @change="onChange_enableIdenticonGeneration">
					<template #label>{{ i18n.ts.enableIdenticonGeneration }}</template>
					<template #caption>{{ i18n.ts.turnOffToImprovePerformance }}</template>
				</MkSwitch>
			</div>

			<div class="_panel" style="padding: 16px;">
				<MkSwitch v-model="enableChartsForRemoteUser" @change="onChange_enableChartsForRemoteUser">
					<template #label>{{ i18n.ts.enableChartsForRemoteUser }}</template>
					<template #caption>{{ i18n.ts.turnOffToImprovePerformance }}</template>
				</MkSwitch>
			</div>

			<div class="_panel" style="padding: 16px;">
				<MkSwitch v-model="enableStatsForFederatedInstances" @change="onChange_enableStatsForFederatedInstances">
					<template #label>{{ i18n.ts.enableStatsForFederatedInstances }}</template>
					<template #caption>{{ i18n.ts.turnOffToImprovePerformance }}</template>
				</MkSwitch>
			</div>

			<div class="_panel" style="padding: 16px;">
				<MkSwitch v-model="enableChartsForFederatedInstances" @change="onChange_enableChartsForFederatedInstances">
					<template #label>{{ i18n.ts.enableChartsForFederatedInstances }}</template>
					<template #caption>{{ i18n.ts.turnOffToImprovePerformance }}</template>
				</MkSwitch>
			</div>

			<MkFolder :defaultOpen="true">
				<template #icon><i class="ti ti-bolt"></i></template>
				<template #label>{{ tPerf('fttTitle') }}</template>
				<template v-if="fttForm.savedState.enableFanoutTimeline" #suffix>{{ tPerf('enabled') }}</template>
				<template v-else #suffix>{{ tPerf('disabled') }}</template>
				<template v-if="fttForm.modified.value" #footer>
					<MkFormFooter :form="fttForm"/>
				</template>

				<div class="_gaps">
					<MkSwitch v-model="fttForm.state.enableFanoutTimeline">
						<template #label>{{ i18n.ts.enable }}<span v-if="fttForm.modifiedStates.enableFanoutTimeline" class="_modified">{{ i18n.ts.modified }}</span></template>
						<template #caption>
							<div>{{ i18n.ts._serverSettings.fanoutTimelineDescription }}</div>
							<div><MkLink target="_blank" url="https://misskey-hub.net/docs/for-admin/features/ftt/">{{ i18n.ts.details }}</MkLink></div>
						</template>
					</MkSwitch>

					<template v-if="fttForm.state.enableFanoutTimeline">
						<MkSwitch v-model="fttForm.state.enableFanoutTimelineDbFallback">
							<template #label>{{ i18n.ts._serverSettings.fanoutTimelineDbFallback }}<span v-if="fttForm.modifiedStates.enableFanoutTimelineDbFallback" class="_modified">{{ i18n.ts.modified }}</span></template>
							<template #caption>{{ i18n.ts._serverSettings.fanoutTimelineDbFallbackDescription }}</template>
						</MkSwitch>

						<MkInput v-model="fttForm.state.perLocalUserUserTimelineCacheMax" type="number">
							<template #label>{{ tPerf('perLocalUserUserTimelineCacheMax') }}<span v-if="fttForm.modifiedStates.perLocalUserUserTimelineCacheMax" class="_modified">{{ i18n.ts.modified }}</span></template>
							<template #caption>{{ tPerf('cacheMaxCaption') }}</template>
						</MkInput>

						<MkInput v-model="fttForm.state.perRemoteUserUserTimelineCacheMax" type="number">
							<template #label>{{ tPerf('perRemoteUserUserTimelineCacheMax') }}<span v-if="fttForm.modifiedStates.perRemoteUserUserTimelineCacheMax" class="_modified">{{ i18n.ts.modified }}</span></template>
							<template #caption>{{ tPerf('cacheMaxCaption') }}</template>
						</MkInput>

						<MkInput v-model="fttForm.state.perUserHomeTimelineCacheMax" type="number">
							<template #label>{{ tPerf('perUserHomeTimelineCacheMax') }}<span v-if="fttForm.modifiedStates.perUserHomeTimelineCacheMax" class="_modified">{{ i18n.ts.modified }}</span></template>
							<template #caption>{{ tPerf('cacheMaxCaption') }}</template>
						</MkInput>

						<MkInput v-model="fttForm.state.perUserListTimelineCacheMax" type="number">
							<template #label>{{ tPerf('perUserListTimelineCacheMax') }}<span v-if="fttForm.modifiedStates.perUserListTimelineCacheMax" class="_modified">{{ i18n.ts.modified }}</span></template>
							<template #caption>{{ tPerf('cacheMaxCaption') }}</template>
						</MkInput>
					</template>
				</div>
			</MkFolder>

			<MkFolder :defaultOpen="true">
				<template #icon><i class="ti ti-bolt"></i></template>
				<template #label>{{ tPerf('rbtTitle') }}<span class="_beta">{{ i18n.ts.beta }}</span></template>
				<template v-if="rbtForm.savedState.enableReactionsBuffering" #suffix>{{ tPerf('enabled') }}</template>
				<template v-else #suffix>{{ tPerf('disabled') }}</template>
				<template v-if="rbtForm.modified.value" #footer>
					<MkFormFooter :form="rbtForm"/>
				</template>

				<div class="_gaps_m">
					<MkSwitch v-model="rbtForm.state.enableReactionsBuffering">
						<template #label>{{ i18n.ts.enable }}<span v-if="rbtForm.modifiedStates.enableReactionsBuffering" class="_modified">{{ i18n.ts.modified }}</span></template>
						<template #caption>{{ i18n.ts._serverSettings.reactionsBufferingDescription }}</template>
					</MkSwitch>
				</div>
			</MkFolder>
		</div>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { fetchInstance } from '@/instance.js';
import { i18n } from '@/i18n.js';
import { miLocalStorage } from '@/local-storage.js';
import { definePage } from '@/page.js';
import MkSwitch from '@/components/MkSwitch.vue';
import MkFolder from '@/components/MkFolder.vue';
import MkInput from '@/components/MkInput.vue';
import MkLink from '@/components/MkLink.vue';
import { useForm } from '@/use/use-form.js';
import MkFormFooter from '@/components/MkFormFooter.vue';

/** UI strings not always present in locale packs (FTT/RBT marketing names + cache labels) */
const PERF_FB: Record<string, { en: string; zh: string; 'zh-TW'?: string; ja: string }> = {
	fttTitle: {
		en: 'Fan-out Timeline (FTT)',
		zh: '扇出时间线缓存 (FTT)',
		'zh-TW': '扇出時間軸快取 (FTT)',
		ja: 'ファンアウトタイムライン (FTT)',
	},
	rbtTitle: {
		en: 'Reactions Buffering (RBT)',
		zh: '回应缓冲 (RBT)',
		'zh-TW': '回應緩衝 (RBT)',
		ja: 'リアクションバッファリング (RBT)',
	},
	enabled: { en: 'Enabled', zh: '已启用', 'zh-TW': '已啟用', ja: '有効' },
	disabled: { en: 'Disabled', zh: '已禁用', 'zh-TW': '已停用', ja: '無効' },
	perLocalUserUserTimelineCacheMax: {
		en: 'Local user timeline cache size',
		zh: '本地用户时间线缓存上限',
		'zh-TW': '本機使用者時間軸快取上限',
		ja: 'ローカルユーザーのタイムラインキャッシュ上限',
	},
	perRemoteUserUserTimelineCacheMax: {
		en: 'Remote user timeline cache size',
		zh: '远程用户时间线缓存上限',
		'zh-TW': '遠端使用者時間軸快取上限',
		ja: 'リモートユーザーのタイムラインキャッシュ上限',
	},
	perUserHomeTimelineCacheMax: {
		en: 'Home timeline cache size',
		zh: '首页时间线缓存上限',
		'zh-TW': '首頁時間軸快取上限',
		ja: 'ホームタイムラインキャッシュ上限',
	},
	perUserListTimelineCacheMax: {
		en: 'List timeline cache size',
		zh: '列表时间线缓存上限',
		'zh-TW': '清單時間軸快取上限',
		ja: 'リストタイムラインキャッシュ上限',
	},
	cacheMaxCaption: {
		en: 'Maximum notes kept in Redis per user for this timeline type.',
		zh: '该时间线类型在 Redis 中为每位用户保留的最大帖子数。',
		'zh-TW': '此時間軸類型在 Redis 中為每位使用者保留的最大貼文數。',
		ja: 'このタイムライン種別についてユーザーごとに Redis に保持するノートの上限です。',
	},
};

function tPerf(key: keyof typeof PERF_FB): string {
	const fb = PERF_FB[key];
	const lang = (
		miLocalStorage.getItem('lang')
		|| (typeof navigator !== 'undefined' ? navigator.language : 'en-US')
		|| 'en-US'
	).replace('_', '-').toLowerCase();
	if (lang.startsWith('zh-tw') || lang.startsWith('zh-hk') || lang.startsWith('zh-hant')) {
		return fb['zh-TW'] || fb.zh;
	}
	if (lang.startsWith('zh')) return fb.zh;
	if (lang.startsWith('ja')) return fb.ja;
	return fb.en;
}

const meta = await misskeyApi('admin/meta');

const enableServerMachineStats = ref(meta.enableServerMachineStats);
const enableIdenticonGeneration = ref(meta.enableIdenticonGeneration);
const enableChartsForRemoteUser = ref(meta.enableChartsForRemoteUser);
const enableStatsForFederatedInstances = ref(meta.enableStatsForFederatedInstances);
const enableChartsForFederatedInstances = ref(meta.enableChartsForFederatedInstances);

function onChange_enableServerMachineStats(value: boolean) {
	os.apiWithDialog('admin/update-meta', {
		enableServerMachineStats: value,
	}).then(() => {
		fetchInstance(true);
	});
}

function onChange_enableIdenticonGeneration(value: boolean) {
	os.apiWithDialog('admin/update-meta', {
		enableIdenticonGeneration: value,
	}).then(() => {
		fetchInstance(true);
	});
}

function onChange_enableChartsForRemoteUser(value: boolean) {
	os.apiWithDialog('admin/update-meta', {
		enableChartsForRemoteUser: value,
	}).then(() => {
		fetchInstance(true);
	});
}

function onChange_enableStatsForFederatedInstances(value: boolean) {
	os.apiWithDialog('admin/update-meta', {
		enableStatsForFederatedInstances: value,
	}).then(() => {
		fetchInstance(true);
	});
}

function onChange_enableChartsForFederatedInstances(value: boolean) {
	os.apiWithDialog('admin/update-meta', {
		enableChartsForFederatedInstances: value,
	}).then(() => {
		fetchInstance(true);
	});
}

const fttForm = useForm({
	enableFanoutTimeline: meta.enableFanoutTimeline,
	enableFanoutTimelineDbFallback: meta.enableFanoutTimelineDbFallback,
	perLocalUserUserTimelineCacheMax: meta.perLocalUserUserTimelineCacheMax,
	perRemoteUserUserTimelineCacheMax: meta.perRemoteUserUserTimelineCacheMax,
	perUserHomeTimelineCacheMax: meta.perUserHomeTimelineCacheMax,
	perUserListTimelineCacheMax: meta.perUserListTimelineCacheMax,
}, async (state) => {
	await os.apiWithDialog('admin/update-meta', {
		enableFanoutTimeline: state.enableFanoutTimeline,
		enableFanoutTimelineDbFallback: state.enableFanoutTimelineDbFallback,
		perLocalUserUserTimelineCacheMax: state.perLocalUserUserTimelineCacheMax,
		perRemoteUserUserTimelineCacheMax: state.perRemoteUserUserTimelineCacheMax,
		perUserHomeTimelineCacheMax: state.perUserHomeTimelineCacheMax,
		perUserListTimelineCacheMax: state.perUserListTimelineCacheMax,
	});
	fetchInstance(true);
});

const rbtForm = useForm({
	enableReactionsBuffering: meta.enableReactionsBuffering,
}, async (state) => {
	await os.apiWithDialog('admin/update-meta', {
		enableReactionsBuffering: state.enableReactionsBuffering,
	});
	fetchInstance(true);
});

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts.other,
	icon: 'ti ti-adjustments',
}));
</script>
