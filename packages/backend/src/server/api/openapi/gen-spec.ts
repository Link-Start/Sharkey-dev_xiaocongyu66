/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { Config } from '@/config.js';
import endpoints, { IEndpoint } from '../endpoints.js';
import { errors as basicErrors } from './errors.js';
import { getSchemas, convertSchemaToOpenApiSchema } from './schemas.js';

export type OpenApiLang = 'en' | 'zh' | 'zh-TW' | 'ja';

/** Normalize Accept-Language / query lang into a supported OpenAPI pack. */
export function resolveOpenApiLang(input?: string | null): OpenApiLang {
	const raw = (input ?? 'en').split(',')[0]?.trim().replace('_', '-') ?? 'en';
	const lower = raw.toLowerCase();
	if (lower.startsWith('zh-tw') || lower.startsWith('zh-hk') || lower.startsWith('zh-hant')) return 'zh-TW';
	if (lower.startsWith('zh')) return 'zh';
	if (lower.startsWith('ja')) return 'ja';
	return 'en';
}

type OpenApiCopy = {
	title: string;
	description: string;
	externalDocs: string;
	server: string;
	bearer: string;
	tags: Record<string, string>;
};

const OPENAPI_I18N: Record<OpenApiLang, (url: string) => OpenApiCopy> = {
	en: (url) => ({
		title: 'Sharkey API',
		description: [
			'HTTP API for this Sharkey instance (Misskey fork).',
			'',
			'## Authentication',
			'',
			'Preferred: `Authorization: Bearer <token>` (RFC 6750).',
			'',
			'Legacy (still accepted): JSON body field `i` on POST, or query `i` on **GET** endpoints that set `allowGet`.',
			'**Do not put long-lived tokens in URLs** when you can avoid it (proxy logs / Referer). Prefer Bearer for HTTP.',
			'',
			'WebSocket streaming (`/streaming`): modern clients send the token via `Sec-WebSocket-Protocol`',
			'(`misskey` + `misskey.i.<token>`). Legacy `?i=` remains accepted for older clients.',
			'',
			'## Credentials & permissions',
			'',
			'- **Credential required**: needs a user or app access token.',
			'- **Permission (`kind`)**: app tokens must include this scope (e.g. `write:notes`).',
			'- **Moderator / Administrator**: role flags; not the same as app scopes alone.',
			'- **Internal (`secure`)**: intended for the first-party web client only; third-party apps should not call these.',
			'',
			'## Interactive docs',
			'',
			`Human-readable explorer (public, no login): ${url}/api-doc`,
			'',
			'Machine-readable OpenAPI 3.1: `/api.json` (**public**).',
			'',
			'## Notes',
			'',
			'- Extra JSON properties are generally ignored (handlers pick known fields); do not rely on mass-assignment.',
			'- Rate limits return HTTP 429 when configured on an endpoint.',
			'- API catalog (`/api.json`, `/api/endpoints`, `/api/endpoint`, `/api-doc`) is open to everyone; only *calling* protected endpoints needs a token.',
		].join('\n'),
		externalDocs: 'Sharkey upstream repository',
		server: 'This instance API base',
		bearer: 'User or app access token (preferred). Legacy alternative: JSON body field `i` on POST, or query `i` on allowGet endpoints (avoid putting tokens in URLs).',
		tags: {
			account: 'Account / profile',
			admin: 'Moderator / administrator',
			chat: 'Direct messages and chat rooms',
			drive: 'Drive files and folders',
			notes: 'Notes (posts)',
			users: 'Users',
			flashs: 'Play / Flash (AiScript pages)',
			meta: 'Instance meta',
		},
	}),
	zh: (url) => ({
		title: 'Sharkey API',
		description: [
			'本 Sharkey 实例的 HTTP API（Misskey 分支）。',
			'',
			'## 认证',
			'',
			'推荐：`Authorization: Bearer <token>`（RFC 6750）。',
			'',
			'兼容旧方式：POST 的 JSON 字段 `i`，或设置了 `allowGet` 的 **GET** 查询参数 `i`。',
			'**尽量不要把长期有效的 token 放进 URL**（代理日志 / Referer）。HTTP 请优先使用 Bearer。',
			'',
			'WebSocket（`/streaming`）：现代客户端通过 `Sec-WebSocket-Protocol` 发送 token',
			'（`misskey` + `misskey.i.<token>`）。旧客户端仍可使用 `?i=`。',
			'',
			'## 凭证与权限',
			'',
			'- **需要凭证**：需要用户或应用访问令牌。',
			'- **权限（`kind`）**：应用令牌必须包含对应 scope（如 `write:notes`）。',
			'- **版主 / 管理员**：角色标志；与应用 scope 不同。',
			'- **内部（`secure`）**：仅供本站前端使用；第三方应用请勿调用。',
			'',
			'## 交互式文档',
			'',
			`人类可读浏览器（公开，无需登录）：${url}/api-doc`,
			'',
			'机器可读 OpenAPI 3.1：`/api.json`（**公开**）。',
			'',
			'## 说明',
			'',
			'- 多余的 JSON 字段通常会被忽略；不要依赖批量赋值。',
			'- 配置了限流的接口会在超限时返回 HTTP 429。',
			'- API 目录（`/api.json`、`/api/endpoints`、`/api/endpoint`、`/api-doc`）对所有人公开；只有*调用*受保护接口才需要 token。',
		].join('\n'),
		externalDocs: 'Sharkey 上游仓库',
		server: '本实例 API 基址',
		bearer: '用户或应用访问令牌（推荐）。兼容：POST 的 JSON 字段 `i`，或 allowGet 接口的查询参数 `i`（避免把 token 放进 URL）。',
		tags: {
			account: '账号 / 资料',
			admin: '版主 / 管理员',
			chat: '私信与群聊',
			drive: '网盘文件与文件夹',
			notes: '帖子（笔记）',
			users: '用户',
			flashs: 'Play / Flash（AiScript 页面）',
			meta: '实例元信息',
		},
	}),
	'zh-TW': (url) => ({
		title: 'Sharkey API',
		description: [
			'本 Sharkey 站點的 HTTP API（Misskey 分支）。',
			'',
			'## 認證',
			'',
			'建議：`Authorization: Bearer <token>`（RFC 6750）。',
			'',
			'相容舊方式：POST 的 JSON 欄位 `i`，或設定了 `allowGet` 的 **GET** 查詢參數 `i`。',
			'**儘量不要把長期有效的 token 放進 URL**。HTTP 請優先使用 Bearer。',
			'',
			'WebSocket（`/streaming`）：現代客戶端透過 `Sec-WebSocket-Protocol` 傳送 token。',
			'',
			'## 互動式文件',
			'',
			`人類可讀瀏覽器（公開，無需登入）：${url}/api-doc`,
			'',
			'機器可讀 OpenAPI 3.1：`/api.json`（**公開**）。',
		].join('\n'),
		externalDocs: 'Sharkey 上游倉庫',
		server: '本站點 API 基址',
		bearer: '使用者或應用存取權杖（建議）。相容：POST 的 JSON 欄位 `i`。',
		tags: {
			account: '帳號 / 資料',
			admin: '版主 / 管理員',
			chat: '私訊與群聊',
			drive: '雲端硬碟檔案與資料夾',
			notes: '貼文（筆記）',
			users: '使用者',
			flashs: 'Play / Flash（AiScript 頁面）',
			meta: '站點中繼資訊',
		},
	}),
	ja: (url) => ({
		title: 'Sharkey API',
		description: [
			'この Sharkey インスタンスの HTTP API（Misskey フォーク）。',
			'',
			'## 認証',
			'',
			'推奨: `Authorization: Bearer <token>`（RFC 6750）。',
			'',
			'従来方式: POST の JSON フィールド `i`、または `allowGet` の **GET** クエリ `i`。',
			'**長期トークンを URL に載せない**（プロキシログ / Referer）。HTTP は Bearer を優先。',
			'',
			'WebSocket（`/streaming`）: 現行クライアントは `Sec-WebSocket-Protocol` でトークンを送ります',
			'（`misskey` + `misskey.i.<token>`）。古いクライアントは `?i=` も利用可。',
			'',
			'## 対話的ドキュメント',
			'',
			`人間向けエクスプローラー（公開・ログイン不要）: ${url}/api-doc`,
			'',
			'機械可読 OpenAPI 3.1: `/api.json`（**公開**）。',
		].join('\n'),
		externalDocs: 'Sharkey 上流リポジトリ',
		server: 'このインスタンスの API ベース',
		bearer: 'ユーザーまたはアプリのアクセストークン（推奨）。代替: POST の JSON フィールド `i`。',
		tags: {
			account: 'アカウント / プロフィール',
			admin: 'モデレーター / 管理者',
			chat: 'ダイレクトメッセージとチャットルーム',
			drive: 'ドライブのファイルとフォルダ',
			notes: 'ノート（投稿）',
			users: 'ユーザー',
			flashs: 'Play / Flash（AiScript ページ）',
			meta: 'インスタンスメタ',
		},
	}),
};

