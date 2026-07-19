/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

'use strict';

// ブロックの中に入れないと、定義した変数がブラウザのグローバルスコープに登録されてしまい邪魔なので
(async () => {
	window.onerror = (e) => {
		console.error(e);
		renderError('SOMETHING_HAPPENED', e);
	};
	window.onunhandledrejection = (e) => {
		console.error(e);
		renderError('SOMETHING_HAPPENED_IN_PROMISE', e);
	};

	let forceError = localStorage.getItem('forceError');
	if (forceError != null) {
		renderError('FORCED_ERROR', 'This error is forced by having forceError in local storage.');
		return;
	}

	// Force update when locales change
	const langsVersion = LANGS_VERSION;
	const localeVersion = localStorage.getItem('localeVersion');
	if (localeVersion !== langsVersion) {
		console.info(`Updating locales from version ${localeVersion ?? 'N/A'} to ${langsVersion}`);
		localStorage.removeItem('localeVersion');
		localStorage.removeItem('locale');
	}

	//#region Detect language & fetch translations
	if (!localStorage.getItem('locale')) {
		const supportedLangs = LANGS;
		/** @type {string | null | undefined} */
		let lang = localStorage.getItem('lang');
		if (lang == null || !supportedLangs.includes(lang)) {
			if (supportedLangs.includes(navigator.language)) {
				lang = navigator.language;
			} else {
				lang = supportedLangs.find(x => x.split('-')[0] === navigator.language.split('-')[0]);

				// Fallback
				if (lang == null) lang = 'en-US';
			}
		}

		// for https://github.com/misskey-dev/misskey/issues/10202
		if (lang == null || lang.toString == null || lang.toString() === 'null') {
			console.error('invalid lang value detected!!!', typeof lang, lang);
			lang = 'en-US';
		}

		const localRes = await window.fetch(`/assets/locales/${lang}.${langsVersion}.json`);
		if (localRes.status === 200) {
			localStorage.setItem('lang', lang);
			localStorage.setItem('locale', await localRes.text());
			localStorage.setItem('localeVersion', langsVersion);
		} else {
			renderError('LOCALE_FETCH');
			return;
		}
	}
	//#endregion

	//#region Script
	async function importAppScript() {
		await import(`/vite/${CLIENT_ENTRY}`)
			.catch(async e => {
				console.error(e);
				renderError('APP_IMPORT', e);
			});
	}

	// タイミングによっては、この時点でDOMの構築が済んでいる場合とそうでない場合とがある
	if (document.readyState !== 'loading') {
		importAppScript();
	} else {
		window.addEventListener('DOMContentLoaded', () => {
			importAppScript();
		});
	}
	//#endregion

	//#region Theme
	const theme = localStorage.getItem('theme');
	const themeFontFaceName = 'sharkey-theme-font-face';
	if (theme) {
		let existingFontFace;
		document.fonts.forEach((v) => { if (v.family === themeFontFaceName) existingFontFace = v;});
		if (existingFontFace) document.fonts.delete(existingFontFace);

		const themeProps = JSON.parse(theme);
		const fontFaceSrc = themeProps.fontFaceSrc;
		const fontFaceOpts = themeProps.fontFaceOpts || {};
		if (fontFaceSrc) {
			const fontFace = new FontFace(
				themeFontFaceName,
				fontFaceSrc, fontFaceOpts || {},
			);
			document.fonts.add(fontFace);
			fontFace.load().catch(
				(failure) => {
					console.log(failure);
				},
			);
		}
		for (const [k, v] of Object.entries(themeProps)) {
			if (k.startsWith('font')) continue;
			document.documentElement.style.setProperty(`--MI_THEME-${k}`, v.toString());

			// HTMLの theme-color 適用
			if (k === 'htmlThemeColor') {
				for (const tag of document.head.children) {
					if (tag.tagName === 'META' && tag.getAttribute('name') === 'theme-color') {
						tag.setAttribute('content', v);
						break;
					}
				}
			}
		}
	}
	const colorScheme = localStorage.getItem('colorScheme');
	if (colorScheme) {
		document.documentElement.style.setProperty('color-scheme', colorScheme);
	}
	//#endregion

	const fontSize = localStorage.getItem('fontSize');
	if (fontSize) {
		if (fontSize === "custom") {
			const customFontSize = localStorage.getItem('customFontSize');
			document.documentElement.style.setProperty('font-size', `${customFontSize}px`);
		} else {
			document.documentElement.classList.add('f-' + fontSize);
		}
	}

	const cornerRadius = localStorage.getItem('cornerRadius');
	if (cornerRadius) {
		document.documentElement.classList.add(`radius-${cornerRadius}`);
	}

	const useSystemFont = localStorage.getItem('useSystemFont');
	if (useSystemFont) {
		document.documentElement.classList.add('useSystemFont');
	}

	const customCss = localStorage.getItem('customCss');
	if (customCss && customCss.length > 0) {
		const style = document.createElement('style');
		style.innerHTML = customCss;
		document.head.appendChild(style);
	}

	/**
	 * @param {string} styleText
	 * @returns {Promise<void>}
	 */
	async function addStyle(styleText) {
		let css = document.createElement('style');
		css.appendChild(document.createTextNode(styleText));
		document.head.appendChild(css);
	}


	/**
	 * Readable error text for PromiseRejectionEvent / Error / plain values.
	 * @param {any} details
	 * @returns {string}
	 */
	function formatErrorDetails(details) {
		if (details == null) return '';
		if (typeof details === 'string') return details;
		if (details instanceof Error) {
			return details.stack || `${details.name}: ${details.message}`;
		}
		if (typeof details === 'object' && 'reason' in details) {
			const inner = formatErrorDetails(/** @type {any} */ (details).reason);
			if (inner) return inner;
		}
		try {
			return JSON.stringify(details, Object.getOwnPropertyNames(details), 2);
		} catch {
			try {
				return String(details);
			} catch {
				return '[unserializable error]';
			}
		}
	}

	/**
	 * Escape text for HTML body.
	 * @param {string} s
	 * @returns {string}
	 */
	function escapeHtml(s) {
		return String(s)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	/**
	 * Boot error page layout (original Sharkey style):
	 *   top    — error title + code + reload
	 *   middle — recovery tool links (/flush, /cli, /bios)
	 *   bottom — full log (always expanded)
	 *
	 * @param {string} code
	 * @param {any} [details]
	 * @returns {Promise<void>}
	 */
	async function renderError(code, details) {
		if (document.readyState === 'loading') {
			await new Promise(resolve => window.addEventListener('DOMContentLoaded', resolve));
		}

		const locale = JSON.parse(localStorage.getItem('locale') || '{}');
		const messages = Object.assign({
			title: 'Failed to initialize Sharkey',
			solution: 'The following actions may solve the problem.',
			solution1: 'Update your os and browser',
			solution2: 'Disable an adblocker',
			solution3: 'Clear the browser cache',
			solution4: '(Tor Browser) Set dom.webaudio.enabled to true',
			toolsTitle: 'Recovery tools',
			toolsHint: 'Open a built-in tool (recommended first):',
			otherOption1: 'Clear preferences and cache',
			otherOption2: 'Start the simple client',
			otherOption3: 'Start the repair tool',
			fullLog: 'Full log',
		}, locale?._bootErrors || {});
		const reload = locale?.reload || 'Reload';

		const logBody = formatErrorDetails(details);

		// Rebuild page once; append extra log blocks if multiple errors fire
		let logEl = document.getElementById('full-log');
		if (!logEl) {
			document.body.innerHTML = `
			<svg class="icon-warning" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
				<path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
				<path d="M12 9v2m0 4v.01"></path>
				<path d="M5 19h14a2 2 0 0 0 1.84 -2.75l-7.1 -12.25a2 2 0 0 0 -3.5 0l-7.1 12.25a2 2 0 0 0 1.75 2.75"></path>
			</svg>

			<!-- TOP: error -->
			<section class="err-section err-top">
				<h1>${escapeHtml(messages.title)}</h1>
				<p class="err-code"><code>ERROR CODE: ${escapeHtml(code)}</code></p>
				<button class="button-big" type="button" onclick="location.reload();">
					<span class="button-label-big">${escapeHtml(reload)}</span>
				</button>
			</section>

			<!-- MIDDLE: tools -->
			<section class="err-section err-tools">
				<p><b>${escapeHtml(messages.toolsTitle)}</b></p>
				<p class="err-hint">${escapeHtml(messages.toolsHint)}</p>
				<p>
					<a href="/flush"><button class="button-small" type="button"><span class="button-label-small">${escapeHtml(messages.otherOption1)}</span></button></a>
				</p>
				<p>
					<a href="/cli"><button class="button-small" type="button"><span class="button-label-small">${escapeHtml(messages.otherOption2)}</span></button></a>
				</p>
				<p>
					<a href="/bios"><button class="button-small" type="button"><span class="button-label-small">${escapeHtml(messages.otherOption3)}</span></button></a>
				</p>
				<p class="err-tips"><b>${escapeHtml(messages.solution)}</b></p>
				<p>${escapeHtml(messages.solution1)}</p>
				<p>${escapeHtml(messages.solution2)}</p>
				<p>${escapeHtml(messages.solution3)}</p>
				<p>${escapeHtml(messages.solution4)}</p>
			</section>

			<!-- BOTTOM: full log -->
			<section class="err-section err-log">
				<p><b>${escapeHtml(messages.fullLog)}</b></p>
				<pre id="full-log" class="full-log"></pre>
			</section>
			`;
			logEl = document.getElementById('full-log');
			addStyle(`
* {
	font-family: BIZ UDGothic, Roboto, HelveticaNeue, Arial, sans-serif;
}
#sharkey_app,
#splash {
	display: none !important;
}
body,
html {
	background-color: #222;
	color: #dfddcc;
	justify-content: center;
	margin: auto;
	padding: 10px;
	text-align: center;
}
.err-section {
	max-width: 40rem;
	margin: 0 auto 1.25rem;
}
.err-top {
	margin-bottom: 1.5rem;
}
.err-code {
	margin: 0.75rem auto 1rem;
}
.err-code code {
	display: inline-block;
	font-family: Fira, FiraCode, monospace;
	background: #333;
	padding: 0.5rem 1rem;
	border-radius: 10px;
	white-space: pre-wrap;
	word-break: break-word;
}
.err-hint {
	opacity: 0.85;
	font-size: 15px;
	margin-top: 0;
}
.err-tips {
	margin-top: 1.25rem;
}
button {
	border-radius: 999px;
	padding: 0 12px;
	border: none;
	cursor: pointer;
	margin-bottom: 12px;
}
.button-big {
	background: linear-gradient(90deg, rgb(134, 179, 0), rgb(74, 179, 0));
	line-height: 50px;
}
.button-big:hover {
	background: rgb(153, 204, 0);
}
.button-small {
	background: #444;
	line-height: 40px;
}
.button-small:hover {
	background: #555;
}
.button-label-big {
	color: #222;
	font-weight: bold;
	font-size: 1.2em;
	padding: 12px;
}
.button-label-small {
	color: rgb(153, 204, 0);
	font-size: 16px;
	padding: 12px;
}
a {
	color: rgb(134, 179, 0);
	text-decoration: none;
}
p, li {
	font-size: 16px;
}
.icon-warning {
	color: #dec340;
	height: 4rem;
	padding-top: 2rem;
}
h1 {
	font-size: 1.5em;
	margin: 1em;
}
.full-log {
	display: block;
	text-align: left;
	font-family: Fira, FiraCode, ui-monospace, monospace;
	font-size: 12px;
	line-height: 1.45;
	background: #333;
	color: #dfddcc;
	padding: 0.75rem 1rem;
	max-width: 40rem;
	max-height: min(50vh, 28rem);
	overflow: auto;
	border-radius: 10px;
	margin: 0.5rem auto 2rem;
	white-space: pre-wrap;
	word-break: break-word;
}
@media screen and (max-width: 500px) {
	.full-log, .err-section {
		max-width: 92vw;
	}
}
`);
		}

		if (logEl) {
			const block =
				`ERROR CODE: ${code}\n` +
				`TIME: ${new Date().toISOString()}\n` +
				`URL: ${location.href}\n` +
				`UA: ${navigator.userAgent}\n` +
				`\n---\n\n` +
				(logBody || '(no detail)');
			if (logEl.textContent && logEl.textContent.trim().length > 0) {
				logEl.textContent += '\n\n==========\n\n' + block;
			} else {
				logEl.textContent = block;
			}
		}
	}
})();
