// Organization ownership for the Vibe SDK app row.
// A question stores a role and a body.

const PM_ROLE = 'project-manager';
const DEV_ROLE = 'developer';

type Actor = { role: string; userId: string; orgId: string };
type GateRow = { org_id?: string; role_id?: string };
type QuestionRecord = {
	id: string;
	org_id: string;
	app_id: string;
	target_role_id: string;
	body: string;
	status: string;
	assignment: string;
};

let schemaReady: Promise<void> | null = null;

function waitingLine(role: string): string {
	return role === DEV_ROLE ? 'Waiting on the Developer.' : 'Waiting on the Project Manager.';
}

function assignRole(role: unknown): { targetRole: string; assignment: string } {
	if (role === PM_ROLE || role === DEV_ROLE) return { targetRole: role, assignment: 'declared' };
	return { targetRole: PM_ROLE, assignment: 'fallback' };
}

function firstQuestion(args: Record<string, unknown> | undefined): { body: string; targetRole: string; assignment: string } | null {
	const questions = Array.isArray(args?.questions) ? args.questions : [];
	const first = questions.find((item) => {
		return Boolean(item) && typeof item === 'object' && typeof (item as { question?: unknown }).question === 'string' && String((item as { question: string }).question).trim();
	}) as { question?: string; targetRole?: string } | undefined;
	if (!first?.question) return null;
	const assigned = assignRole(first.targetRole);
	return { body: first.question.trim(), targetRole: assigned.targetRole, assignment: assigned.assignment };
}

function send(connection: WebSocket, data: Record<string, unknown>): void {
	try {
		connection.send(JSON.stringify({ type: 'conversation_response', ...data }));
	} catch {
		// A closed socket does not receive the question.
	}
}

const actorsByConnection = new Map<string, Actor>();

function actorFrom(value: unknown): Actor | null {
	if (!value || typeof value !== 'object') return null;
	const record = value as Record<string, unknown>;
	const role = typeof record.role === 'string' ? record.role : '';
	const userId = typeof record.userId === 'string' ? record.userId : '';
	const orgId = typeof record.orgId === 'string' ? record.orgId : '';
	if (role !== PM_ROLE && role !== DEV_ROLE) return null;
	if (!userId) return null;
	return { role, userId, orgId };
}

export function rememberOrganizationRole(connection: WebSocket, request: Request): void {
	const actor = actorFrom({
		role: request.headers.get('x-org-role') ?? '',
		userId: request.headers.get('x-org-user') ?? '',
		orgId: request.headers.get('x-org-id') ?? '',
	});
	if (!actor) return;
	const socket = connection as WebSocket & { id?: string; setState?: (value: Actor) => void };
	if (socket.id) actorsByConnection.set(socket.id, actor);
	socket.setState?.(actor);
}

export function readOrganizationRole(connection: WebSocket): Actor | null {
	const socket = connection as WebSocket & {
		id?: string;
		state?: unknown;
		deserializeAttachment?: () => unknown;
	};
	if (socket.id) {
		const remembered = actorsByConnection.get(socket.id);
		if (remembered) return remembered;
	}
	const fromState = actorFrom(socket.state);
	if (fromState) return fromState;
	const attachment = socket.deserializeAttachment?.();
	if (attachment && typeof attachment === 'object' && '__user' in attachment) {
		return actorFrom((attachment as { __user?: unknown }).__user);
	}
	return actorFrom(attachment);
}

function binding(env: Env, name: string): string {
	const value = (env as unknown as Record<string, unknown>)[name];
	return typeof value === 'string' ? value : '';
}

async function neonQuery(databaseUrl: string, query: string, params: string[]): Promise<GateRow[]> {
	const endpoint = new URL(databaseUrl);
	const host = endpoint.hostname.replace('-pooler.', '.');
	endpoint.hostname = host;
	const response = await fetch('https://' + host + '/sql', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Neon-Connection-String': endpoint.toString(),
		},
		body: JSON.stringify({ query, params }),
	});
	if (!response.ok) return [];
	const payload = await response.json() as { fields?: { name: string }[]; rows?: unknown[] };
	const fields = payload.fields ?? [];
	return (payload.rows ?? []).map((row) => {
		if (!Array.isArray(row)) return row as GateRow;
		const record: GateRow = {};
		fields.forEach((field, index) => {
			(record as Record<string, unknown>)[field.name] = row[index];
		});
		return record;
	});
}

