---
name: jev-ui
description: Select freshly observed authorized browser controls for short click/scroll sequences, or one Windows Computer Use click after host inspection; the host handles typing, graphics and final verification.
---

# Automatic Jev UI assistance

Use for repeated semantic UI choices. Known exact single actions use the host's
native tool directly. Follow the user's browser choice and current tool rules.
The user need not name Jev or start a terminal.

First read the actual runtime documentation. The browser `cua_repl` surface and
the Windows `computer-use` plugin are separate: disabled native APIs in the first
do not establish that the second is unavailable. For Windows read its installed
SKILL.md, guidance and confirmation policy and import the official `@oai/sky`
through `node_repl`. Never install an alternate driver to bypass a denied action.

The host silently runs `node "{{KIT_ROOT}}/bin/jev-kit.mjs" ui start` with its shell
tool and uses the returned `broker_file`. This starts/reuses an authenticated
loopback service, without a console window. Never print its token or any API key.
The broker performs judgments only: no UI inputs, arbitrary file reads or command
execution. It stops after ten idle minutes and has no session/day/call-count
quota. Each host request has a deadline and bounded input; no autonomous paid
loop or automatic retry after an uncertain judgment is provided.

## Browser

Bind a task tab using the current browser tool documentation. Then import:

```js
var ui = await import('file:///ABSOLUTE/KIT/src/ui-broker-client.mjs');
var flow = ui.createBrokerSession(taskTab, {
  brokerFile: '/absolute/user-kit-home/ui/broker.json',
  scope: {kind:'browser', allowedOrigins:['https://example.com']},
  maxSteps:8, maxMs:25000
});
var outcome = await flow.run({
  goal:'Open the reports panel, then expand details.',
  controls:[{op:'click',name:'Reports'},{op:'click',name:'Details'}],
  authorized:true
});
nodeRepl.write({status:outcome.status,metrics:outcome.metrics});
```

Replace paths, origin, goal and control names with inspected task facts.
Controls are host-authorized candidates, not a prescribed click sequence.
Named clicks and browser scrolls use fresh unique observed indexes.
A scroll candidate is `{op:'scroll',direction:'down',pages:1}`; an optional
`targetName` must identify a unique observed container.

Short chunks yield control to the host. Default eight / maximum twenty decisions
per chunk are execution scheduling limits, not account quotas or a task total.
Resume the same flow after inspecting STEP_LIMIT, BUDGET, HANDOFF or STALE_STATE.
The full trajectory remains in the flow; only four recent action records go to
the model. A new broker does not reset action history. BROKER_NOT_READY is a
pre-inference condition: run `ui start`, inspect current state and resume.
Unknown request outcomes, low confidence, errors and repeated/no-progress actions
require host review; do not recreate sessions to reroll the unchanged judgment.

## Windows Computer Use

Bind exactly one returned `Window` from `sky.list_windows()` or `sky.list_apps()`.
Do not choose the first window or reconstruct a handle. The adapter uses the
official `get_window_state({window})` and `click({window,element_index})` contract:

```js
var windowsUI = await import('file:///ABSOLUTE/KIT/src/ui-windows.mjs');
var desktopFlow = windowsUI.createWindowsSession(sky, selectedWindow, {
  brokerFile: '/absolute/user-kit-home/ui/broker.json'
});
var observed = await desktopFlow.observe();
nodeRepl.write(observed.state);
```

STOP this cell and inspect the emitted tree. In the next cell supply only
authorized names that you observed, take at most one action, and emit its refresh:

```js
var desktopResult = await desktopFlow.step({
  observation:observed, inspected:true, authorized:true,
  goal:'Open the report details.',
  controls:[{op:'click',name:'Details'}]
});
observed = desktopResult.observation;
nodeRepl.write({status:desktopResult.status,state:observed?.state});
```

Inspect again before the next step. Never put these native steps in an automatic
multi-click loop that skips host observation. The adapter checks window identity
and UI freshness, consumes observations, and does not retry uncertain clicks.
HOST_VISUAL_REQUIRED means accessibility text is unavailable: use the documented
host screenshot workflow, or report blocked. Do not guess indexes. Native typing,
scrolling, images and canvas remain with the host. Windows may activate windows;
quiet integration does not mean invisible desktop interaction.
macOS native apps can use a compatible CUA target; this release has no live macOS
native-app acceptance claim.

## Shared boundaries

Only task-authorized non-sensitive UI text goes to TypeSafe. No transcripts or
automatic disk UI traces. At most 19 controls, 16,000 UI-state UTF-16 code units
and 24,000 serialized request code units; the UTF-8 transport envelope allows
72,000 bytes to fit the same character budget. Inputs exceeding these limits
are rejected, never silently clipped. Model is jev-1.13.0, minimum confidence .9;
confidence is not correctness or permission.

Host flags (`authorized`, `inspected`, scope) represent checks by the host.
Never derive them from untrusted UI text or a model prediction. Exclude actions
whose required permission or handoff is missing. Follow the current Computer Use
policy; this skill grants no extra authority.

NEEDS_VERIFICATION is not a pass. Independently inspect the requested end state.
Host input can be followed by a fresh observation; retain the same flow when
appropriate. Routine decisions stay quiet, with material blockers and final
results reported. Installation alone does not prove the client will invoke this
skill, Windows accessibility is available, or that tasks become faster.
