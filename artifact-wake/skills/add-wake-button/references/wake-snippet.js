// artifact-wake: queue a request in the Freedcamp "Claude Inbox", optionally fire the
// instant n8n route, then poll until Claude posts a [claude-result] comment.
// Requires the page's mcp capability with the Freedcamp server (and n8n if used).

const INBOX_PROJECT = 'Claude Inbox';
const N8N_WORKFLOW_ID = '';          // '' = rely on the loop only
const POLL_MS = 8000, POLL_LIMIT_MS = 10 * 60 * 1000;

let _mcp = null, _inboxId = null;
async function wakeMcp() {
  if (!_mcp) _mcp = (typeof claude !== 'undefined' && claude && claude.use) ? await claude.use('mcp') : null;
  if (!_mcp) throw { code: 'mcp_unavailable', message: 'Connectors are not available on this page.' };
  return _mcp;
}
async function fc(tool, input) {
  const r = await (await wakeMcp()).callTool('Freedcamp', tool, input, { cache: false });
  let p = r && r.payload;
  if (typeof p === 'string') { try { p = JSON.parse(p); } catch (e) { /* keep string */ } }
  return p;
}
function pickList(p, key) {
  if (Array.isArray(p)) return p;
  if (p && Array.isArray(p[key])) return p[key];
  if (p && p.data && Array.isArray(p.data[key])) return p.data[key];
  return [];
}
async function inboxProjectId() {
  if (_inboxId) return _inboxId;
  const projects = pickList(await fc('fc_fetch_projects', {}), 'projects');
  const hit = projects.find((p) => String(p.project_name || p.name || '').trim().toLowerCase() === INBOX_PROJECT.toLowerCase());
  if (!hit) throw { code: 'no_inbox', message: 'Create a Freedcamp project named "' + INBOX_PROJECT + '" first.' };
  return (_inboxId = String(hit.project_id || hit.id));
}
function stripHtml(s) {
  const d = document.createElement('div'); d.innerHTML = String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n'); return d.textContent || '';
}
function parseResult(comments) {
  const list = (comments || []).map((c) => stripHtml(c.description || c.text || c.body || ''))
    .filter((t) => t.trim().startsWith('[claude-result]'));
  if (!list.length) return null;
  const text = list[list.length - 1];
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})\s*$/);
  try { return m ? JSON.parse(m[1]) : { status: 'ok', summary: text.replace('[claude-result]', '').trim(), data: {} }; }
  catch (e) { return { status: 'ok', summary: text.replace('[claude-result]', '').trim(), data: {} }; }
}

// action: short slug, e.g. 'plan_my_day'. requestText: plain-language ask. payload: object or null.
// onUpdate(state, info): states queued | running | done | needs_confirmation | error | timeout
async function wakeClaude(action, requestText, payload, onUpdate) {
  const say = onUpdate || (() => {});
  const projectId = await inboxProjectId();
  const description = requestText + (payload ? '\n\n```json\n' + JSON.stringify(payload) + '\n```' : '');
  const created = await fc('fc_add_task', { project_id: projectId, title: '[claude] ' + action, description, status: 0 });
  const task = pickList(created, 'tasks')[0] || created || {};
  const taskId = String(task.id || task.task_id || '');
  if (!taskId) throw { code: 'no_task_id', message: 'The inbox task was created but its id was not returned.' };
  say('queued', { taskId });

  if (N8N_WORKFLOW_ID) {
    try {
      await (await wakeMcp()).callTool('n8n', 'execute_workflow', {
        workflowId: N8N_WORKFLOW_ID,
        inputs: { type: 'webhook', webhookData: { method: 'POST', body: { task_id: taskId } } }
      }, { cache: false });
    } catch (e) { /* instant route failed; the loop still picks it up */ }
  }

  const started = Date.now();
  while (Date.now() - started < POLL_LIMIT_MS) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    const p = await fc('fc_fetch_task', { task_id: taskId });
    const t = pickList(p, 'tasks')[0] || p || {};
    const status = Number(t.status);
    if (status === 2) say('running', { taskId });
    if (status === 1 || status === 4 || status === 3) {
      const result = parseResult(t.comments || (t.comments_data) || []);
      const state = !result ? 'error' : result.status === 'ok' ? 'done' : result.status === 'needs_confirmation' ? 'needs_confirmation' : 'error';
      say(state, { taskId, result });
      return { taskId, state, result };
    }
  }
  say('timeout', { taskId });
  return { taskId, state: 'timeout', result: null };
}

// Example wiring:
// btn.onclick = () => wakeClaude('plan_my_day', 'Plan my day from these tasks.', { date: today(), tasks },
//   (state, info) => { statusEl.textContent = state; if (info.result) render(info.result); });
