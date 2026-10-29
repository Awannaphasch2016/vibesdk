import { Hono } from 'hono';
import { AppEnv } from '../../types/appenv';
import { adaptController } from '../honoAdapter';
import { AuthConfig, setAuthLevel } from '../../middleware/auth/routeAuth';
import { OrgController } from '../controllers/org/controller';

export function setupOrgRoutes(app: Hono<AppEnv>): void {
	const router = new Hono<AppEnv>();
	router.get('/app', setAuthLevel(AuthConfig.authenticated), adaptController(OrgController, OrgController.currentApp));
	router.get('/question', setAuthLevel(AuthConfig.authenticated), adaptController(OrgController, OrgController.question));
	router.post('/assign', setAuthLevel(AuthConfig.authenticated), adaptController(OrgController, OrgController.assign));
	app.route('/api/org', router);
}
