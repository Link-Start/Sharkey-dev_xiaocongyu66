/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
	createBrowserDiagnostics,
	recordConsoleMessageType,
	recordPageError,
	summarizeBrowserDiagnostics,
	type BrowserDiagnostics,
} from './chrome.mts';
import {
	renderBrowserDiagnosticsRows,
	type BrowserMeasurement,
	type BrowserMeasurementSample,
	type BrowserMetricsReport,
} from './frontend-browser-report.mts';

function diagnostics(pageErrorCount: number, log: number, warn: number, error: number, info: number): BrowserDiagnostics {
	return {
		pageErrorCount,
		console: { log, warn, error, info },
	};
}

function browserReport(label: 'base' | 'head', values: BrowserDiagnostics[]): BrowserMetricsReport {
	const samples = values.map((value, index) => ({
		round: index + 1,
		diagnostics: value,
	} as BrowserMeasurementSample));

	return {
		label,
		timestamp: '2026-07-16T00:00:00.000Z',
		url: 'http://127.0.0.1:61812',
		scenario: 'test',
		sampleCount: samples.length,
		aggregation: 'median',
		summary: {
			diagnostics: summarizeBrowserDiagnostics(values),
		} as BrowserMeasurement,
		samples,
	};
}

test('records page errors and only the requested console message types', () => {
	const result = createBrowserDiagnostics();
	recordPageError(result);
	recordPageError(result);
	for (const type of ['log', 'warning', 'error', 'info', 'debug', 'trace']) {
		recordConsoleMessageType(result, type);
	}

	assert.deepEqual(result, diagnostics(2, 1, 1, 1, 1));
});

test('summarizes browser diagnostics with a median for every counter', () => {
	const result = summarizeBrowserDiagnostics([
		diagnostics(0, 10, 20, 30, 40),
		diagnostics(4, 14, 24, 34, 44),
		diagnostics(2, 12, 22, 32, 42),
		diagnostics(3, 13, 23, 33, 43),
		diagnostics(1, 11, 21, 31, 41),
	]);

	assert.deepEqual(result, diagnostics(2, 12, 22, 32, 42));
});

test('renders each changed browser diagnostics metric as a separate row', () => {
	const base = browserReport('base', Array.from({ length: 5 }, () => diagnostics(0, 0, 0, 0, 0)));
	const head = browserReport('head', Array.from({ length: 5 }, () => diagnostics(1, 1, 1, 1, 1)));
	const rows = renderBrowserDiagnosticsRows(base, head).join('\n');

	for (const label of ['Page errors', 'Console log', 'Console warnings', 'Console errors', 'Console info']) {
		assert.match(rows, new RegExp(`\\*\\*${label}\\*\\*`));
	}
});

test('renders browser diagnostics deltas from paired rounds instead of summary medians', () => {
	const base = browserReport('base', [0, 9, 10, 100, 101].map(value => diagnostics(value, 0, 0, 0, 0)));
	const head = browserReport('head', [10, 100, 101, 0, 9].map(value => diagnostics(value, 0, 0, 0, 0)));
	const rows = renderBrowserDiagnosticsRows(base, head);

	assert.equal(rows.length, 1);
	assert.match(rows[0], /\*\*Page errors\*\*/);
	assert.match(rows[0], /\\text\{\+10\}/);
});

test('omits browser diagnostics rows whose paired median does not change', () => {
	const values = Array.from({ length: 5 }, () => diagnostics(2, 3, 4, 5, 6));
	const base = browserReport('base', values);
	const head = browserReport('head', values);

	assert.deepEqual(renderBrowserDiagnosticsRows(base, head), []);
});
