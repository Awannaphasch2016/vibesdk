import { eq } from 'drizzle-orm';
import { createDatabaseService } from '../../../database/database';
import * as schema from '../../../database/schema';
import { SessionService } from '../../../database/services/SessionService';
import { BaseController } from '../baseController';
import {
	formatAuthResponse,
	mapUserResponse,
	setSecureAuthCookies,
} from '../../../utils/authUtils';

type GateRow = { org_id?: string; role_id?: string; organization?: string | null };

const LAST_REFUSAL_KEY = 'shared-sign-in:last';

class SignInRefusal extends Error {
	constructor(readonly code: string) {
		super('Sign in to continue.');
	}
}

async function recordAttempt(env: Env, code: string): Promise<void> {
	try {
		await env.VibecoderStore.put(
			LAST_REFUSAL_KEY,
			JSON.stringify({ code, at: new Date().toISOString() }),
			{ expirationTtl: 86400 },
		);
	} catch {
		// The attempt record is diagnostic only.
	}
}

function refusalCode(error: unknown): string {
	return error instanceof SignInRefusal ? error.code : 'unexpected';
}

function binding(env: Env, name: string): string {
	return String((env as unknown as Record<string, unknown>)[name] ?? '').trim();
}

function sessionToken(authorization: string | null, cookie: string | null): string {
	const bearer = authorization?.startsWith('Bearer ')
		? authorization.slice('Bearer '.length).trim()
		: '';
	if (bearer) return bearer;
	const match = /(?:^|;\s*)__session=([^;]+)/.exec(cookie ?? '');
	return match ? decodeURIComponent(match[1]) : '';
}

async function clerkIdentity(env: Env, token: string): Promise<{ userId: string; email: string; emailVerified: boolean; name: string }> {
	const secret = binding(env, 'CLERK_SECRET_KEY');
	const publishable = binding(env, 'CLERK_PUBLISHABLE_KEY');
	if (!secret.startsWith('sk_test_') || !publishable.startsWith('pk_test_')) {
		throw new SignInRefusal('clerk-keys');
	}
	const frontendApi = atob(publishable.slice('pk_test_'.length)).replace(/\$$/, '');
	const jwksResponse = await fetch(`https://${frontendApi}/.well-known/jwks.json`);
	if (!jwksResponse.ok) throw new SignInRefusal('jwks');
	const jwks = (await jwksResponse.json()) as { keys: (JsonWebKey & { kid?: string })[] };
	const [headerPart, payloadPart, signaturePart] = token.split('.');
	if (!headerPart || !payloadPart || !signaturePart) throw new SignInRefusal('token-shape');
	const decode = (value: string) => {
		const padded = value.replace(/-/g, '+').replace(/_/g, '/');
		return atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
	};
	const header = JSON.parse(decode(headerPart)) as { kid?: string };
	const jwk = jwks.keys.find((key) => key.kid === header.kid);
	if (!jwk) throw new SignInRefusal('token-key');
	const key = await crypto.subtle.importKey(
		'jwk',
		jwk,
		{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
		false,
		['verify'],
	);
	const signature = Uint8Array.from(decode(signaturePart), (char) => char.charCodeAt(0));
	const signed = await crypto.subtle.verify(
		'RSASSA-PKCS1-v1_5',
		key,
		signature,
		new TextEncoder().encode(`${headerPart}.${payloadPart}`),
	);
	if (!signed) throw new SignInRefusal('token-signature');
	const payload = JSON.parse(decode(payloadPart)) as { sub?: string; exp?: number };
	if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) {
		throw new SignInRefusal('token-expired');
	}
	if (!payload.sub) throw new SignInRefusal('token-subject');
	const userResponse = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(payload.sub)}`, {
		headers: { Authorization: `Bearer ${secret}` },
	});
	if (!userResponse.ok) throw new SignInRefusal(`clerk-user-${userResponse.status}`);
	const user = (await userResponse.json()) as {
		first_name?: string | null;
		last_name?: string | null;
		primary_email_address_id?: string;
		email_addresses?: {
			id: string;
			email_address: string;
			verification?: { status?: string } | null;
		}[];
	};
	const address =
		user.email_addresses?.find((item) => item.id === user.primary_email_address_id) ??
		user.email_addresses?.[0];
	if (!address?.email_address) throw new SignInRefusal('clerk-email');
	const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
	return {
		userId: payload.sub,
		email: address.email_address.toLowerCase(),
		emailVerified: address.verification?.status === 'verified',
		name: name || address.email_address.split('@')[0],
	};
}

async function neonQuery(databaseUrl: string, query: string, params: string[]): Promise<GateRow[]> {
	const endpoint = new URL(databaseUrl);
	const host = endpoint.hostname.replace('-pooler.', '.');
	endpoint.hostname = host;
	const response = await fetch(`https://${host}/sql`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Neon-Connection-String': endpoint.toString(),
		},
		body: JSON.stringify({ query, params }),
	});
	if (!response.ok) throw new SignInRefusal(`membership-query-${response.status}`);
	const payload = (await response.json()) as {
		fields?: { name: string }[];
		rows?: unknown[];
	};
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

