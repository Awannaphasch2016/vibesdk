# Vibe SDK minimal host

This is the handoff for the selected Vibe SDK host. The approved permission model and the in-chat question are implemented on this branch. The two-role demo uses the pin's default Think behavior. Docker stays specified below and waits until that agent is ready. There is no two-browser CI job on this branch. Manual testing uses the `preview-vibesdk` label.

The older swarm plan in [plans/vibesdk-agent-hitl.md](vibesdk-agent-hitl.md) is superseded for this selection. Its scripted-agent proof is not the selected design.

## Related pull requests

The implementation stack, parent to child, is [#68](https://github.com/Awannaphasch2016/dyad/pull/68) → [#124](https://github.com/Awannaphasch2016/dyad/pull/124) → [#128](https://github.com/Awannaphasch2016/dyad/pull/128) → [#135](https://github.com/Awannaphasch2016/dyad/pull/135) → [#138](https://github.com/Awannaphasch2016/dyad/pull/138) → [#143](https://github.com/Awannaphasch2016/dyad/pull/143) → [#153](https://github.com/Awannaphasch2016/dyad/pull/153) → [#158](https://github.com/Awannaphasch2016/dyad/pull/158) → [#161](https://github.com/Awannaphasch2016/dyad/pull/161) → [#164](https://github.com/Awannaphasch2016/dyad/pull/164) → [#165](https://github.com/Awannaphasch2016/dyad/pull/165) → [#166](https://github.com/Awannaphasch2016/dyad/pull/166) → [#167](https://github.com/Awannaphasch2016/dyad/pull/167) → [#168](https://github.com/Awannaphasch2016/dyad/pull/168) → [#170](https://github.com/Awannaphasch2016/dyad/pull/170). This branch starts from the organization snapshot in #135 and does not carry the later commits.

| Pull request | What it decided, and what this branch did with it |
| --- | --- |
| [#68](https://github.com/Awannaphasch2016/dyad/pull/68) | Preview worker, D1, and the `preview-vibesdk` label. Kept. |
| [#86](https://github.com/Awannaphasch2016/dyad/pull/86) | Plan for the shared Clerk session. The session code that landed with the preview is kept (`vibesdk-shared-role` only). |
| [#121](https://github.com/Awannaphasch2016/dyad/pull/121), [#127](https://github.com/Awannaphasch2016/dyad/pull/127) | Plans for an agent-driven loop on the existing prompt box. Kept as the product rule. The scripted proof was not. |
| [#124](https://github.com/Awannaphasch2016/dyad/pull/124) | Scripted two-role card. Left out. [#128](https://github.com/Awannaphasch2016/dyad/pull/128) replaced it with the real prompt box. |
| [#128](https://github.com/Awannaphasch2016/dyad/pull/128) | Project Manager creates from the existing prompt box. Developer Enter does not. Kept. |
| [#129](https://github.com/Awannaphasch2016/dyad/pull/129), [#134](https://github.com/Awannaphasch2016/dyad/pull/134) | Plans for organization belonging. The code landed in #135. This branch keeps `org_id` and `created_by`, then limits opening to `project_members`. |
| [#135](https://github.com/Awannaphasch2016/dyad/pull/135) | Creating an app does not make the creator the owner, and every organization member could open it. The owner part stays. The "every member" part is replaced by project assignment. |
| [#137](https://github.com/Awannaphasch2016/dyad/pull/137), [#138](https://github.com/Awannaphasch2016/dyad/pull/138) | Named turns and a locked waiting box. The two-view rule stays (named role sees the body, the other sees the waiting line). The lock icon, account-name labels, and the box chrome do not. |
| [#139](https://github.com/Awannaphasch2016/dyad/pull/139), [#143](https://github.com/Awannaphasch2016/dyad/pull/143) | Avatars and the Orange "Response required" card. Left out. |
| [#147](https://github.com/Awannaphasch2016/dyad/pull/147), [#153](https://github.com/Awannaphasch2016/dyad/pull/153) | Owe `generate_all` before the socket opens. Left out. The pin already sends `generate_all` after the handshake. |
| [#157](https://github.com/Awannaphasch2016/dyad/pull/157), [#158](https://github.com/Awannaphasch2016/dyad/pull/158) | Session chrome and extra shared-session keys. Left out. |
| [#161](https://github.com/Awannaphasch2016/dyad/pull/161), [#164](https://github.com/Awannaphasch2016/dyad/pull/164), [#165](https://github.com/Awannaphasch2016/dyad/pull/165), [#166](https://github.com/Awannaphasch2016/dyad/pull/166), [#167](https://github.com/Awannaphasch2016/dyad/pull/167), [#168](https://github.com/Awannaphasch2016/dyad/pull/168), [#170](https://github.com/Awannaphasch2016/dyad/pull/170) | Methodology catalogs, phase packs, Spec Kit, and the one-shop recording. Left out. Do not treat #170 as this host. |

Merged Dyad HITL pull requests #7, #8, #9, and #12 are the Wewebplus membership tables this host reads. They are not Vibe SDK code. Do not alter them.

## Locked decisions

- The only typing place is the Vibe SDK prompt box that already exists. A reply is the next user message on the existing `USER_SUGGESTION` websocket path. There is no second text field.
- Only the Project Manager can create an app. The server gate is `assertProjectManager`. The home screen also returns early when the shared session role contains `Developer`, so a Developer press of Enter does not navigate into a new chat. The server gate is the one that counts. Create happens before a project row exists, so it still reads the Wewebplus role. On create, the creator is inserted into `project_members` as `project-manager`. Otherwise they could not see the app they started.
- There is no private app. An app row stores `org_id` and `created_by`. `created_by` records who used the permission. It is not an access check. A person sees a project only when `project_members` has a row for them. An Admin does not automatically see every project. An Admin can assign themselves.
- Permissions are hardcoded. `project-manager` can view, start, and delete. `developer` can view. There is no `role_permissions` table and no per-project override.
- Admin is an organization role on `org_members.org_role` (`admin` or `member`), not a project role and not a Wewebplus role. The Wewebplus project manager is inserted as `admin`. The Wewebplus developer is inserted as `member`. `INSERT OR IGNORE` keeps an existing admin from being demoted. Assigning another user requires `org_role = admin` and an existing organization member, then inserts `project_members`. `POST /api/org/assign` is that path. The two-browser spec calls it so the Developer can open the app.
- A person can be Admin of the organization and `project-manager` on a project. Those are two rows.
- Delete belongs to the project-manager role. Every project manager assigned to that project can delete it. The delete statement matches the app id and does not also require `apps.user_id` to be the caller. A developer cannot delete.
- The last-admin guard is not implemented. If the only admin demotes themselves, project access through `project_members` still works, and nobody can assign people until `org_members` is edited by hand. Do not add the guard unless a later request asks for it.
- Roles for the organization roster are read from `wewebplus.memberships` (`org_id`, `role_id` for the Clerk user id). Exactly one `project-manager` or `developer` row is usable. Shared `wewebplus` tables are not altered. Do not write `admin` into `wewebplus.memberships.role_id`. This run's app, membership, question, and answer rows live in the preview's own D1 database.
- One question is open at a time. An unnamed or unknown role is stored as `project-manager` with `assignment = 'fallback'`. Requirements and UX go to the Project Manager. Files, code, and technical choices go to the Developer. The socket role is the project role from `project_members`, so the person who can answer is the person assigned that project role.
- The named role sees the question body in the chat transcript (`data-testid="org-question"`). The other role sees one waiting line there, `Waiting on the Project Manager.` or `Waiting on the Developer.` (`data-testid="org-waiting"`), and does not see the body. The line is not dismissible. The clarifying-question panel is not mounted (`aboveContent={null}`). The prompt box unlocks only when the poll returns a body for that role. One answer is stored once. A second answer does not resume the run.
- The display is the open row from `GET /api/org/question`, polled from the chat. `publishOrganizationQuestion` stores the row and does not also push the body as a conversation message, so the question is not shown twice. A refresh keeps the row.
- The accepted answer is the next user message. That message starts the next run unit.
- Think stays the default behavior, as the pin wrote it. This branch does not retarget Think at OpenRouter, does not change the preview iframe, and does not add a static-site deploy.
- The Docker agent is a fourth behavior, selected in `CodeGeneratorAgent`, sibling of `ThinkCodingBehavior`. It is not a mode inside `ThinkAgent`. One container execution replaces the single `stub.chat()` call. The host does not evaluate model output to choose a next phase, and it does not wrap the container in the later eight-call bead loop. That behavior file is not written yet.
- Both browsers share one `CodeGeneratorAgent` and one `SpaceDO`. The editor file list is the shared generated code. There is no fleet type.
- Electron, Gas City formula files, hitl-web, Bolt, phase permissions, Discovery/Implementation/Delivery, Continue, and the phase-approval button stay out. Do not vendor upstream methodology skills. The host does not run `gc`.
- Gallery changes stay refused (`Changing the gallery flag is not available.`). `Make public` stays hidden. `visibility` stays the unused gallery flag. It is not belonging and not who may press Enter. GitHub repository visibility is a different column.

## What this branch contains

Pin: `VIBESDK_SHA` in `deploy/preview/vibesdk.mjs` is `9da158d82c597a0e8f4bf033cdccd1053fb6fb15` (`https://github.com/cloudflare/vibesdk.git`). Deploy-time patches apply onto a detached checkout of that commit. This repository does not contain the Vibe SDK source.

Kept from the organization snapshot (the commit that let organization members open the app without making the creator the owner), plus the shared-auth preview that snapshot already sat on:

- `deploy/preview/vibesdk.mjs` — preview names, Wrangler config, lab and production refusal, and `patchWorkerExports` (drops the `UserAppSandboxService` export). No model patch.
- `deploy/preview/vibesdk-preview.mjs` — clone the pin, drop the sandbox export, apply Clerk shared sign-in, apply the organization run, deploy the per-PR worker. Think is logged as `think_behavior=upstream`. The worker does not receive `OPENROUTER_API_KEY`.
- `deploy/preview/vibesdk-shared-auth.mjs` — Clerk session already used by the preview. The role is stored as `vibesdk-shared-role` and removed on sign-out. Later session keys for the account name and the organization name are not included.
- `deploy/preview/vibesdk-org-run.mjs` — organization schema, `org_members`, `project_members`, membership read, create gate, question and answer rows, role filter, assign route, and the temporary Think intercept described below.
- `deploy/preview/vibesdk-cloudflare.mjs` — per-PR D1, KV, and R2. Lab and production ids are refused.
- `deploy/preview/clerk-origins.mjs` — allow the preview `workers.dev` origin. The lab host is not added.
- `deploy/preview/transition.mjs` — `preview-vibesdk` is its own label. The Dyad `preview` label does not deploy this worker.
- `.github/workflows/preview-vibesdk.yml` — deploy and destroy. The two-browser job is still gated on branch `cursor/vibesdk-org-belonging-0539`, so this branch does not run it.
- `e2e-vibesdk/` — two browsers, walkthrough Project Manager and Developer. `OPENROUTER_API_KEY` is used only by `answerQuestion` in `e2e-vibesdk/tests/two-roles.spec.js`, which reads the question that appeared and types the reply into the prompt box. Playwright does not memorize the question.
- `scripts/doppler/vibesdk-hitl-accounts.mjs` — looks up the existing walkthrough accounts. Do not seed a second pair. Do not modify the human Google or Microsoft accounts.

`package.json` runs `deploy/preview/vibesdk-org-run.test.mjs` in the `node --test` list, before Vitest.

## What this branch removed

These were on the organization snapshot and are not selected:

- `patchThinkModel` and `patchThinkRouting`. Think is not rewritten to `anthropic/claude-sonnet-4.5` on OpenRouter, and `directOverride` is not injected. The routing patch's insertion of `configureThinkAgent()` at the start of `build()` is gone with it. The pin still configures Think from `initialize`. Organization `patchThink` does not add another `configureThinkAgent` call.
- `OPENROUTER_API_KEY` as a worker secret. The e2e answerer still reads that key from the job environment.
- `patchAppCreationLimit`. The pin's app-creation cap stays.
- `patchStaticSiteDeploy`, `patchPreviewServing`, `commitHasAppClass`, `collectStaticWebAssets`, and `previewProbeDecision`. A generated site is not rewritten into `__vibesdk_static_site__`.
- `patchPreviewPane`. The preview iframe keeps the pin's retry behavior.

## What was not brought forward

| Source                                                                                     | Left out                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scripted question card                                                                     | The scripted agent and its card.                                                                                                                                           |
| Named-turn and avatar PRs                                                                  | Account-name chat labels, avatars, the Orange card, and the "Response required" panel.                                                                                     |
| Owed `generate_all`                                                                        | The pin already sends `generate_all` from the websocket after the handshake.                                                                                               |
| Session-scope PR                                                                           | Clearing organization UI state on app switch, and the extra shared-session keys. The header chip from shared auth stays.                                                   |
| Methodology catalog through the one-shop run                                               | Step catalogs, write-before-ask, the eight-call bead loop, narration stripping, Spec Kit recordings, shop-preview gating, preview-retry changes, and saved-website deploy. |
| Lab worker, Doppler project setup, Forma key copy, Bolt, Gas City formulas, Dyad phase bar | Out of this product.                                                                                                                                                       |

## Behavior that is implemented today

`applyOrganizationRun` writes `worker/services/org/run.ts` onto the pin and patches the files listed at the bottom of `deploy/preview/vibesdk-org-run.mjs`.

D1 statements, applied idempotently on the preview database only:

```sql
ALTER TABLE apps ADD COLUMN org_id TEXT
ALTER TABLE apps ADD COLUMN created_by TEXT
CREATE TABLE IF NOT EXISTS org_members (
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  org_role TEXT NOT NULL,
  PRIMARY KEY (org_id, user_id)
)
CREATE TABLE IF NOT EXISTS project_members (
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  PRIMARY KEY (project_id, user_id)
)
CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  app_id TEXT NOT NULL,
  target_role_id TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL,
  assignment TEXT NOT NULL,
  created_at INTEGER NOT NULL
)
CREATE TABLE IF NOT EXISTS answers (
  question_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
)
```

`answers.question_id` is the primary key, so a second insert fails and `acceptOrganizationAnswer` returns `This question already has an answer.` The question status moves to `answered` only after that insert.

Membership query, read-only:

```sql
select org_id, role_id from wewebplus.memberships where user_id = $1
```

Create: `assertProjectManager` on the agent create controller, then `claimOrganizationApp` sets `org_id` and `created_by` and inserts the creator into `project_members` as `project-manager`. It also inserts the creator into `org_members` as `admin` when that row is missing. Open and socket: `memberCanAccessApp` and `authorizeOrganizationSocket` require a `project_members` row whose role includes `view`. The socket header `x-org-role` is that project role. Someone with no row gets 404. A user with no Wewebplus membership gets 403.

Question path while Think is still the behavior that asks:

1. `patchAskQuestionsTool` adds optional `targetRole` to the pin's `ask_questions` tool.
2. `patchThink` changes the clarify prompt to exactly one question and, inside the tool-output branch of the stream, calls `publishOrganizationQuestion` and returns. It does not broadcast that tool call on the normal path.
3. `publishOrganizationQuestion` stores one open row. It does not push the body onto the socket. The chat polls `GET /api/org/question` and renders one transcript line.
4. `patchWebsocket` runs `acceptOrganizationAnswer` before `handleUserInput`. A refusal sends the waiting line and does not start a run. An acceptance lets the existing `USER_SUGGESTION` path queue the text.
5. `redactConversation` strips a hidden body from transcript state sent to the other role.

`patchThink` also holds streaming text until the turn ends, drops reasoning deltas, and suppresses the final text while `organizationHold` is set. That is part of this temporary intercept, not a separate product feature. Deleting `patchThink` in the cleanup step below removes it.

The named role's transcript line is `data-testid="org-question"`. The other role's line is `data-testid="org-waiting"`. The clarifying-question panel is replaced with `aboveContent={null}`, and the popup component returns null so a dismiss control cannot hide the question.

## Gallery refusal and project-manager delete

`patchAppService` sets `isOwner: mayOpen` from project assignment, so the pin's owner-only middleware lets an assigned member through. The header owner flag stays off, the visibility icon is removed, and the private-visibility 404 is skipped for an assigned member. Gallery changes stay refused (`Changing the gallery flag is not available.`). The two-browser spec asserts that neither role sees `Make public`.

Delete is allowed when `canDeleteProject` is true, which is the `project-manager` project role. The delete matches `apps.id` only, so a second project manager assigned to that app can delete it. A developer receives `Deleting an app is not available.`

`visibility` remains the pin's gallery flag. Do not reinterpret it as belonging. GitHub repository visibility is a different column.

Owner-only routes other than delete and visibility (the git clone token and the preview token) follow `mayOpen`. An assigned developer can pass those middleware checks. They are not a separate product decision in this change. Leave them unless a later request refuses them.

## Question in the chat

The named role sees the body in the message list. The other role sees one waiting line. The reply is typed in the prompt box. The panel above the box is gone. The poll is the only copy of the question, so a websocket message is not sent with the same text.

## Why Think cannot be the Docker integration point

Verified on the pin:

- `BehaviorType` is `'phasic' | 'agentic' | 'think'` in `worker/agents/core/types.ts`.
- `CodeGeneratorAgent` startup in `worker/agents/core/codingAgent.ts` chooses the behavior: `behaviorType` from props, else a persisted `phasic` | `agentic` | `think` value, else `getBehaviorTypeForProject(projectType)`. `phasic` constructs `PhasicCodingBehavior`. `think` constructs `ThinkCodingBehavior`. Anything else constructs `AgenticCodingBehavior`.
- Project type `app` defaults to `think` in `DEFAULT_FEATURE_DEFINITIONS` (`worker/agents/core/features/types.ts`). Leave that default. Docker is selected only when `behaviorType` is `docker`.
- `ThinkAgent` (`worker/agents/think/ThinkAgent.ts`) extends `@cloudflare/think`. It has no `build()` and does not choose behaviors. `maxSteps = 25` stays inside the Think package.
- `ThinkCodingBehavior.build()` only drains `pendingUserInputs`. It stops when the queue is empty or `runPrompt` throws. `generateAllFiles` calls `build()` once. It is not a "run N times" setting.
- `runPrompt` is the single `stub.chat(text, forwarder)` call. That is the run unit a container replaces.
- `ask_questions` in the pin is a no-op that returns JSON. The host sees it on the stream. The model's next user message is the answer. The host does not cancel `chat()` when the tool runs.
- One app is one `CodeGeneratorAgent`, one Think durable object when the behavior is Think, and one `SpaceDO` keyed by the agent id. The durable object name is the app id. It is not an implementation selector.
- Inputs that exist today are the user text (`state.query` / `USER_SUGGESTION`) and the optional `behaviorType`. No image, harness URL, or spec object is passed.

The methodology outer loop of up to eight `chat()` calls is not on this branch. Do not add it around the container.

`previewWranglerConfig` refuses `containers`, `dispatch_namespaces`, `ai`, `browser`, and a `UserAppSandboxService` binding. A Cloudflare Container binding for the builder would have to change that refusal. Do not relax it in order to host the generated-app sandbox.

## Remaining work: Docker behavior

Add `deploy/preview/vibesdk-docker-behavior.mjs`. Apply it from `provisionPreview` in `deploy/preview/vibesdk-preview.mjs` after `applyOrganizationRun`. Do not edit the pin inside this repository. Read the pin at `VIBESDK_SHA` before writing anchors; the patch must throw if an anchor is missing, the same way `requireAnchor` does in the organization module.

### 1. Extend the behavior union

Patch `worker/agents/core/types.ts` so `BehaviorType` includes `'docker'`.

Patch the startup `if` / `else` in `worker/agents/core/codingAgent.ts`:

- `phasic` → `PhasicCodingBehavior`
- `think` → `ThinkCodingBehavior`
- `docker` → `DockerCodingBehavior`
- otherwise → `AgenticCodingBehavior`

Persist `docker` the same way the other three values are persisted. Do not change the `app` default away from `think`. A caller opts in by passing `behaviorType: 'docker'` when the agent is created. `getConversationMessageLoader` can keep the Think loader for `think` only. Docker transcript messages are the host broadcasts already used by `runPrompt` (the streaming conversation response). Do not read them from the Think durable object.

### 2. Add `DockerCodingBehavior`

New file on the pin, sibling of `worker/agents/core/behaviors/think.ts`. Extend the same coding-behavior base Think extends, so `generateAllFiles` → `buildWrapper` → `build()` still drains the queue.

Replace the body of `runPrompt` (or override `runPrompt`) with one harness call. Do not call `stub.chat`. Do not construct `ThinkAgent`. Do not loop.

Suggested request from the host to the harness:

```json
{
  "appId": "<agent id>",
  "text": "<the queued user message>"
}
```

`text` is `state.query` on the first build, and the accepted prompt-box message on every later build. The host does not send a phase name.

Suggested response:

```json
{
  "status": "completed",
  "files": [{ "path": "src/App.tsx", "contents": "..." }]
}
```

or:

```json
{
  "status": "waiting",
  "files": [],
  "waiting": {
    "targetRole": "project-manager",
    "body": "What is the shop called?",
    "assignment": "declared"
  }
}
```

`status` is only `completed` or `waiting`. `targetRole` is `project-manager` or `developer`. Omit `targetRole` to mean fallback: the host's existing `assignRole` stores `project-manager` and `assignment = 'fallback'`. When the harness sends `assignment`, persist that value; do not invent a third role.

The harness owns its model and tool loop. The host waits for this one response and then returns from `runPrompt`. A `waiting` result ends the run unit. The next `USER_SUGGESTION` that `acceptOrganizationAnswer` allows is the next request's `text`.

### 3. Where the harness runs

Prefer an HTTPS endpoint configured on the preview worker (a var such as `DOCKER_HARNESS_URL`), called once per `runPrompt`. That does not require a `containers` binding, so the resource refusal in `previewWranglerConfig` stays.

Use a Cloudflare Container binding only if the harness must run as a container on this account. That choice changes `previewConfigViolations` to allow that one binding. It must still refuse `UserAppSandboxService`, lab names, production names, and `build.cloudflare.dev`. Do not point the binding at the lab worker.

The image and the endpoint are not in this repository. Supply them outside the pin. Do not copy shared Cloudflare tokens from Gas City, Dyad preview, Bolt, or Forma into a new use, and do not print secrets.

### 4. Write files into the shared project

On every result, write `files` into the app's `SpaceDO` before broadcasting success. Use the same workspace RPCs the pin's Think write tool uses (`worker/agents/think/space-workspace-ops.ts`, reached from the write tool in `ThinkAgent`). Read those functions on the pin and call them. Do not add a second file store.

Empty `files` is valid for a question-only result. The editor file list is the shared view. Do not patch `preview-iframe.tsx`. Do not call `deploy_space` from the host. A sandbox preview of the generated site is out of this selection.

### 5. Ask through the host, then delete the Think intercept

For `status: "waiting"`:

1. Call `publishOrganizationQuestion` with `args` shaped as `{ questions: [{ question: waiting.body, targetRole: waiting.targetRole }] }`.
2. Return from `runPrompt`. Do not call the harness again.

`acceptOrganizationAnswer` and `patchWebsocket` already turn the next prompt-box message into the next run unit and reject the other role and a second answer. Leave that gate on the host. Do not put the role check inside the container.

After the Docker behavior is the path that asks, delete:

- `patchThink`
- `patchAskQuestionsTool`
- the `worker/agents/core/behaviors/think.ts` and `worker/agents/think/ask-questions-tool.ts` entries in `applyOrganizationRun`

Default Think is then the pin plus no question intercept. Keep `publishOrganizationQuestion`, `acceptOrganizationAnswer`, `redactConversation`, and the websocket gate. They are host behavior, not Think behavior.

Until that deletion, a Think run can still ask, and a Docker run must not double-publish. Only the behavior that is actually selected may call `publishOrganizationQuestion`.

### 6. Select it for a run

Leave `DEFAULT_FEATURE_DEFINITIONS.app.behaviorType` as `think`. Pass `behaviorType: 'docker'` from the create path when the Docker proof should run. Do not switch every app to Docker by editing the default until that proof has been reviewed.

### 7. Two-browser check

`e2e-vibesdk/tests/two-roles.spec.js` is the harness to keep:

- Developer Enter on the home box does not open `/chat/`.
- Project Manager Enter does, and the creator is assigned as `project-manager`.
- The spec then calls `POST /api/org/assign` as that admin to assign the Developer. The Developer opens that app from the sidebar. Without the assignment the app is hidden.
- The two roles never both see a question body.
- The listener sees `org-waiting` in the transcript and does not see the body text.
- The speaker's reply is typed into the prompt box.
- `OPENROUTER_API_KEY` is only the answerer.

The `hitl` job in `.github/workflows/preview-vibesdk.yml` stays gated on `cursor/vibesdk-org-belonging-0539`. Do not retarget it. The two-role walk is manual on the preview.

This preview does not set `CLOUDFLARE_AI_GATEWAY` (`previewConfigViolations` rejects it) and does not inject an OpenRouter key. Think keeps the pin's model configuration (`google-ai-studio/gemini-3.6-flash` through whatever `getConfigurationForModel` returns). Do not restore `patchThinkModel`.

The answerer key in the e2e job comes from the Doppler `dyad` / `preview` fetch already in that job. It is not a worker secret. Do not copy Clerk keys into the Doppler `vibesdk` / `dev` config.

## Verification already run for this branch

From the repository root:

```sh
node --test deploy/preview/vibesdk.test.mjs deploy/preview/vibesdk-org-run.test.mjs deploy/preview/clerk-origins.test.mjs
```

Those tests cover resource refusal, the absence of the removed patches, the organization role rules, and Clerk origin allowlisting. They do not deploy a worker and they do not start a browser.

## Where the question intercept sits

The intercept is not a method of `ThinkAgent`. `ThinkAgent` is the durable object that owns the model and tool loop. The host does not step inside that loop.

`patchThink` rewrites `ThinkCodingBehavior` in `worker/agents/core/behaviors/think.ts`. `CodeGeneratorAgent` selects that class when the behavior is `think`, which is the default for an app. Phasic and agentic do not get this rewrite.

One turn:

1. Enter sends `USER_SUGGESTION`, or the first build sends the prompt.
2. `ThinkCodingBehavior.build()` drains that queue and `runPrompt` calls `stub.chat()` once.
3. `ThinkAgent` runs its own loop and streams chunks back to `ThinkCodingBehavior`.
4. The patched reader sees tool output named `ask_questions`, stores one question with `publishOrganizationQuestion`, and returns before the normal tool broadcast.
5. The chat polls `GET /api/org/question` and draws one transcript line. The named role sees the body. The other role sees the waiting line.
6. The named role's next prompt-box message is the next `stub.chat()`.

When the Docker agent is ready, its own behavior calls `publishOrganizationQuestion` from the result envelope. That is when `patchThink` and `patchAskQuestionsTool` come off, so default Think matches the pin again.

## Still not in this branch

- `deploy/preview/vibesdk-docker-behavior.mjs`. Deferred until the Docker agent is ready. The section above is the spec. Do not subclass `ThinkCodingBehavior` to reach it: `getSpaceStub` and `runPrompt` are private, so the Docker behavior has to be its own class. Do not relax the container refusal to host it. One HTTPS call to `DOCKER_HARNESS_URL` is the selected placement.
- A last-admin guard.
- A permission table, a permission-admin screen, and per-project permission overrides.
- A two-browser CI job for this branch. The existing `hitl` job stays on `cursor/vibesdk-org-belonging-0539`.

## Out of scope for the implementer as well

- Altering `wewebplus.apps` or `wewebplus.questions`.
- A phase strip, Continue, or a phase-approval button.
- A second prompt, a scripted question, avatars, or `Response required`.
- Resetting `bolt-walkthrough`, or editing Electron, Gas City, Bolt, or Forma.
- Seeding users, changing production Clerk, or adding the lab host to Clerk origins.
- Implementing the harness image inside this repository.
