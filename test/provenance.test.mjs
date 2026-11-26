// Provenance classification tests.
//
// The host half is exercised through its public `apply()`: a fake context mounts
// the real `/usage/api/summary` route, and the fixture directories describe a
// profile, a installation and a project on disk. Each case gets its own temp
// root, because the classifier caches its profile map and skill-owner index per
// directory.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const { apply } = await import(pathToFileURL(join(import.meta.dirname, '..', 'index.js')).href)

/** Write a relative-path → content map under `root`. */
async function writeTree(root, files) {
  for (const [relative, content] of Object.entries(files)) {
    const file = join(root, relative)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, content, 'utf8')
  }
}

/** A temp workspace with the usual four roots. */
async function workspace(t, files) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-capability-map-'))
  t.after(async () => rm(root, { recursive: true, force: true }))
  await writeTree(root, files)
  const appDir = join(root, 'app.asar', 'dsh')
  return {
    root,
    profileDir: join(root, 'profile'),
    repoDir: join(root, 'repo'),
    homeDir: join(root, 'home'),
    scopeDir: join(appDir, 'node_modules', '@deepseek-ai'),
    installDir: join(appDir, 'node_modules', '@deepseek-ai', 'dsh'),
  }
}

/** Mount the real route and return the summary the panel would receive. */
async function summary({ profileDir, installDir, repoDir, skills, origins = {}, toolInfo, officialTools, extraOfficialTools, cold = false }) {
  const routes = []
  const ctx = {
    get: name => (name === 'profileContext'
      ? { name: 'test', dir: profileDir, installAnchor: join(installDir, 'package.json') }
      : undefined),
    effect: fn => fn(),
    webServer: { register: route => { routes.push(route); return () => {} } },
    sessions: { get: () => (cold ? undefined : { workingDirectory: repoDir, snapshotEvents: () => [] }) },
    skills: { list: async () => skills },
    tools: { definitions: () => (toolInfo === undefined ? [] : toolInfo) },
    agents: { get: () => undefined },
  }
  apply(ctx, {
    origins,
    ...(officialTools === undefined ? {} : { officialTools }),
    ...(extraOfficialTools === undefined ? {} : { extraOfficialTools }),
  })
  const response = { status: 0, body: '', writeHead (status) { this.status = status }, end (body) { this.body = body } }
  await routes[0].handler({ method: 'GET', url: '/usage/api/summary?sessionId=test' }, response)
  assert.equal(response.status, 200)
  return JSON.parse(response.body)
}

const kindsOf = payload => Object.fromEntries(payload.availableSkills.map(skill => [skill.name, skill.originKind]))

test('project skill in a repository with its own package.json stays project', async t => {
  const roots = await workspace(t, {
    'repo/package.json': JSON.stringify({ name: 'demo-app', version: '1.0.0' }),
    'repo/.dsh/skills/proj-skill/SKILL.md': '# project skill',
  })
  const payload = await summary({
    ...roots,
    skills: [{
      name: 'proj-skill',
      description: 'project skill',
      source: 'project-dsh',
      path: join(roots.repoDir, '.dsh', 'skills', 'proj-skill', 'SKILL.md'),
    }],
  })
  assert.equal(kindsOf(payload)['proj-skill'], 'project')
})

test('user skill under a home with package.json stays user', async t => {
  const roots = await workspace(t, {
    'home/package.json': JSON.stringify({ name: 'home-pkg' }),
    'home/skills/user-skill/SKILL.md': '# user skill',
  })
  const payload = await summary({
    ...roots,
    skills: [{
      name: 'user-skill',
      description: 'user skill',
      source: 'user-dsh',
      path: join(roots.homeDir, 'skills', 'user-skill', 'SKILL.md'),
    }],
  })
  assert.equal(kindsOf(payload)['user-skill'], 'user')
})

