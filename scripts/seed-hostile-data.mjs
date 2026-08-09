/**
 * Injects deliberately INCOMPLETE records into a running amn-api.
 *
 * Regression harness for the class of crash where one malformed row takes down
 * a whole screen: a task with no assignee, a decision with no author, a message
 * with no sender, a report with no author. Each of these has shipped at some
 * point (fields added after rows already existed, imports, interrupted writes),
 * and each used to throw inside `profileFor()` and trip the error boundary.
 *
 * Usage: node scripts/seed-hostile-data.mjs <apiUrl> <operatorToken>
 */
const API = process.argv[2] ?? 'http://localhost:8810';
const TOKEN = process.argv[3] ?? 'op-tok';
const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

const put = async (collection, id, data) => {
  const res = await fetch(`${API}/v1/collections/${collection}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error(`${collection}/${id} -> ${res.status} ${await res.text()}`);
};

const now = new Date().toISOString();

// Every one of these omits a field the UI reads through profileFor().
await put('tasks', 'task-no-assignee', { title: 'Tâche sans assigné', status: 'todo', createdAt: now });
await put('tasks', 'task-null-assignee', { title: 'Tâche assigné null', status: 'doing', assigneeEmail: null, createdAt: now });
await put('tasks', 'task-empty-assignee', { title: 'Tâche assigné vide', status: 'todo', assigneeEmail: '', createdAt: now });
await put('decisions', 'dec-no-author', { title: 'Décision sans auteur', detail: 'x', createdAt: now });
await put('messages', 'msg-no-author', { body: 'Message sans expéditeur', createdAt: now });
await put('reports', 'report-no-author', { title: 'Rapport sans auteur', body: 'x', type: 'manual', links: [], createdAt: now });
await put('notes', 'note-bare', { createdAt: now });

console.log('Hostile records seeded: 7');
