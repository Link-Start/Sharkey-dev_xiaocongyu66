#!/usr/bin/env node
/**
 * Local HTTP JSON gateway compatible with Sharkey XAlgorithmService.
 * Ranks notes from PostgreSQL using engagement + recency + author diversity
 * (Thunder/in-network + out-of-network candidate mix).
 *
 * Env:
 *   PORT=8787
 *   PGHOST=127.0.0.1 PGPORT=5432 PGDATABASE=sharkey_dev PGUSER=sharkey PGPASSWORD=...
 *   API_KEY=optional
 */
import http from 'node:http';
import { createRequire } from 'node:module';
import { createRequire as _cr } from 'node:module';
const require = createRequire(import.meta.url);
// resolve pg from Sharkey workspace if not installed next to this service
let pg;
try {
	pg = require('pg');
} catch {
	pg = require('/root/Sharkey-work/Sharkey-local-pg18/node_modules/.pnpm/pg@8.16.3/node_modules/pg');
}

const PORT = Number(process.env.PORT || 8787);
const API_KEY = process.env.API_KEY || '';

const pool = new pg.Pool({
	host: process.env.PGHOST || '127.0.0.1',
	port: Number(process.env.PGPORT || 5432),
	database: process.env.PGDATABASE || 'sharkey_dev',
	user: process.env.PGUSER || 'sharkey',
	password: process.env.PGPASSWORD || 'example-misskey-pass',
	max: 4,
});

function parseBody(req) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		req.on('data', (c) => chunks.push(c));
		req.on('end', () => {
			try {
				const raw = Buffer.concat(chunks).toString('utf8') || '{}';
				resolve(JSON.parse(raw));
			} catch (e) {
				reject(e);
			}
		});
		req.on('error', reject);
	});
}

function idTimeMs(id) {
	// aidx/aid style: first 8 chars hex of timestamp ms roughly; fall back to 0
	if (!id || typeof id !== 'string') return 0;
	const head = id.slice(0, 8);
	const n = Number.parseInt(head, 36);
	return Number.isFinite(n) ? n : 0;
}