test('package skills classify by profile specifier', async t => {
  const roots = await workspace(t, {
    'profile/package.json': JSON.stringify({
      name: 'dsh-profile-test',
      dependencies: {
        regpkg: '^1.0.0',
        gitpkg: 'github:owner/repo',
        sshpkg: 'ssh://git@example.com/owner/repo.git',
        localpkg: 'link:../localpkg',
      },
    }),
    'profile/node_modules/regpkg/package.json': JSON.stringify({ name: 'regpkg' }),
    'profile/node_modules/regpkg/skills/reg-skill/SKILL.md': '# reg',
    'profile/node_modules/gitpkg/package.json': JSON.stringify({ name: 'gitpkg' }),
    'profile/node_modules/gitpkg/skills/git-skill/SKILL.md': '# git',
    'profile/node_modules/gitpkg/skills/bundled-skill/SKILL.md': '# bundled from git package',
    'profile/node_modules/sshpkg/package.json': JSON.stringify({ name: 'sshpkg' }),
    'profile/node_modules/sshpkg/skills/ssh-skill/SKILL.md': '# ssh',
    'profile/node_modules/localpkg/package.json': JSON.stringify({ name: 'localpkg' }),
    'profile/node_modules/localpkg/skills/local-skill/SKILL.md': '# local',
  })
  const skill = (name, pkg, extra = {}) => ({
    name,
    description: name,
    source: 'custom',
    path: join(roots.profileDir, 'node_modules', pkg, 'skills', name, 'SKILL.md'),
    ...extra,
  })
  const payload = await summary({
    ...roots,
    skills: [
      skill('reg-skill', 'regpkg'),
      skill('git-skill', 'gitpkg'),
      skill('ssh-skill', 'sshpkg'),
      skill('local-skill', 'localpkg'),
      skill('bundled-skill', 'gitpkg', { source: 'bundled' }),
    ],
    origins: { reg_tool: 'regpkg', git_tool: 'gitpkg', ssh_tool: 'sshpkg', local_tool: 'localpkg', 'wild_*': 'gitpkg' },
  })
  const kinds = kindsOf(payload)
  assert.equal(kinds['reg-skill'], 'market')
  assert.equal(kinds['git-skill'], 'git')
  assert.equal(kinds['ssh-skill'], 'git')
  assert.equal(kinds['local-skill'], 'local')
  // A bundled skill whose file still resolves to its owning package keeps that
  // package's kind instead of falling back to the registry name.
  assert.equal(kinds['bundled-skill'], 'git')
  assert.equal(payload.origins.git_tool.kind, 'git')
  assert.equal(payload.origins.ssh_tool.kind, 'git')
  assert.equal(payload.origins.local_tool.kind, 'local')
  assert.equal(payload.origins.reg_tool.kind, 'market')
  assert.equal(payload.origins['wild_*'].kind, 'git')
})

test('bundled skill without a path resolves through the installation skill index', async t => {
  const roots = await workspace(t, {
    'profile/package.json': JSON.stringify({ name: 'dsh-profile-test' }),
    'app.asar/dsh/node_modules/@deepseek-ai/dsh/package.json': JSON.stringify({ name: '@deepseek-ai/dsh' }),
    'app.asar/dsh/node_modules/@deepseek-ai/office-pack/assets/off-skill/SKILL.md': '# official',
  })
  const payload = await summary({
    ...roots,
    skills: [{ name: 'off-skill', description: 'official', source: 'bundled' }],
  })
  assert.equal(kindsOf(payload)['off-skill'], 'official')
})

test('custom skill inside the installation tree is official', async t => {
  const roots = await workspace(t, {
    'profile/package.json': JSON.stringify({ name: 'dsh-profile-test' }),
    'app.asar/dsh/node_modules/@deepseek-ai/dsh/package.json': JSON.stringify({ name: '@deepseek-ai/dsh' }),
    'app.asar/dsh/node_modules/@deepseek-ai/loose/x-skill/SKILL.md': '# loose official asset',
  })
  const payload = await summary({
    ...roots,
    skills: [{
      name: 'x-skill',
      description: 'loose asset',
      source: 'custom',
      path: join(roots.scopeDir, 'loose', 'x-skill', 'SKILL.md'),
    }],
  })
  assert.equal(kindsOf(payload)['x-skill'], 'official')
})