async function gateFor(env: Env, userId: string): Promise<{
	signedIn: true;
	organization: string | null;
	role: string | null;
	refusal: string | null;
}> {
	const databaseUrl = binding(env, 'WEWEBPLUS_DATABASE_URL');
	if (!databaseUrl) {
		return { signedIn: true, organization: null, role: null, refusal: 'membership-store' };
	}
	const memberships = await neonQuery(
		databaseUrl,
		'select org_id, role_id from wewebplus.memberships where user_id = $1',
		[userId],
	);
	const usable = memberships.filter(
		(row) => row.role_id === 'project-manager' || row.role_id === 'developer',
	);
	if (usable.length !== 1) {
		return {
			signedIn: true,
			organization: null,
			role: null,
			refusal: `gate-roles-${usable.length}`,
		};
	}
	const orgId = String(usable[0].org_id ?? '');
	const secret = binding(env, 'CLERK_SECRET_KEY');
	let organization: string | null = null;
	let refusal: string | null = orgId ? null : 'organization-id';
	if (secret && orgId) {
		const response = await fetch(`https://api.clerk.com/v1/organizations/${encodeURIComponent(orgId)}`, {
			headers: { Authorization: `Bearer ${secret}` },
		});
		if (response.ok) {
			const org = (await response.json()) as { name?: string };
			organization = org.name ?? null;
			if (!organization) refusal = 'organization-name';
		} else {
			refusal = `organization-${response.status}`;
		}
	}
	return {
		signedIn: true,
		organization,
		role: usable[0].role_id === 'project-manager' ? 'Project Manager' : 'Developer',
		refusal,
	};
}

export class SharedSignInController extends BaseController {
	static async clerk(_request: Request, env: Env): Promise<Response> {
		const key = binding(env, 'CLERK_PUBLISHABLE_KEY');
		if (!key.startsWith('pk_test_')) {
			return SharedSignInController.createErrorResponse('Sign in is not available.', 404);
		}
		return SharedSignInController.createSuccessResponse({ publishableKey: key });
	}

	static async session(request: Request, env: Env): Promise<Response> {
		const token = sessionToken(request.headers.get('Authorization'), request.headers.get('Cookie'));
		if (!token) {
			return Response.json({ signedIn: false, organization: null, role: null });
		}
		try {
			const identity = await clerkIdentity(env, token);
			const gate = await gateFor(env, identity.userId);
			if (!gate.role) {
				return Response.json({ signedIn: true, organization: null, role: null });
			}
			return Response.json({
				signedIn: true,
				organization: gate.organization,
				role: gate.role,
			});
		} catch {
			return Response.json({ signedIn: false, organization: null, role: null });
		}
	}

	static async miss(_request: Request, env: Env): Promise<Response> {
		await recordAttempt(env, 'browser-no-clerk-token');
		return Response.json({ recorded: true });
	}

	static async last(_request: Request, env: Env): Promise<Response> {
		const stored = await env.VibecoderStore.get(LAST_REFUSAL_KEY);
		return Response.json(stored ? JSON.parse(stored) : { code: null, at: null });
	}

	static async shared(request: Request, env: Env): Promise<Response> {
		const token = sessionToken(request.headers.get('Authorization'), request.headers.get('Cookie'));
		if (!token) {
			await recordAttempt(env, 'no-token');
			return SharedSignInController.createErrorResponse('Sign in to continue.', 401);
		}
		try {
			const identity = await clerkIdentity(env, token);
			const gate = await gateFor(env, identity.userId);
			if (!gate.role || !gate.organization) {
				await recordAttempt(env, gate.refusal ?? 'gate');
				return SharedSignInController.createErrorResponse('Sign in to continue.', 403);
			}
			const database = createDatabaseService(env).db;
			let user = await database
				.select()
				.from(schema.users)
				.where(eq(schema.users.id, identity.userId))
				.get();
			if (!user) {
				const byEmail = await database
					.select()
					.from(schema.users)
					.where(eq(schema.users.email, identity.email))
					.get();
				if (byEmail) {
					if (!identity.emailVerified) {
						await recordAttempt(env, 'email-unverified');
						return SharedSignInController.createErrorResponse('Sign in to continue.', 403);
					}
					if (byEmail.isSuspended || byEmail.deletedAt) {
						await recordAttempt(env, 'email-taken');
						return SharedSignInController.createErrorResponse('Sign in to continue.', 403);
					}
					user = byEmail;
				} else {
					const now = new Date();
					try {
						await database.insert(schema.users).values({
							id: identity.userId,
							email: identity.email,
							displayName: identity.name,
							emailVerified: true,
							provider: 'email',
							providerId: identity.userId,
							createdAt: now,
							updatedAt: now,
						});
					} catch {
						throw new SignInRefusal('user-insert');
					}
					user = await database
						.select()
						.from(schema.users)
						.where(eq(schema.users.id, identity.userId))
						.get();
				}
			}
			if (!user) {
				await recordAttempt(env, 'user-row');
				return SharedSignInController.createErrorResponse('Sign in to continue.', 403);
			}
			const sessionService = new SessionService(env);
			let created: Awaited<ReturnType<SessionService['createSession']>>;
			try {
				created = await sessionService.createSession(user.id, request);
			} catch {
				throw new SignInRefusal('session-create');
			}
			const response = SharedSignInController.createSuccessResponse({
				...formatAuthResponse(mapUserResponse(user), created.session.sessionId, created.session.expiresAt),
				organization: gate.organization,
				role: gate.role,
			});
			setSecureAuthCookies(response, {
				accessToken: created.accessToken,
				accessTokenExpiry: SessionService.config.sessionTTL,
			});
			await recordAttempt(env, user.id === identity.userId ? 'ok' : 'ok-linked');
			return response;
		} catch (error) {
			await recordAttempt(env, refusalCode(error));
			return SharedSignInController.createErrorResponse('Sign in to continue.', 401);
		}
	}
}
