/*
 * SPDX-FileCopyrightText: dakkar and other Sharkey contributors
 * SPDX-License-Identifier: AGPL-3.0-only
*/

import original from 'sanitize-html';

/**
 * Sanitize admin/instance HTML for v-html (about, rules, visitor dashboard).
 * SK-2026-006: do not allow style= (CSS injection / tracking via url()).
 */
export default function sanitizeHtml(str: string | null): string | null {
	if (str == null) return str;
	const defaults = original.defaults.allowedAttributes;
	const stripStyle = (attrs: string[] | undefined) =>
		(attrs ?? []).filter(a => a !== 'style');
	return original(str, {
		allowedTags: original.defaults.allowedTags.concat(['img', 'audio', 'video', 'center', 'details', 'summary']),
		allowedAttributes: {
			...defaults,
			a: stripStyle(defaults.a),
			img: stripStyle(defaults.img).concat(['src', 'alt', 'title', 'width', 'height', 'loading']),
			'*': stripStyle(defaults['*']),
		},
	});
}