test('bundled skill nothing can locate stays other', async t => {
  const roots = await workspace(t, {
    'profile/package.json': JSON.stringify({ name: 'dsh-profile-test' }),
  })
  const payload = await summary({
    ...roots,
    skills: [{ name: 'mystery-skill', description: 'unknown', source: 'bundled' }],
  })
  assert.equal(kindsOf(payload)['mystery-skill'], 'other')
})

test('official tool names include the installation scan and stay without origins', async t => {
  const roots = await workspace(t, {
    'profile/package.json': JSON.stringify({ name: 'dsh-profile-test' }),
    'app.asar/dsh/node_modules/@deepseek-ai/dsh/package.json': JSON.stringify({ name: '@deepseek-ai/dsh' }),
    'app.asar/dsh/node_modules/@deepseek-ai/dsh-tool-fixture/lib/index.js': "const definition = { name: 'fixture_tool' }",
  })
  const payload = await summary({ ...roots, skills: [] })
  assert.ok(payload.officialTools.includes('fixture_tool'))
  assert.ok(payload.officialTools.includes('read'))
  assert.deepEqual(payload.origins, {})
})

test('shipped tool catalog covers bundle tools whose package is installed', async t => {
  const roots = await workspace(t, {
    'profile/package.json': JSON.stringify({ name: 'dsh-profile-test' }),
    'app.asar/dsh/node_modules/@deepseek-ai/dsh/package.json': JSON.stringify({ name: '@deepseek-ai/dsh' }),
    'app.asar/dsh/node_modules/@deepseek-ai/dsh/docs/tool-catalog.md': [
      '| Tool package | Model-visible names | Requires |',
      '| --- | --- | --- |',
      '| `@deepseek-ai/dsh-plan-mode` | `exit_plan_mode` | `ctx.tools` |',
      '| `@deepseek-ai/dsh-tool-lsp` | `lsp` | `ctx.tools` |',
    ].join('\n'),
    'app.asar/dsh/node_modules/@deepseek-ai/dsh-plan-mode/package.json': JSON.stringify({ name: '@deepseek-ai/dsh-plan-mode' }),
  })
  const payload = await summary({ ...roots, skills: [] })
  assert.ok(payload.officialTools.includes('exit_plan_mode'))
  // The catalog lists `lsp`, but its package is not part of this installation,
  // so the name must not claim 内置.
  assert.ok(!payload.officialTools.includes('lsp'))
})

test('undeclared package inside the installation tree falls through to official', async t => {
  // Regression guard for the headline fix: a manifest the profile does not
  // declare must not short-circuit the installation-tree check.
  const roots = await workspace(t, {
    'profile/package.json': JSON.stringify({ name: 'dsh-profile-test' }),
    'app.asar/dsh/node_modules/@deepseek-ai/dsh/package.json': JSON.stringify({ name: '@deepseek-ai/dsh' }),
    'app.asar/dsh/node_modules/@deepseek-ai/loose-pkg/package.json': JSON.stringify({ name: 'loose-pkg' }),
    'app.asar/dsh/node_modules/@deepseek-ai/loose-pkg/skills/loose-skill/SKILL.md': '---\nname: loose-skill\ndescription: loose\n---',
  })
  const payload = await summary({
    ...roots,
    skills: [{
      name: 'loose-skill',
      description: 'loose',
      source: 'custom',
      path: join(roots.scopeDir, 'loose-pkg', 'skills', 'loose-skill', 'SKILL.md'),
    }],
  })
  assert.equal(kindsOf(payload)['loose-skill'], 'official')
})

