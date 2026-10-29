import { BaseController } from '../baseController';
import type { RouteContext } from '../../types/route-context';
import { assignProjectMember, latestOrganizationApp, openOrganizationQuestion } from '../../../services/org/run';

export class OrgController extends BaseController {
	static async currentApp(_request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext) {
		const user = context.user;
		if (!user) return OrgController.createErrorResponse('Authentication required', 401);
		const app = await latestOrganizationApp(env, user.id);
		return OrgController.createSuccessResponse(app ?? null);
	}

	static async question(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext) {
		const user = context.user;
		if (!user) return OrgController.createErrorResponse('Authentication required', 401);
		const appId = new URL(request.url).searchParams.get('appId') ?? '';
		const view = await openOrganizationQuestion(env, user.id, appId);
		if (!view) return OrgController.createErrorResponse('Not found', 404);
		return OrgController.createSuccessResponse(view);
	}

	static async assign(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext) {
		const user = context.user;
		if (!user) return OrgController.createErrorResponse('Authentication required', 401);
		const body = await request.json().catch(() => ({}));
		const result = await assignProjectMember(env, user.id, body as { appId?: string; userId?: string; roleId?: string });
		if (!result.ok) return OrgController.createErrorResponse(result.message, 403);
		return OrgController.createSuccessResponse({ assigned: true });
	}
}
