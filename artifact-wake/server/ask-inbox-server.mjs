#!/usr/bin/env node
// ask-inbox: a tiny local MCP server (stdio, no dependencies) that lets an artifact
// write requests to a local markdown inbox and read Claude's answers back.
//
// File: $CLAUDE_INBOX_FILE, default ~/claude-inbox/inbox.md
// Tools: add_request {text}, list_requests {limit}
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const FILE = process.env.CLAUDE_INBOX_FILE
  ? process.env.CLAUDE_INBOX_FILE.replace(/^~(?=\/|$)/, os.homedir())
  : path.join(os.homedir(), 'claude-inbox', 'inbox.md');
const HEADER = '# Claude Inbox\n\n<!-- Requests from the Ask Claude dashboard. Claude sets the status after "|" and writes the Answer. Statuses: queued, working, done, needs-you, error, cancelled. -->\n\n';
const MAX_TEXT = 20000;

function ensureFile() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, HEADER);
}
const pad = (n) => String(n).padStart(2, '0');
function stamp(d = new Date()) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}
// Keep user text from breaking the block structure.
const escapeBody = (t) => t.replace(/\r\n?/g, '\n').split('\n').map((l) => (/^\s*(#|---\s*$)/.test(l) ? '\\' + l : l)).join('\n');
const unescapeBody = (t) => t.split('\n').map((l) => l.replace(/^\\(?=\s*(#|---))/, '')).join('\n');

function addRequest(text) {
  const clean = String(text || '').trim();
  if (!clean) throw new Error('text is empty');
  if (clean.length > MAX_TEXT) throw new Error('text is longer than ' + MAX_TEXT + ' characters');
  ensureFile();
  const now = new Date();
  const id = 'REQ-' + stamp(now).replace(/[-: ]/g, '').replace(/^(\d{8})(\d{6})$/, '$1-$2') + '-' + crypto.randomBytes(2).toString('hex');
  const block = '## ' + id + ' | queued\n- Sent: ' + stamp(now) + '\n\n### Request\n' + escapeBody(clean) + '\n\n### Answer\n_waiting_\n\n---\n\n';
  fs.appendFileSync(FILE, block);
  return { id, status: 'queued', file: FILE };
}

function listRequests(limit) {
  ensureFile();
  const src = fs.readFileSync(FILE, 'utf8');
  const re = /^## (REQ-[\w-]+) \| ([\w-]+)[ \t]*$/gm;
  const heads = [];
  let m;
  while ((m = re.exec(src))) heads.push({ id: m[1], status: m[2], start: m.index, bodyStart: re.lastIndex });
  const out = heads.map((h, i) => {
    const body = src.slice(h.bodyStart, i + 1 < heads.length ? heads[i + 1].start : src.length).replace(/\n---\s*$/m, '');
    const sent = (body.match(/^- Sent: (.+)$/m) || [])[1] || '';
    const req = (body.match(/### Request\n([\s\S]*?)\n### Answer/) || [])[1] || '';
    const ans = (body.match(/### Answer\n([\s\S]*)$/) || [])[1] || '';
    const answer = unescapeBody(ans).replace(/\n-{3,}\s*$/, '').trim();
    return { id: h.id, status: h.status, sent, request: unescapeBody(req).trim(), answer: answer === '_waiting_' ? '' : answer };
  });
  const n = Math.max(1, Math.min(100, Number(limit) || 25));
  return { file: FILE, requests: out.reverse().slice(0, n) };
}

const TOOLS = [
  {
    name: 'add_request',
    description: 'Append a request for Claude to the local inbox markdown file. Returns the request id.',
    inputSchema: { type: 'object', properties: { text: { type: 'string', description: 'The request, in plain language.' } }, required: ['text'], additionalProperties: false }
  },
  {
    name: 'list_requests',
    description: 'List the newest requests in the local inbox file with their status and Claude\'s answer.',
    inputSchema: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 100, description: 'How many, newest first. Default 25.' } }, additionalProperties: false }
  }
];

function send(msg) { process.stdout.write(JSON.stringify(msg) + '\n'); }
function reply(id, result) { send({ jsonrpc: '2.0', id, result }); }
function fail(id, code, message) { send({ jsonrpc: '2.0', id, error: { code, message } }); }

function handle(msg) {
  const { id, method, params } = msg;
  const isRequest = id !== undefined && id !== null;
  try {
    switch (method) {
      case 'initialize':
        return reply(id, {
          protocolVersion: (params && params.protocolVersion) || '2025-06-18',
          capabilities: { tools: {} },
          serverInfo: { name: 'ask-inbox', version: '0.2.0' }
        });
      case 'ping': return reply(id, {});
      case 'tools/list': return reply(id, { tools: TOOLS });
      case 'tools/call': {
        const name = params && params.name, args = (params && params.arguments) || {};
        let data;
        if (name === 'add_request') data = addRequest(args.text);
        else if (name === 'list_requests') data = listRequests(args.limit);
        else return fail(id, -32602, 'Unknown tool: ' + name);
        return reply(id, { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data });
      }
      default:
        if (isRequest) return fail(id, -32601, 'Method not found: ' + method);
    }
  } catch (e) {
    if (isRequest && method === 'tools/call') return reply(id, { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true });
    if (isRequest) return fail(id, -32603, e.message);
  }
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch (e) { fail(null, -32700, 'Parse error'); continue; }
    if (Array.isArray(msg)) msg.forEach(handle); else handle(msg);
  }
});
process.stdin.on('end', () => process.exit(0));