test('undeclared package inside profile node_modules is other, not local', async t => {
  const roots = await workspace(t, {
    'profile/package.json': JSON.stringify({ name: 'dsh-profile-test', dependencies: { declared: '^1.0.0' } }),
    'profile/node_modules/declared/package.json': JSON.stringify({ name: 'declared' }),
    'profile/node_modules/transitive/package.json': JSON.stringify({ name: 'transitive' }),
    'profile/node_modules/transitive/skills/transitive-skill/SKILL.md': '---\nname: transitive-skill\ndescription: t\n---',
  })
  const payload = await summary({
    ...roots,
    skills: [{
      name: 'transitive-skill',
      description: 't',
      source: 'custom',
      path: join(roots.profileDir, 'node_modules', 'transitive', 'skills', 'transitive-skill', 'SKILL.md'),
    }],
  })
  assert.equal(kindsOf(payload)['transitive-skill'], 'other')
})

test('project-agents and user-agents roots keep their scope', async t => {
  const roots = await workspace(t, {
    'profile/package.json': JSON.stringify({ name: 'dsh-profile-test' }),
    'repo/.agents/skills/pa-skill/SKILL.md': '---\nname: pa-skill\ndescription: p\n---',
    'home/.agents/skills/ua-skill/SKILL.md': '---\nname: ua-skill\ndescription: u\n---',
  })
  const payload = await summary({
    ...roots,
    skills: [
      { name: 'pa-skill', description: 'p', source: 'project-agents', path: join(roots.repoDir, '.agents', 'skills', 'pa-skill', 'SKILL.md') },
      { name: 'ua-skill', description: 'u', source: 'user-agents', path: join(roots.homeDir, '.agents', 'skills', 'ua-skill', 'SKILL.md') },
    ],
  })
  const kinds = kindsOf(payload)
  assert.equal(kinds['pa-skill'], 'project')
  assert.equal(kinds['ua-skill'], 'user')
})

test('bundled skill without a path resolves by frontmatter or flat file name', async t => {
  const roots = await workspace(t, {
    'profile/package.json': JSON.stringify({ name: 'dsh-profile-test', dependencies: { regpkg: '^1.0.0' } }),
    'profile/node_modules/regpkg/package.json': JSON.stringify({ name: 'regpkg' }),
    // Directory name differs from the registered frontmatter name.
    'profile/node_modules/regpkg/assets/dir-name/SKILL.md': '---\nname: real-name\ndescription: f\n---',
    // Flat markdown skills are part of the filesystem provider's grammar too.
    'profile/node_modules/regpkg/skills/flat-skill.md': '---\nname: flat-skill\ndescription: f\n---',
  })
  const payload = await summary({
    ...roots,
    skills: [
      { name: 'real-name', description: 'f', source: 'bundled' },
      { name: 'flat-skill', description: 'f', source: 'bundled' },
    ],
  })
  const kinds = kindsOf(payload)
  assert.equal(kinds['real-name'], 'market')
  assert.equal(kinds['flat-skill'], 'market')
})

test('officialTools config replaces and extends the discovered set', async t => {
  const roots = await workspace(t, {
    'profile/package.json': JSON.stringify({ name: 'dsh-profile-test' }),
    'app.asar/dsh/node_modules/@deepseek-ai/dsh/package.json': JSON.stringify({ name: '@deepseek-ai/dsh' }),
  })
  const replaced = await summary({ ...roots, skills: [], officialTools: ['only_tool'] })
  assert.deepEqual(replaced.officialTools, ['only_tool'])
  const extended = await summary({ ...roots, skills: [], extraOfficialTools: ['brand_new_tool'] })
  assert.ok(extended.officialTools.includes('read'))
  assert.ok(extended.officialTools.includes('brand_new_tool'))
})

test('cold session answers without resolving provenance', async t => {
  const roots = await workspace(t, {
    'profile/package.json': JSON.stringify({ name: 'dsh-profile-test' }),
    'app.asar/dsh/node_modules/@deepseek-ai/dsh/package.json': JSON.stringify({ name: '@deepseek-ai/dsh' }),
  })
  const payload = await summary({ ...roots, skills: [], cold: true })
  assert.deepEqual(payload, { ok: true, available: false, skills: [], tools: [], mcp: [], availableSkills: [] })
})