async function membership(env: Env, userId: string): Promise<{ orgId: string; role: string } | null> {
	const databaseUrl = binding(env, 'WEWEBPLUS_DATABASE_URL');
	if (!databaseUrl || !userId) return null;
	const rows = await neonQuery(
		databaseUrl,
		'select org_id, role_id from wewebplus.memberships where user_id = $1',
		[userId],
	);
	const usable = rows.filter((row) => row.role_id === PM_ROLE || row.role_id === DEV_ROLE);
	if (usable.length !== 1 || !usable[0].org_id || !usable[0].role_id) return null;
	return { orgId: String(usable[0].org_id), role: String(usable[0].role_id) };
}

export function ensureOrganizationSchema(env: Env): Promise<void> {
	if (!schemaReady) {
		schemaReady = applySchema(env).catch((error) => {
			schemaReady = null;
			throw error;
		});
	}
	return schemaReady;
}

async function applySchema(env: Env): Promise<void> {
	const statements = [
		'ALTER TABLE apps ADD COLUMN org_id TEXT',
		'ALTER TABLE apps ADD COLUMN created_by TEXT',
		'CREATE TABLE IF NOT EXISTS org_members (org_id TEXT NOT NULL, user_id TEXT NOT NULL, org_role TEXT NOT NULL, PRIMARY KEY (org_id, user_id))',
		'CREATE TABLE IF NOT EXISTS project_members (project_id TEXT NOT NULL, user_id TEXT NOT NULL, role_id TEXT NOT NULL, PRIMARY KEY (project_id, user_id))',
		'CREATE TABLE IF NOT EXISTS questions (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, app_id TEXT NOT NULL, target_role_id TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL, assignment TEXT NOT NULL, created_at INTEGER NOT NULL)',
		'CREATE TABLE IF NOT EXISTS answers (question_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, body TEXT NOT NULL, created_at INTEGER NOT NULL)',
	];
	for (const statement of statements) {
		try {
			await env.DB.prepare(statement).run();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (!/duplicate column/i.test(message)) throw error;
		}
	}
}

export async function assertProjectManager(env: Env, userId: string): Promise<{ ok: true; message: '' } | { ok: false; message: string }> {
	const member = await membership(env, userId);
	if (!member || member.role !== PM_ROLE) {
		return { ok: false, message: 'Only the Project Manager can create an organization app.' };
	}
	return { ok: true, message: '' };
}

function permissionsForRole(role: string): string[] {
	if (role === PM_ROLE) return ['view', 'start', 'delete'];
	if (role === DEV_ROLE) return ['view'];
	return [];
}

async function ensureOrgMember(env: Env, userId: string): Promise<{ orgId: string; orgRole: string } | null> {
	const member = await membership(env, userId);
	if (!member) return null;
	await ensureOrganizationSchema(env);
	const orgRole = member.role === PM_ROLE ? 'admin' : 'member';
	await env.DB.prepare('INSERT OR IGNORE INTO org_members (org_id, user_id, org_role) VALUES (?, ?, ?)').bind(member.orgId, userId, orgRole).run();
	const stored = await env.DB.prepare('SELECT org_role FROM org_members WHERE org_id = ? AND user_id = ?').bind(member.orgId, userId).first<{ org_role: string }>();
	return { orgId: member.orgId, orgRole: stored?.org_role ?? orgRole };
}

async function projectRole(env: Env, appId: string, userId: string): Promise<string | null> {
	await ensureOrganizationSchema(env);
	const row = await env.DB.prepare('SELECT role_id FROM project_members WHERE project_id = ? AND user_id = ?').bind(appId, userId).first<{ role_id: string }>();
	return row?.role_id ?? null;
}