async function rankNotes(body) {
	const userId = body.userId;
	const limit = Math.min(Number(body.limit) || 100, 200);
	const source = body.source === 'hybrid' ? 'hybrid' : 'home';
	const filters = body.filters || {};
	const pipeline = body.pipeline || {};
	const includeIn = pipeline.includeInNetwork !== false;
	const includeOut = pipeline.includeOutOfNetwork !== false;
	const untilId = body.untilId || null;
	const sinceId = body.sinceId || null;

	const following = await pool.query(
		`SELECT "followeeId" FROM following WHERE "followerId" = $1`,
		[userId],
	);
	const followeeIds = following.rows.map((r) => r.followeeId);
	const network = new Set(followeeIds);
	network.add(userId);

	// Candidate pull: recent public notes (single query, no N+1 subselects)
	const params = [];
	const where = [
		`n.visibility IN ('public', 'home')`,
		`(n."isHidden" = false OR n."isHidden" IS NULL)`,
		`n."userHost" IS NULL`,
	];

	if (filters.withFiles) where.push(`n."fileIds" <> '{}'`);
	if (filters.withRenotes === false) {
		where.push(`NOT (n."renoteId" IS NOT NULL AND (n.text IS NULL OR n.text = '') AND (n."fileIds" IS NULL OR n."fileIds" = '{}'))`);
	}
	if (filters.withReplies === false) where.push(`n."replyId" IS NULL`);
	if (filters.withBots === false) where.push(`(u."isBot" IS NULL OR u."isBot" = false)`);

	if (untilId) {
		params.push(untilId);
		where.push(`n.id < $${params.length}`);
	}
	if (sinceId) {
		params.push(sinceId);
		where.push(`n.id > $${params.length}`);
	}

	if (source === 'home' && includeIn && !includeOut) {
		params.push(Array.from(network));
		where.push(`n."userId" = ANY($${params.length})`);
	}

	// Pull a pool larger than limit for ranking; cap for latency
	const poolSize = Math.min(Math.max(limit * 6, 120), 500);

	// reactions is jsonb map {emoji: count} — sum values in JS, not SQL cardinality
	const sql = `
		SELECT n.id, n."userId", n."replyId", n."renoteId",
			COALESCE(n."repliesCount", 0)::int AS replies,
			COALESCE(n."renoteCount", 0)::int AS renotes,
			COALESCE(n.reactions, '{}'::jsonb) AS reactions
		FROM note n
		LEFT JOIN "user" u ON u.id = n."userId"
		WHERE ${where.join(' AND ')}
		ORDER BY n.id DESC
		LIMIT ${poolSize}
	`;

	const { rows } = await pool.query(sql, params);
	const now = Date.now();
	const authorCount = new Map();

	const reactionSum = (reactions) => {
		if (!reactions || typeof reactions !== 'object') return 0;
		return Object.values(reactions).reduce((s, v) => s + (Number(v) || 0), 0);
	};

	const scored = [];
	for (const row of rows) {
		const inNet = network.has(row.userId);
		if (source === 'home' && includeIn && !includeOut && !inNet) continue;
		if (!includeIn && inNet && row.userId !== userId) continue;
		if (!includeOut && !inNet) continue;

		const ageH = Math.max(0.05, (now - idTimeMs(row.id)) / 3_600_000);
		const engagement =
			reactionSum(row.reactions) * 1.0 +
			Number(row.replies) * 1.4 +
			Number(row.renotes) * 1.8;
		const recency = 1 / Math.pow(ageH + 1.5, 1.1);
		const networkBoost = inNet ? 1.35 : 0.85;
		// Slight boost for original posts vs pure renotes
		const originalBoost = row.renoteId && !row.replyId ? 0.9 : 1.05;
		const base = (0.35 + engagement) * recency * networkBoost * originalBoost;
		scored.push({ id: row.id, userId: row.userId, score: base, inNet });
	}

	scored.sort((a, b) => b.score - a.score);

	// Author diversity + mild in-network quota for home
	const out = [];
	let outOfNetwork = 0;
	const maxOon = includeOut ? Math.ceil(limit * 0.35) : 0;
	for (const item of scored) {
		const c = authorCount.get(item.userId) || 0;
		if (c >= 3) continue;
		if (!item.inNet && outOfNetwork >= maxOon) continue;
		authorCount.set(item.userId, c + 1);
		if (!item.inNet) outOfNetwork++;
		out.push(item.id);
		if (out.length >= limit) break;
	}

	// If too few results (empty following), fill with top scored regardless of network
	if (out.length < Math.min(limit, 10) && includeOut) {
		for (const item of scored) {
			if (out.includes(item.id)) continue;
			out.push(item.id);
			if (out.length >= limit) break;
		}
	}

	return out;
}

const server = http.createServer(async (req, res) => {
	const send = (code, obj) => {
		res.writeHead(code, { 'content-type': 'application/json' });
		res.end(JSON.stringify(obj));
	};

	if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
		return send(200, { ok: true, service: 'x-algorithm-gateway' });
	}

	if (req.method !== 'POST' || (req.url !== '/' && req.url !== '/timeline' && req.url !== '/home-mixer')) {
		return send(404, { error: 'not found' });
	}

	if (API_KEY) {
		const auth = req.headers.authorization || '';
		if (auth !== `Bearer ${API_KEY}`) return send(401, { error: 'unauthorized' });
	}

	try {
		const body = await parseBody(req);
		const noteIds = await rankNotes(body);
		return send(200, { noteIds, source: body.source || 'home', product: 'sharkey' });
	} catch (e) {
		console.error(e);
		return send(500, { error: String(e?.message || e) });
	}
});

server.listen(PORT, '127.0.0.1', () => {
	console.log(`x-algorithm-gateway listening on http://127.0.0.1:${PORT}`);
});
