#!/usr/bin/env node
// Usage: node unify_session.js [input.json] [output.json]
// Merges groups + projects + users from an fc_fetch_current_session dump into
// { groups: [{ group, group_id, projects: [] }], users: [] }

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { id_to_name } from './constants.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const input = process.argv[2] || path.join(dir, 'fc_fetch_current_session.json');
const output = process.argv[3] || path.join(dir, 'fc_session_unified.json');

const toApp = (id) => id_to_name[id] || { name: `Unknown (${id})`, id: Number(id), key: null };

// group_* fields are redundant once a project is nested under its group;
// applications become [{ name, id, key }] using the pretty names from constants.js
const stripGroupFields = ({ group_id, group_name, group_unique_name, applications = [], ...project }) => ({
  ...project,
  applications: applications.map(toApp),
});

function unify(session) {
  const { projects = [], groups = [], users = [] } = session.data || {};

  const byGroupId = projects.reduce((acc, p) => {
    const list = acc.get(p.group_id) || [];
    return acc.set(p.group_id, [...list, stripGroupFields(p)]);
  }, new Map());

  const unified = groups.map((g) => ({
    group: g.name,
    group_id: g.group_id,
    projects: byGroupId.get(g.group_id) || [],
  }));

  // Projects whose group is missing from data.groups
  const knownIds = new Set(groups.map((g) => g.group_id));
  const orphans = projects
    .filter((p) => !knownIds.has(p.group_id))
    .reduce((acc, p) => {
      const list = acc.get(p.group_id) || { group: p.group_name, group_id: p.group_id, projects: [] };
      return acc.set(p.group_id, { ...list, projects: [...list.projects, stripGroupFields(p)] });
    }, new Map());

  return { groups: [...unified, ...orphans.values()], users };
}

let session;
try {
  session = JSON.parse(fs.readFileSync(input, 'utf8'));
} catch (err) {
  console.error(`Cannot read/parse ${input}: ${err.message}`);
  process.exit(1);
}

if (!session.data) {
  console.error(`${input} has no "data" key`);
  process.exit(1);
}

const result = unify(session);
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');

const projectCount = result.groups.reduce((n, g) => n + g.projects.length, 0);
console.log(`Wrote ${output}: ${result.groups.length} groups, ${projectCount} projects, ${result.users.length} users`);