export async function claimOrganizationApp(env: Env, appId: string, userId: string): Promise<void> {
	const actor = await ensureOrgMember(env, userId);
	if (!actor || actor.orgRole !== 'admin') {
		throw new Error('Only the Project Manager can create an organization app.');
	}
	await env.DB.prepare('UPDATE apps SET org_id = ?, created_by = ? WHERE id = ?').bind(actor.orgId, userId, appId).run();
	await env.DB.prepare('INSERT INTO project_members (project_id, user_id, role_id) VALUES (?, ?, ?) ON CONFLICT(project_id, user_id) DO UPDATE SET role_id = excluded.role_id').bind(appId, userId, PM_ROLE).run();
}

export async function assignProjectMember(env: Env, actorId: string, input: { appId?: string; userId?: string; roleId?: string }): Promise<{ ok: boolean; message: string }> {
	const actor = await ensureOrgMember(env, actorId);
	if (!actor || actor.orgRole !== 'admin') return { ok: false, message: 'Only an Admin can assign a project.' };
	const userId = String(input.userId ?? '');
	const appId = String(input.appId ?? '');
	const roleId = String(input.roleId ?? '');
	const target = await ensureOrgMember(env, userId);
	if (!target || target.orgId !== actor.orgId) return { ok: false, message: 'That person is not in this organization.' };
	if (!permissionsForRole(roleId).includes('view')) return { ok: false, message: 'Unknown project role.' };
	const app = await env.DB.prepare('SELECT org_id FROM apps WHERE id = ?').bind(appId).first<{ org_id: string | null }>();
	if (!app?.org_id || app.org_id !== actor.orgId) return { ok: false, message: 'Project not found.' };
	await env.DB.prepare('INSERT INTO project_members (project_id, user_id, role_id) VALUES (?, ?, ?) ON CONFLICT(project_id, user_id) DO UPDATE SET role_id = excluded.role_id').bind(appId, userId, roleId).run();
	return { ok: true, message: '' };
}

export async function canDeleteProject(env: Env, appId: string, userId: string): Promise<boolean> {
	const role = await projectRole(env, appId, userId);
	return permissionsForRole(role ?? '').includes('delete');
}

export async function organizationIdFor(env: Env, userId: string): Promise<string | null> {
	await ensureOrganizationSchema(env);
	const member = await membership(env, userId);
	return member?.orgId ?? null;
}

export async function memberCanAccessApp(env: Env, appId: string, userId: string): Promise<boolean> {
	const role = await projectRole(env, appId, userId);
	return permissionsForRole(role ?? '').includes('view');
}

export async function authorizeOrganizationSocket(env: Env, userId: string, appId: string, request: Request): Promise<Request | Response> {
	const actor = await ensureOrgMember(env, userId);
	if (!actor) return new Response('Forbidden', { status: 403 });
	const role = await projectRole(env, appId, userId);
	if (!permissionsForRole(role ?? '').includes('view')) return new Response('Not found', { status: 404 });
	const headers = new Headers(request.headers);
	headers.delete('x-org-role');
	headers.delete('x-org-user');
	headers.delete('x-org-id');
	headers.set('x-org-role', role ?? '');
	headers.set('x-org-user', userId);
	headers.set('x-org-id', actor.orgId);
	return new Request(request, { headers });
}

export async function latestOrganizationApp(env: Env, userId: string): Promise<{ id: string; title: string } | null> {
	await ensureOrganizationSchema(env);
	return await env.DB.prepare('SELECT apps.id as id, apps.title as title FROM apps INNER JOIN project_members ON project_members.project_id = apps.id WHERE project_members.user_id = ? ORDER BY apps.created_at DESC LIMIT 1').bind(userId).first<{ id: string; title: string }>();
}

export async function openOrganizationQuestion(env: Env, userId: string, appId: string): Promise<{ body: string | null; waiting: string | null } | null> {
	const role = await projectRole(env, appId, userId);
	if (!role || !appId) return null;
	const open = await env.DB.prepare("SELECT target_role_id, body, status FROM questions WHERE app_id = ? AND status = 'open' ORDER BY created_at DESC LIMIT 1").bind(appId).first<{ target_role_id: string; body: string; status: string }>();
	if (!open) return { body: null, waiting: null };
	if (open.target_role_id === role) return { body: open.body, waiting: null };
	return { body: null, waiting: waitingLine(open.target_role_id) };
}

