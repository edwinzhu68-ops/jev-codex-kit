import { open, readdir, lstat, realpath, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseDocument } from 'yaml';
import { skillCandidateSchema, hashText, assertNoSecret } from './skill-router.mjs';

async function readSkill(file) {
  if ((await lstat(file)).isSymbolicLink()) throw Error('LINKED_SKILL_NOT_ALLOWED');
  const handle = await open(file, 'r');
  try {
    const st = await handle.stat();
    if (!st.isFile() || st.size > 128 * 1024) throw Error('SKILL_FILE_SIZE_OR_TYPE');
    const buffer = Buffer.alloc(128 * 1024 + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > 128 * 1024) throw Error('SKILL_FILE_SIZE_OR_TYPE');
    const bytes = buffer.subarray(0, bytesRead);
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (text.includes('\0')) throw Error('BINARY_SKILL');
    return { text, sha256: hashText(bytes) };
  } finally { await handle.close(); }
}

export async function collectSkillCatalog(directory) {
  const root = await realpath(directory);
  if (root === path.parse(root).root) throw Error('CHOOSE_SKILLS_DIRECTORY');
  const entries = await readdir(root, { withFileTypes: true });
  if (entries.length > 256) throw Error('CATALOG_ENTRY_LIMIT');
  const candidates = [], sources = [], excluded = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) { excluded.push({ entry: entry.name, reason: 'not_direct_directory_or_link' }); continue; }
    const file = path.join(root, entry.name, 'SKILL.md');
    try {
      const resolved = await realpath(file);
      if (path.relative(root, resolved) !== path.join(entry.name, 'SKILL.md')) throw Error('LINKED_SKILL_NOT_ALLOWED');
      const source = await readSkill(file);
      const match = source.text.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
      if (!match) throw Error('MISSING_FRONTMATTER');
      const document = parseDocument(match[1], { uniqueKeys: true });
      if (document.errors.length) throw Error('INVALID_FRONTMATTER');
      const metadata = document.toJS({ maxAliasCount: 0 });
      if (!metadata || typeof metadata.name !== 'string' || typeof metadata.description !== 'string') throw Error('INVALID_SKILL_METADATA');
      const candidate = skillCandidateSchema.parse({ id: 's_' + hashText(entry.name).slice(0, 16), name: metadata.name, description: metadata.description, enabled: metadata['disable-model-invocation'] !== true });
      assertNoSecret(JSON.stringify(candidate));
      candidates.push(candidate);
      sources.push({ id: candidate.id, relative_path: entry.name + '/SKILL.md', sha256: source.sha256 });
    } catch (error) {
      // Do not silently omit unreadable/invalid skills from a supposedly complete catalog.
      if (error.code === 'ENOENT') { excluded.push({ entry: entry.name, reason: 'no_SKILL.md' }); continue; }
      throw Error('CATALOG_SKILL_INVALID: ' + entry.name);
    }
  }
  return { version: 1, root, candidates, sources, excluded, scope: 'direct_children_only_not_client_registry', network_requests: 0 };
}

export async function catalogInput(file, goal, ids) {
  const st = await lstat(file);
  if (!st.isFile() || st.size > 1024 * 1024) throw Error('CATALOG_FILE_LIMIT');
  const catalog = JSON.parse(await readFile(file, 'utf8'));
  if (catalog.version !== 1 || !path.isAbsolute(catalog.root) || !Array.isArray(catalog.candidates) || !Array.isArray(catalog.sources)) throw Error('INVALID_CATALOG');
  const all = catalog.candidates.map(c => skillCandidateSchema.parse(c));
  if (all.length > 256 || new Set(all.map(c => c.id)).size !== all.length || new Set(catalog.sources.map(s => s.id)).size !== catalog.sources.length) throw Error('INVALID_CATALOG');
  if (ids && (new Set(ids).size !== ids.length || ids.some(id => !all.some(c => c.id === id)))) throw Error('UNKNOWN_OR_DUPLICATE_SKILL_ID');
  const candidates = ids ? all.filter(c => ids.includes(c.id)) : all;
  if (candidates.length > 19) throw Error('Select at most 19 candidates with --ids; no automatic truncation.');
  const current = await collectSkillCatalog(catalog.root);
  for (const candidate of candidates) {
    const originalSource = catalog.sources.find(s => s.id === candidate.id);
    const freshSource = current.sources.find(s => s.id === candidate.id);
    const fresh = current.candidates.find(c => c.id === candidate.id);
    if (!originalSource || !freshSource || originalSource.sha256 !== freshSource.sha256 || JSON.stringify(candidate) !== JSON.stringify(fresh)) throw Error('STALE_SKILL_CATALOG');
  }
  return { input: { goal, candidates }, catalog_coverage: { discovered: all.length, supplied: candidates.length, scope: catalog.scope, excluded: catalog.excluded.length } };
}