export function genOpenapiSpec(config: Config, includeSelfRef = false, langInput?: string | null) {
	const lang = resolveOpenApiLang(langInput);
	const copy = OPENAPI_I18N[lang](config.url);

	const spec = {
		openapi: '3.1',

		info: {
			version: config.version,
			title: copy.title,
			description: copy.description,
			// contact omitted — instance-specific
		},

		externalDocs: {
			description: copy.externalDocs,
			url: 'https://activitypub.software/TransFem-org/Sharkey',
		},

		servers: [{
			url: config.apiUrl,
			description: copy.server,
		}],

		tags: [
			{ name: 'account', description: copy.tags.account },
			{ name: 'admin', description: copy.tags.admin },
			{ name: 'chat', description: copy.tags.chat },
			{ name: 'drive', description: copy.tags.drive },
			{ name: 'notes', description: copy.tags.notes },
			{ name: 'users', description: copy.tags.users },
			{ name: 'flashs', description: copy.tags.flashs },
			{ name: 'meta', description: copy.tags.meta },
		],

		paths: {} as any,

		components: {
			schemas: getSchemas(includeSelfRef),

			securitySchemes: {
				bearerAuth: {
					type: 'http',
					scheme: 'bearer',
					description: copy.bearer,
				},
			},
		},
	};

	// 書き換えたりするのでディープコピーしておく。そのまま編集するとメモリ上の値が汚れて次回以降の出力に影響する
	const copiedEndpoints = JSON.parse(JSON.stringify(endpoints)) as IEndpoint[];
	for (const endpoint of copiedEndpoints) {
		const errors = {} as any;

		if (endpoint.meta.errors) {
			for (const e of Object.values(endpoint.meta.errors)) {
				errors[e.code] = {
					value: {
						error: e,
					},
				};
			}
		}

		const resSchema = endpoint.meta.res ? convertSchemaToOpenApiSchema(endpoint.meta.res, 'res', includeSelfRef) : {};

		let desc = (endpoint.meta.description ? endpoint.meta.description : 'No description provided.') + '\n\n';

		if (endpoint.meta.secure) {
			desc += '**Internal endpoint**: first-party web client only; not for third-party apps.\n\n';
		}

		if (endpoint.meta.stability === 'deprecated') {
			desc += '**Stability**: deprecated — avoid new integrations.\n\n';
		} else if (endpoint.meta.stability === 'experimental') {
			desc += '**Stability**: experimental — may change without notice.\n\n';
		}

		desc += `**Credential required**: *${endpoint.meta.requireCredential ? 'Yes' : 'No'}*`;
		if (endpoint.meta.requireModerator) {
			desc += ' / **Moderator**: *Yes*';
		}
		if (endpoint.meta.requireAdmin) {
			desc += ' / **Administrator**: *Yes*';
		}
		if (endpoint.meta.kind) {
			desc += ` / **Permission**: *${endpoint.meta.kind}*`;
		}
		if (endpoint.meta.requiredRolePolicy) {
			desc += ` / **Role policy**: *${endpoint.meta.requiredRolePolicy}*`;
		}
		if (endpoint.meta.allowGet) {
			desc += '\n\n**GET allowed**: yes (query parameters map to the same fields as the JSON body; avoid putting tokens in query strings).';
		}
		if (endpoint.meta.limit) {
			const lim = endpoint.meta.limit as { duration?: number; max?: number; minInterval?: number };
			const parts: string[] = [];
			if (lim.max != null && lim.duration != null) {
				parts.push(`${lim.max} calls / ${lim.duration}ms`);
			}
			if (lim.minInterval != null) {
				parts.push(`min interval ${lim.minInterval}ms`);
			}
			if (parts.length) {
				desc += `\n\n**Rate limit**: ${parts.join(', ')}.`;
			}
		}

		const requestType = endpoint.meta.requireFile ? 'multipart/form-data' : 'application/json';
		const schema = { ...convertSchemaToOpenApiSchema(endpoint.params, 'param', false) };

		if (endpoint.meta.requireFile) {
			schema.properties = {
				...schema.properties,
				file: {
					type: 'string',
					format: 'binary',
					description: 'The file contents.',
				},
			};
			schema.required = [...schema.required ?? [], 'file'];
		}

		if (schema.required && schema.required.length <= 0) {
			// 空配列は許可されない
			schema.required = undefined;
		}

		const hasBody = (schema.type === 'object' && schema.properties && Object.keys(schema.properties).length >= 1);

		const needsAuth = !!(endpoint.meta.requireCredential || endpoint.meta.requireModerator || endpoint.meta.requireAdmin);

		const info = {
			operationId: endpoint.name.replaceAll('/', '___'), // NOTE: スラッシュは使えない
			summary: endpoint.name,
			description: desc,
			externalDocs: {
				description: 'Source code',
				url: `https://activitypub.software/TransFem-org/Sharkey/-/tree/develop/packages/backend/src/server/api/endpoints/${endpoint.name}.ts`,
			},
			...(endpoint.meta.tags ? {
				tags: [endpoint.meta.tags[0]],
			} : {}),
			...(needsAuth ? {
				security: [{
					bearerAuth: [],
				}],
			} : {}),
			...(hasBody ? {
				requestBody: {
					required: true,
					content: {
						[requestType]: {
							schema,
						},
					},
				},
			} : {}),
			responses: {
				...(endpoint.meta.res ? {
					'200': {
						description: 'OK (with results)',
						content: {
							'application/json': {
								schema: resSchema,
							},
						},
					},
				} : {
					'204': {
						description: 'OK (without any results)',
					},
				}),
				...(endpoint.meta.res?.optional === true || endpoint.meta.res?.nullable === true ? {
					'204': {
						description: 'OK (without any results)',
					},
				} : {}),
				'400': {
					description: 'Client error',
					content: {
						'application/json': {
							schema: {
								$ref: '#/components/schemas/Error',
							},
							examples: { ...errors, ...basicErrors['400'] },
						},
					},
				},
				'401': {
					description: 'Authentication error',
					content: {
						'application/json': {
							schema: {
								$ref: '#/components/schemas/Error',
							},
							examples: basicErrors['401'],
						},
					},
				},
				'403': {
					description: 'Forbidden error',
					content: {
						'application/json': {
							schema: {
								$ref: '#/components/schemas/Error',
							},
							examples: basicErrors['403'],
						},
					},
				},
				'418': {
					description: 'I\'m Ai',
					content: {
						'application/json': {
							schema: {
								$ref: '#/components/schemas/Error',
							},
							examples: basicErrors['418'],
						},
					},
				},
				...(endpoint.meta.limit ? {
					'429': {
						description: 'Too many requests',
						content: {
							'application/json': {
								schema: {
									$ref: '#/components/schemas/Error',
								},
								examples: basicErrors['429'],
							},
						},
					},
				} : {}),
				'500': {
					description: 'Internal server error',
					content: {
						'application/json': {
							schema: {
								$ref: '#/components/schemas/Error',
							},
							examples: basicErrors['500'],
						},
					},
				},
			},
		};

		const { requestBody: postBody, ...infoWithoutBody } = info as typeof info & { requestBody?: unknown };

		spec.paths['/' + endpoint.name] = {
			...(endpoint.meta.allowGet ? {
				get: {
					...infoWithoutBody,
					operationId: 'get___' + info.operationId,
					description: info.description + '\n\nThis operation allows **GET** (query string parameters mirror the request body schema). Avoid tokens in the query string; use Bearer when the client can set headers.',
					...(hasBody ? {
						parameters: Object.entries(schema.properties ?? {}).map(([name, prop]: [string, any]) => ({
							name,
							in: 'query',
							required: Array.isArray(schema.required) && schema.required.includes(name),
							schema: prop,
							description: typeof prop?.description === 'string' ? prop.description : undefined,
						})),
					} : {}),
				},
			} : {}),
			post: {
				...info,
				operationId: 'post___' + info.operationId,
				...(postBody ? { requestBody: postBody } : {}),
			},
		};
	}

	return spec;
}