export async function publishOrganizationQuestion(input: {
	env: Env;
	appId: string;
	sockets: WebSocket[];
	args: Record<string, unknown>;
	conversationId: string;
}): Promise<void> {
	const question = firstQuestion(input.args);
	if (!question) return;
	await ensureOrganizationSchema(input.env);
	const app = await input.env.DB.prepare('SELECT org_id, user_id FROM apps WHERE id = ?').bind(input.appId).first<{ org_id: string | null; user_id: string | null }>();
	let orgId = app?.org_id ?? '';
	if (!orgId && app?.user_id) {
		const member = await membership(input.env, app.user_id);
		orgId = member?.orgId ?? '';
	}
	const existing = await input.env.DB.prepare("SELECT id, target_role_id, body FROM questions WHERE app_id = ? AND status = 'open' LIMIT 1").bind(input.appId).first<QuestionRecord>();
	let stored = existing;
	if (!stored && orgId) {
		const id = crypto.randomUUID();
		await input.env.DB.prepare('INSERT INTO questions (id, org_id, app_id, target_role_id, body, status, assignment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(id, orgId, input.appId, question.targetRole, question.body, 'open', question.assignment, Date.now()).run();
		stored = { id, org_id: orgId, app_id: input.appId, target_role_id: question.targetRole, body: question.body, status: 'open', assignment: question.assignment };
	}
	void stored;
	void input.sockets;
}

export async function acceptOrganizationAnswer(env: Env, appId: string, connection: WebSocket, message: string): Promise<{ allow: boolean; message: string }> {
	await ensureOrganizationSchema(env);
	const actor = readOrganizationRole(connection);
	const text = message.trim();
	const open = await env.DB.prepare("SELECT id, target_role_id, status FROM questions WHERE app_id = ? AND status = 'open' ORDER BY created_at DESC LIMIT 1").bind(appId).first<{ id: string; target_role_id: string; status: string }>();
	if (!open || !actor) return { allow: false, message: 'Enter sends only when a question is addressed to you.' };
	if (open.target_role_id !== actor.role) return { allow: false, message: waitingLine(open.target_role_id) };
	if (!text) return { allow: false, message: 'Enter sends only when a question is addressed to you.' };
	try {
		await env.DB.prepare('INSERT INTO answers (question_id, user_id, body, created_at) VALUES (?, ?, ?, ?)').bind(open.id, actor.userId, text, Date.now()).run();
	} catch {
		return { allow: false, message: 'This question already has an answer.' };
	}
	await env.DB.prepare("UPDATE questions SET status = 'answered' WHERE id = ? AND status = 'open'").bind(open.id).run();
	return { allow: true, message: '' };
}

export async function redactConversation(env: Env, appId: string, connection: WebSocket, state: unknown): Promise<unknown> {
	await ensureOrganizationSchema(env);
	const actor = readOrganizationRole(connection);
	const rows = await env.DB.prepare('SELECT body, target_role_id FROM questions WHERE app_id = ?').bind(appId).all<{ body: string; target_role_id: string }>();
	const hidden = (rows.results ?? []).filter((row) => row.target_role_id !== actor?.role);
	return stripBodies(state, hidden);
}

function stripBodies(value: unknown, hidden: { body: string; target_role_id: string }[]): unknown {
	if (hidden.length === 0) return value;
	const walk = (current: unknown): unknown => {
		if (typeof current === 'string') {
			let next = current;
			for (const question of hidden) {
				if (question.body && next.includes(question.body)) next = next.split(question.body).join(waitingLine(question.target_role_id));
			}
			return next;
		}
		if (Array.isArray(current)) return current.map(walk);
		if (!current || typeof current !== 'object') return current;
		const record: Record<string, unknown> = {};
		for (const [key, child] of Object.entries(current as Record<string, unknown>)) record[key] = walk(child);
		if (record.name === 'ask_questions' && record.args && typeof record.args === 'object') {
			const args = record.args as Record<string, unknown>;
			const questions = Array.isArray(args.questions) ? args.questions : [];
			args.questions = questions.filter((item) => {
				if (!item || typeof item !== 'object') return false;
				const text = (item as { question?: unknown }).question;
				return typeof text === 'string' && !hidden.some((question) => question.body === text);
			});
		}
		return record;
	};
	return walk(value);
}
