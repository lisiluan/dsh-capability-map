/**
 * @local/dsh-capability-map —Host half.
 *
 * Serves GET /usage/api/summary?sessionId=<id> on the harness web server:
 * folds the live session's event log into a capability-usage summary
 * (skill tool calls with their skill name, plus all other tool calls
 * aggregated by name) and lists the locally available skills from the
 * harness skill registry (ctx.skills) so the browser tab can also preview
 * capabilities this session has not called.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, join, sep } from 'node:path'

const ROUTE = '/usage/api/summary'

/** Skill tool calls carry the skill name in their JSON arguments. */
function skillNameOf(argsText) {
  try {
    const parsed = JSON.parse(argsText)
    return typeof parsed?.name === 'string' && parsed.name !== '' ? parsed.name : undefined
  } catch {
    return undefined
  }
}

/** Fold the frozen event snapshot into { skills, tools, mcp }. */
function summarize(events) {
  // Pass 1: collect every callId that has a result, plus every ended
  // (turn, step). A single forward scan cannot do this —a call event always
  // precedes its result, so "settled" would be false for every
  // already-finished call and every card would show 运行中 forever. Result
  // events carry the id in data.message.toolCallId (data.callId does not
  // exist on them). A call whose step has ended without a result was
  // interrupted —it counts as used but is no longer running.
  const settled = new Set()
  const endedSteps = new Set()
  for (const event of events) {
    if (event?.type === 'tool/result') {
      const callId = event.data?.callId
        ?? event.data?.message?.toolCallId
        ?? event.data?.message?.source?.callId
      if (typeof callId === 'string' && callId !== '') settled.add(callId)
    } else if (event?.type === 'step/end') {
      const { turn, step } = event.data ?? {}
      if (Number.isFinite(turn) && Number.isFinite(step)) endedSteps.add(`${turn}:${step}`)
    }
  }
  // Pass 2: fold the calls.
  const skills = new Map()
  const tools = new Map()
  const mcp = new Map()
  for (const event of events) {
    if (event === undefined || event === null) continue
    const { type, data, seq, time } = event
    if (type !== 'tool/call') continue
    const callId = typeof data?.callId === 'string' && data.callId !== ''
      ? data.callId
      : `anon-${seq}`
    const wireName = typeof data?.name === 'string' && data.name !== '' ? data.name : 'tool'
    const isSettled = settled.has(callId)
    // In flight only when its result is missing AND the step that issued the
    // call is still open; a step that ended without the result means the call
    // was interrupted, so it counts as used but not as running.
    const stepOpen = !endedSteps.has(`${data?.turn}:${data?.step}`)
    const isRunning = !isSettled && stepOpen
    if (wireName === 'skill') {
      const name = skillNameOf(typeof data?.arguments === 'string' ? data.arguments : '') ?? '(unknown)'
      const entry = skills.get(name)
      if (entry === undefined) {
        skills.set(name, { kind: 'skill', name, count: 1, lastTime: time, lastSettled: isSettled, running: isRunning ? 1 : 0 })
      } else {
        entry.count += 1
        entry.lastTime = time
        entry.lastSettled = isSettled
        if (isRunning) entry.running += 1
      }
      continue
    }
    // MCP tools carry the stable wire name mcp__<serverName>__<rawName>.
    // Server names may contain underscores (e.g. `file_sync`, they match
    // [A-Za-z0-9_-]{1,32}), so the split must be greedy: server takes every
    // `__`-separated segment but the last. A raw tool name containing `__`
    // would mis-split, but that shape is rare in practice.
    const mcpMatch = /^mcp__(.+)__(.+)$/.exec(wireName)
    if (mcpMatch !== null) {
      const key = wireName
      const entry = mcp.get(key)
      if (entry === undefined) {
        mcp.set(key, { kind: 'mcp', name: mcpMatch[2], server: mcpMatch[1], count: 1, lastTime: time, lastSettled: isSettled, running: isRunning ? 1 : 0 })
      } else {
        entry.count += 1
        entry.lastTime = time
        entry.lastSettled = isSettled
        if (isRunning) entry.running += 1
      }
      continue
    }
    const entry = tools.get(wireName)
    if (entry === undefined) {
      tools.set(wireName, { kind: 'tool', name: wireName, count: 1, lastTime: time, lastSettled: isSettled, running: isRunning ? 1 : 0 })
    } else {
      entry.count += 1
      entry.lastTime = time
      entry.lastSettled = isSettled
      if (isRunning) entry.running += 1
    }
  }
  return {
    skills: [...skills.values()],
    tools: [...tools.values()],
    mcp: [...mcp.values()],
  }
}

/** Package prefixes that identify a DSH-official source. */
const DEFAULT_OFFICIAL_PACKAGES = ['@deepseek-ai/']

/**
 * Model-facing tool names shipped by the installation's own packages. It is the
 * fallback for names neither the `dsh-tool-*` source scan nor the shipped tool
 * catalog can resolve (plus aliases such as `subagent_fork`); after a DSH
 * upgrade, extend it with `config.extraOfficialTools` or replace it with
 * `config.officialTools`.
 */
export const OFFICIAL_TOOL_NAMES = Object.freeze([
  'apply_patch', 'ask_user_question', 'bash',
  'cordis_inspect_list', 'cordis_inspect_query',
  'create_goal', 'edit', 'get_goal', 'glob', 'grep',
  'interrupt_agent', 'job_kill', 'job_list', 'job_output',
  'list_agents', 'list_mcp_resource_templates', 'list_mcp_resources',
  'list_subagent_models', 'load_workspace_dependencies',
  'office_convert', 'office_recalculate', 'office_render',
  'plugin_manager', 'present', 'pwsh', 'ralph',
  'read', 'read_image', 'read_mcp_resource', 'run_code',
  'schedule_create', 'schedule_edit', 'schedule_list', 'schedule_view',
  'send_message', 'session_event_read', 'session_event_search',
  'session_event_trace', 'session_search', 'session_trace', 'skill',
  'str_replace_editor', 'subagent', 'subagent_fork',
  'team_task_create', 'team_task_get', 'team_task_list', 'team_task_update',
  'terminal_close', 'terminal_list', 'terminal_open', 'terminal_read',
  'terminal_send', 'terminal_signal',
  'todo_write', 'wait_agent', 'web_fetch', 'web_search',
  'working_directory', 'workflow', 'write',
])

/**
 * Tool names read out of one installed package's source. Only `@deepseek-ai/
 * dsh-tool-*` packages are scanned, so every name found is official by
 * construction; the regex is deliberately narrow (a literal `name: '…'`).
 */
function packageToolNames(packageDir) {
  const names = []
  for (const file of ['lib/index.js', 'src/index.ts']) {
    let source
    try {
      source = readFileSync(join(packageDir, file), 'utf8')
    } catch { continue /* that build layout does not ship the file */ }
    for (const match of source.matchAll(/name:\s*['"]([a-z0-9_-]+)['"]/g)) names.push(match[1])
  }
  return names
}

/**
 * Immediate subdirectory names of `directory`. The installation lives inside an
 * `app.asar` archive, where `readdir` may hand back entries whose `isDirectory()`
 * cannot tell a folder from a file, so anything the Dirent rejects is re-checked
 * with `stat` and a plain listing is the last resort.
 */
function directoryNames(directory) {
  try {
    const entries = readdirSync(directory, { withFileTypes: true })
    const names = []
    for (const entry of entries) {
      let isDirectory = false
      try { isDirectory = entry.isDirectory() } catch { isDirectory = false }
      if (!isDirectory) {
        try { isDirectory = statSync(join(directory, entry.name)).isDirectory() } catch { isDirectory = false }
      }
      if (isDirectory) names.push(String(entry.name))
    }
    if (names.length > 0) return names
  } catch { /* fall through to the plain listing */ }
  const names = []
  let entries = []
  try {
    entries = readdirSync(directory)
  } catch { return names }
  for (const entry of entries) {
    const name = String(entry)
    try {
      if (statSync(join(directory, name)).isDirectory()) names.push(name)
    } catch { /* unreadable entry */ }
  }
  return names
}

/**
 * Official tool names discovered from the installed `dsh-tool-*` packages, so a
 * DSH upgrade picks up new tools without a plugin release. Names the scan cannot
 * see (registered from a constant, or by a package that is not named
 * `dsh-tool-*`) are covered by the shipped catalog and the static list.
 */
const scannedOfficialToolsCache = new Map()
function scannedOfficialTools(installDir) {
  if (typeof installDir !== 'string' || installDir === '') return new Set()
  const cached = scannedOfficialToolsCache.get(installDir)
  if (cached !== undefined) return cached
  const names = new Set()
  const scopeDir = installScopeDir(installDir)
  if (scopeDir === undefined) {
    scannedOfficialToolsCache.set(installDir, names)
    return names
  }
  for (const entry of directoryNames(scopeDir)) {
    if (!entry.startsWith('dsh-tool-')) continue
    for (const name of packageToolNames(join(scopeDir, entry))) names.add(name)
  }
  scannedOfficialToolsCache.set(installDir, names)
  return names
}

/**
 * Tool names the shipped tool catalog records for packages this installation
 * actually contains. The catalog (`docs/tool-catalog.md`, generated per
 * release) is the only place that lists names registered through constants or
 * config — `exit_plan_mode`, `plugin_market`, `create_worktree` … — because
 * their packages are not named `dsh-tool-*` and a source scan cannot see a
 * symbol reference. Names whose package is absent (experimental or optional
 * bundles) are skipped, so a same-named third-party tool keeps its own badge.
 */
const catalogToolNamesCache = new Map()
function catalogToolNames(installDir) {
  if (typeof installDir !== 'string' || installDir === '') return new Set()
  const cached = catalogToolNamesCache.get(installDir)
  if (cached !== undefined) return cached
  const names = new Set()
  const scopeDir = installScopeDir(installDir)
  if (scopeDir !== undefined) {
    let catalog = ''
    try {
      catalog = readFileSync(join(installDir, 'docs', 'tool-catalog.md'), 'utf8')
    } catch { /* this installation ships no catalog — the static list stays authoritative */ }
    for (const line of catalog.split(/\r?\n/)) {
      const row = /^\| `(@deepseek-ai\/[^`]+)` \| (.+?) \|/.exec(line)
      if (row === null) continue
      if (!existsSync(join(scopeDir, row[1].slice('@deepseek-ai/'.length)))) continue
      for (const name of row[2].matchAll(/`([a-z0-9][a-z0-9_-]*)`/g)) names.add(name[1])
    }
  }
  catalogToolNamesCache.set(installDir, names)
  return names
}

/**
 * The official tool-name set for one request: the shipped list, the names the
 * installed `dsh-tool-*` packages declare, and the shipped catalog's names for
 * the official packages this installation contains. `config.officialTools`
 * replaces all three, `config.extraOfficialTools` appends to the result.
 */
function officialToolsOf(config, installDir) {
  const base = Array.isArray(config?.officialTools)
    ? config.officialTools
    : [...OFFICIAL_TOOL_NAMES, ...scannedOfficialTools(installDir), ...catalogToolNames(installDir)]
  const extra = Array.isArray(config?.extraOfficialTools) ? config.extraOfficialTools : []
  return new Set([...base, ...extra].filter(name => typeof name === 'string' && name !== ''))
}

/** Owning package per skill file, cached: the panel re-reads this every 5 s. */
const skillPackageCache = new Map()

/**
 * The npm package that owns a skill file, resolved by walking up to the nearest
 * `package.json`. `undefined` when no manifest is readable — a plain user
 * directory, which has no package of its own.
 */
function skillFilePackageOf(filePath) {
  if (skillPackageCache.has(filePath)) return skillPackageCache.get(filePath)
  let name
  let directory = dirname(filePath)
  for (let depth = 0; depth < 12; depth += 1) {
    try {
      const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
      if (typeof manifest?.name === 'string' && manifest.name !== '') {
        name = manifest.name
        break
      }
    } catch { /* no manifest at this level — keep walking */ }
    const parent = dirname(directory)
    if (parent === directory) break
    directory = parent
  }
  skillPackageCache.set(filePath, name)
  return name
}

/**
 * Whether a skill ships with the DSH installation. `bundled` already means the
 * installation-owned bundled root; every other filesystem source is resolved
 * through its owning package — `custom` in particular, which is how an official
 * agent preset injects its own skills directory.
 */
function skillPackageOf(skill) {
  if (typeof skill.path !== 'string' || skill.path === '') return undefined
  return skillFilePackageOf(skill.path)
}

/**
 * How a plugin package got installed, read from the specifier in the profile
 * manifest: a local dev link, a git-hosted checkout, or a registry version —
 * which is also what an install from the plugin market produces.
 *
 * Git covers every transport pnpm accepts (`git+https://…`, `git://…`,
 * `git@host:…`, `ssh://git@…`) plus the `github:` / `gitlab:` / `bitbucket:`
 * shorthands. A plain `https://…` is left to the registry: it may be a tarball,
 * so treating it as git would be a guess.
 */
function installKindOf(spec) {
  const specifier = spec.trim()
  // Anchored: `git+file://…` is a git install, and a URL that merely contains
  // `file:` is not a local link.
  if (/^(?:link|file|workspace|portal):/i.test(specifier)) return 'local'
  if (/^(?:git\+|git:|git@|ssh:\/\/|github:|gitlab:|bitbucket:)/i.test(specifier)) return 'git'
  return 'market'
}

/** Profile directory from the environment, for a host without `profileContext`. */
function envProfileDirectory() {
  const home = process.env.DSH_HOME
  const profile = process.env.DSH_PROFILE
  const directory = process.env.DSH_PROFILE_DIR
    ?? (typeof home === 'string' && typeof profile === 'string' && home !== '' && profile !== ''
      ? join(home, 'profiles', profile)
      : undefined)
  return typeof directory === 'string' && directory !== '' ? directory : undefined
}

/**
 * Where this process keeps its profile and its DSH installation.
 *
 * `profileContext` is the harness's own answer. The `DSH_PROFILE_DIR` /
 * `DSH_INSTALL_DIR` variables are derived from it *per shell execution* and are
 * not part of the desktop app's own process environment — reading them alone is
 * why every registry-installed package used to resolve to 「其他」. They stay as
 * a fallback for headless hosts that mount no `profileContext`.
 */
function resolveProfileSource(ctx) {
  let context
  try { context = ctx.get?.('profileContext') } catch { context = undefined }
  const dir = typeof context?.dir === 'string' && context.dir !== ''
    ? context.dir
    : envProfileDirectory()
  const installDir = typeof context?.installAnchor === 'string' && context.installAnchor !== ''
    ? dirname(context.installAnchor)
    : (typeof process.env.DSH_INSTALL_DIR === 'string' && process.env.DSH_INSTALL_DIR !== ''
      ? process.env.DSH_INSTALL_DIR
      : undefined)
  return { dir, installDir }
}

/**
 * Profile dependency name → install kind, cached per directory and refreshed
 * when the manifest's mtime changes (installing a plugin from the panel must not
 * wait for a restart). Unreadable manifests yield an empty map, which keeps
 * every package unlocated instead of guessing.
 */
const profileKindsCache = new Map()
/** Shared empty map: a stable identity keeps the owner-index cache from rebuilding. */
const EMPTY_KINDS = new Map()
function profilePackageKinds(profileDir) {
  if (typeof profileDir !== 'string' || profileDir === '') return EMPTY_KINDS
  const manifestPath = join(profileDir, 'package.json')
  let fingerprint
  try { fingerprint = statSync(manifestPath).mtimeMs } catch { fingerprint = undefined }
  const cached = profileKindsCache.get(profileDir)
  if (cached !== undefined && cached.fingerprint === fingerprint) return cached.kinds
  const kinds = new Map()
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    for (const field of ['dependencies', 'devDependencies']) {
      const deps = manifest?.[field]
      if (deps === null || typeof deps !== 'object') continue
      for (const [name, spec] of Object.entries(deps)) {
        if (typeof spec === 'string' && spec !== '') kinds.set(name, installKindOf(spec))
      }
    }
  } catch { /* no readable profile manifest — every package then stays unlocated */ }
  profileKindsCache.set(profileDir, { fingerprint, kinds })
  return kinds
}

/**
 * The `@deepseek-ai` scope directory when the installation uses the packaged
 * `node_modules/@deepseek-ai/dsh` layout. Other layouts (a source checkout's
 * `apps/cli`) have no meaningful sibling scope, so their siblings must never be
 * scanned for official packages.
 */
function installScopeDir(installDir) {
  if (typeof installDir !== 'string' || installDir === '') return undefined
  const scopeDir = dirname(installDir)
  return basename(scopeDir) === '@deepseek-ai' ? scopeDir : undefined
}

/**
 * Whether a file lives inside the installation tree. Needed because `bundled`
 * means "shipped by an installed bundle package", not "shipped by DSH": a
 * third-party bundle's skill root reports the same source.
 */
function insideInstallation(filePath, installDir) {
  const scopeDir = installScopeDir(installDir)
  if (scopeDir === undefined || typeof filePath !== 'string') return false
  const root = dirname(scopeDir).toLowerCase()
  const candidate = filePath.toLowerCase()
  return candidate === root || candidate.startsWith(`${root}${sep}`)
}

/**
 * Skill name → owning package, for skills whose own file path cannot be
 * resolved. The registry mounts `bundled` skills from a rewritten path, so
 * their `path` has no `package.json` above it; scanning the installed packages
 * still finds which package ships the skill.
 */
let skillOwnerCache

/**
 * Skill files under one root: `<name>/SKILL.md` directories and flat
 * `<name>.md` files (the registry's filesystem provider accepts both).
 */
function skillFilesIn(root) {
  let entries
  try {
    entries = readdirSync(root, { withFileTypes: true })
  } catch { return [] }
  const files = []
  for (const entry of entries) {
    const name = String(entry.name)
    let isDirectory = false
    let isFile = false
    try { isDirectory = entry.isDirectory() } catch { isDirectory = false }
    try { isFile = entry.isFile() } catch { isFile = false }
    if (!isDirectory && !isFile) {
      // ASAR Dirents can be unreliable: re-check with stat.
      try {
        const info = statSync(join(root, name))
        isDirectory = info.isDirectory()
        isFile = info.isFile()
      } catch { continue }
    }
    if (isDirectory) {
      try { if (!readdirSync(join(root, name)).includes('SKILL.md')) continue } catch { continue }
      files.push(join(root, name, 'SKILL.md'))
    } else if (isFile && name.toLowerCase().endsWith('.md')) {
      files.push(join(root, name))
    }
  }
  return files
}

/** The `name:` frontmatter value of a skill file, when the file is readable. */
function skillFrontmatterName(skillFile) {
  let text
  try { text = readFileSync(skillFile, 'utf8').slice(0, 2048) } catch { return undefined }
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  if (frontmatter === null) return undefined
  return /^name:\s*['"]?([a-z0-9][a-z0-9-]*)['"]?\s*$/m.exec(frontmatter[1])?.[1]
}

/**
 * Record the names a package ships: `skills/<name>/SKILL.md`,
 * `assets/<name>/SKILL.md`, flat `skills/<name>.md`, and the frontmatter `name`
 * when it differs from the file name (the registry registers the frontmatter).
 */
function scanPackageSkills(packageDir, packageName, kind, index) {
  for (const subdirectory of ['skills', 'assets']) {
    for (const skillFile of skillFilesIn(join(packageDir, subdirectory))) {
      const fileBase = basename(skillFile)
      const fallback = fileBase === 'SKILL.md' ? basename(dirname(skillFile)) : basename(skillFile, '.md')
      const names = [fallback]
      const frontmatter = skillFrontmatterName(skillFile)
      if (frontmatter !== undefined && frontmatter !== fallback) names.push(frontmatter)
      // Path resolution stays authoritative, so the first package to claim a
      // name only matters for skills reached through this index.
      for (const name of names) {
        if (!index.has(name)) index.set(name, { package: packageName, kind })
      }
    }
  }
}

/**
 * Build the skill-name → owning-package index for this profile + installation.
 * Rebuilt when the resolved locations or the profile dependency map change.
 */
function skillOwnerIndex(profileDir, installDir, kinds) {
  if (skillOwnerCache !== undefined
    && skillOwnerCache.profileDir === profileDir
    && skillOwnerCache.installDir === installDir
    && skillOwnerCache.kinds === kinds) {
    return skillOwnerCache.index
  }
  const index = new Map()
  if (typeof profileDir === 'string' && profileDir !== '') {
    for (const [packageName, kind] of kinds) {
      scanPackageSkills(join(profileDir, 'node_modules', packageName), packageName, kind, index)
    }
  }
  if (typeof installDir === 'string' && installDir !== '') {
    const scopeDir = installScopeDir(installDir)
    if (scopeDir !== undefined) {
      for (const entry of directoryNames(scopeDir)) {
        scanPackageSkills(join(scopeDir, entry), `@deepseek-ai/${entry}`, 'official', index)
      }
    }
  }
  skillOwnerCache = { profileDir, installDir, kinds, index }
  return index
}

/**
 * Origin kind of one skill: `official` for the installation itself, else the
 * owning package's install kind (`market` / `git` / `local`), else the skill
 * root it came from (`project` / `user` / `local`), else `other`.
 *
 * Resolution order matters. An explicit root decides first: a project skill
 * lives at `<repo>/.dsh/skills/…`, so walking its path up reaches the host
 * project's own `package.json` — a manifest that says nothing about where the
 * skill came from. Then the path resolves the owning package, then — for
 * `bundled` skills, whose path the registry rewrites — the package that ships a
 * skill of that name, then the installation tree, then the root source.
 */
function skillKindOf(skill, provenance) {
  const { officialPackages, kinds, profileDir, installDir } = provenance
  if (skill.source === 'project-dsh' || skill.source === 'project-agents') return 'project'
  if (skill.source === 'user-dsh' || skill.source === 'user-agents') return 'user'
  let undeclaredPackage = false
  const packageName = skillPackageOf(skill)
  if (typeof packageName === 'string' && packageName !== '') {
    if (officialPackages.some(prefix => packageName.startsWith(prefix))) return 'official'
    const kind = kinds.get(packageName)
    if (kind !== undefined) return kind
    // A package the profile does not declare may be the host project itself,
    // not a plugin: keep going instead of settling on 「其他」 here, so the
    // installation tree and the source still decide.
    undeclaredPackage = true
  }
  if (skill.source === 'bundled') {
    const owner = skillOwnerIndex(profileDir, installDir, kinds).get(skill.name)
    if (owner !== undefined) return owner.kind
  }
  if (typeof skill.path === 'string' && insideInstallation(skill.path, installDir)) return 'official'
  // Content shipped inside some package's node_modules is not a local dev
  // root, even when the profile does not declare that package: 其他 is honest.
  if (undeclaredPackage && typeof skill.path === 'string' && insideNodeModules(skill.path)) return 'other'
  switch (skill.source) {
    case 'bundled': return 'other'
    case 'custom': return 'local'
    case 'project-dsh': case 'project-agents': return 'project'
    case 'user-dsh': case 'user-agents': return 'user'
    default: return 'other'
  }
}

/** Whether a path runs through a `node_modules` directory. */
function insideNodeModules(filePath) {
  return filePath.toLowerCase().includes(`${sep}node_modules${sep}`)
}

/**
 * Resolve the package prefixes that mark an official DSH source.
 * `config.officialPackages` replaces the built-in `@deepseek-ai/` default.
 */
function officialPackagesOf(config) {
  const configured = config?.officialPackages
  const list = Array.isArray(configured)
    ? configured.filter(prefix => typeof prefix === 'string' && prefix !== '')
    : []
  return list.length > 0 ? list : DEFAULT_OFFICIAL_PACKAGES
}

/**
 * Provenance for one capability: the owning package when the caller declared
 * it, plus whether that package is DSH-official. `undefined` means "not
 * located" — a card must then avoid the official badge instead of guessing it.
 */
function originOf(packageName, officialPackages, kinds) {
  if (typeof packageName !== 'string' || packageName === '') return undefined
  const official = officialPackages.some(prefix => packageName.startsWith(prefix))
  return {
    package: packageName,
    official,
    // Declared tools get the same install-kind vocabulary as skills.
    kind: official ? 'official' : (kinds.get(packageName) ?? 'other'),
  }
}

/**
 * Per-wire-name provenance declared in `config.origins`. The harness exposes no
 * owner metadata on a registered tool, so this declaration is the only way to
 * locate a tool's package; every unlisted tool stays unlocated.
 */
function declaredOrigins(config, officialPackages, kinds) {
  const declared = config?.origins
  const origins = {}
  if (declared === null || typeof declared !== 'object') return origins
  for (const [wireName, packageName] of Object.entries(declared)) {
    if (wireName === '') continue
    const origin = originOf(packageName, officialPackages, kinds)
    if (origin !== undefined) origins[wireName] = origin
  }
  return origins
}

/** Same as `declaredOrigins`, keyed by MCP server name instead of wire name. */
function declaredServerOrigins(config, officialPackages, kinds) {
  const declared = config?.serverOrigins
  const origins = {}
  if (declared === null || typeof declared !== 'object') return origins
  for (const [serverName, packageName] of Object.entries(declared)) {
    if (serverName === '') continue
    const origin = originOf(packageName, officialPackages, kinds)
    if (origin !== undefined) origins[serverName] = origin
  }
  return origins
}

function writeJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store' })
  res.end(JSON.stringify(body))
}

/** Host plugin body: mount the summary route. Lives for the plugin's fiber. */
export const inject = ['webServer', 'sessions', 'skills', 'agents', 'tools', 'configEditor']

export function apply(ctx, config = {}) {
  // Package prefixes that mark an official source, shared by tools and skills.
  const officialPackages = officialPackagesOf(config)

  /**
   * Provenance inputs for one request. The profile and installation are
   * resolved live (a `profileContext` may mount after this plugin), and the
   * dependency map is re-read when the profile manifest changes.
   */
  function provenanceOf() {
    const { dir: profileDir, installDir } = resolveProfileSource(ctx)
    const kinds = profilePackageKinds(profileDir)
    return {
      officialPackages,
      profileDir,
      installDir,
      kinds,
      // Declared provenance for tools; skills carry their own `source`, and
      // neither the registry nor the tool definition records an owning package.
      origins: declaredOrigins(config, officialPackages, kinds),
      // Same declaration shape for MCP servers: the harness records which
      // server a tool belongs to, but not which package installed the server.
      serverOrigins: declaredServerOrigins(config, officialPackages, kinds),
      // Tools shipped by the installation itself, matched by name.
      officialTools: officialToolsOf(config, installDir),
    }
  }

  // Skill catalog as THE SESSION sees it: preset compositions may add
  // customSkillDirs (e.g. nwy-workflow injects its skills dir into the
  // standard-preset override), which live in the agent's composed scope and
  // never reach the host-side registry. So read the live agent's own `skills`
  // service —the same per-session source the "/" picker lists —and fall back
  // to the host registry only when the agent context is unavailable.
  async function availableSkills(sessionId, session, provenance) {
    const cwd = typeof session?.workingDirectory === 'string' && session.workingDirectory !== ''
      ? session.workingDirectory
      : undefined
    try {
      const agent = ctx.agents?.get?.(sessionId)
      const scoped = agent?.ctx?.reflect?.get?.('skills')
      if (scoped && typeof scoped.list === 'function') {
        // `scope` selects the preset-composed layer —exactly what the
        // `skills/list` Remote behind the "/" menu resolves for the session.
        return toSummaries(await scoped.list({ cwd, scope: agent }), provenance)
      }
    } catch { /* fall through to the host registry */ }
    return toSummaries(await ctx.skills.list({ cwd }), provenance)
  }

  /**
   * The owning package's display name: npm scope dropped, `dsh-` prefix
   * dropped (`@local/nwy-workflow` → `nwy-workflow`). Official packages are
   * skipped — their cards already wear the 内置 badge and a package name
   * would only add noise.
   */
  function shortPackageName(packageName) {
    if (typeof packageName !== 'string' || packageName === '') return undefined
    if (officialPackages.some(prefix => packageName.startsWith(prefix))) return undefined
    return packageName.replace(/^@[^/]+\//, '').replace(/^dsh-/i, '') || undefined
  }

  /** Normalize whatever `skills.list` yields into the wire shape. */
  function toSummaries(summaries, provenance) {
    const ownerIndex = skillOwnerIndex(provenance.profileDir, provenance.installDir, provenance.kinds)
    return (Array.isArray(summaries) ? summaries : []).map(s => {
      const originKind = skillKindOf(s, provenance)
      // The owning package name rides along for every non-official skill:
      // path-resolved first, the name → package index as the bundled fallback
      // (the registry rewrites those skills' paths, so lookup-by-path fails).
      let pkg = originKind === 'official' ? undefined : shortPackageName(skillPackageOf(s))
      if (pkg === undefined && originKind !== 'official') {
        pkg = shortPackageName(ownerIndex.get(s.name)?.package)
      }
      return {
        name: s.name,
        ...(typeof s.description === 'string' && s.description !== '' ? { description: s.description } : {}),
        ...(typeof s.source === 'string' && s.source !== '' ? { source: s.source } : {}),
        originKind,
        ...(pkg !== undefined ? { pkg } : {}),
      }
    })
  }

  /**
   * How each MCP server is reached, keyed by `serverName`: `local` for a
   * `stdio` transport (the server runs as a child process on this machine)
   * and `remote` for network transports (`streamable-http`, `sse`). Read from
   * the MCP client rows' live config, so a new server needs no declaration
   * here. Any failure yields `undefined` and the card falls back to the
   * server-name badge.
   */
  function serverAccessOf() {
    try {
      const entries = ctx.configEditor?.entries?.() ?? []
      const access = {}
      for (const entry of entries) {
        const config = entry?.options?.config
        if (config === null || typeof config !== 'object') continue
        const serverName = typeof config.serverName === 'string' ? config.serverName : ''
        const transport = typeof config.transport === 'string' ? config.transport.toLowerCase() : ''
        if (serverName === '' || transport === '') continue
        access[serverName] = transport === 'stdio' ? 'local' : 'remote'
      }
      return Object.keys(access).length > 0 ? access : undefined
    } catch {
      return undefined
    }
  }

  /**
   * Tool descriptions for card hover text, keyed by wire name. Merges the
   * host-level registry with the live agent's session-scoped registry (which
   * carries the sandboxed builtins like pwsh/edit) and the MCP servers'
   * entries. Missing entries simply fall back to no description on the card.
   */
  async function toolInfo(sessionId) {
    const map = {}
    const collect = defs => {
      for (const d of Array.isArray(defs) ? defs : []) {
        if (typeof d?.name === 'string' && d.name !== '' && typeof d?.description === 'string' && d.description !== '') {
          map[d.name] = d.description
        }
      }
    }
    try { collect(ctx.tools?.definitions?.()) } catch { /* host registry unavailable */ }
    try {
      const agent = ctx.agents?.get?.(sessionId)
      const scoped = agent?.ctx?.reflect?.get?.('tools')
      if (scoped) {
        if (typeof scoped.definitions === 'function') collect(scoped.definitions())
        if (typeof scoped.schemas === 'function') collect(scoped.schemas())
        if (typeof scoped.definitions === 'function') { try { collect(scoped.definitions(agent)) } catch { /* scope not accepted */ } }
        if (typeof scoped.schemas === 'function') { try { collect(scoped.schemas(agent)) } catch { /* scope not accepted */ } }
      }
    } catch { /* session registry unavailable */ }
    return Object.keys(map).length > 0 ? map : undefined
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: ROUTE,
    handler: async (req, res) => {
      if (req.method !== 'GET') {
        writeJson(res, 405, { ok: false, error: { code: 'method-error', message: 'method not allowed' } })
        return
      }
      try {
        const url = new URL(req.url ?? '/', 'http://dsh.internal')
        const sessionId = url.searchParams.get('sessionId')
        if (!sessionId) {
          writeJson(res, 400, { ok: false, error: { code: 'bad-request', message: 'sessionId is required' } })
          return
        }
        const session = ctx.sessions.get(sessionId)
        if (session === undefined || typeof session.snapshotEvents !== 'function') {
          // Detached (cold) session: v1 does not read the persisted log.
          writeJson(res, 200, { ok: true, available: false, skills: [], tools: [], mcp: [], availableSkills: [] })
          return
        }
        // Resolved after the cold-session branch: an empty response must not
        // pay for the profile/installation scan.
        const provenance = provenanceOf()
        const { skills, tools, mcp } = summarize(session.snapshotEvents())
        writeJson(res, 200, {
          ok: true,
          available: true,
          skills,
          tools,
          mcp,
          availableSkills: await availableSkills(sessionId, session, provenance),
          toolInfo: await toolInfo(sessionId),
          origins: provenance.origins,
          officialTools: [...provenance.officialTools],
          serverOrigins: provenance.serverOrigins,
          serverAccess: serverAccessOf(),
        })
      } catch (error) {
        writeJson(res, 500, {
          ok: false,
          error: { code: 'internal', message: error instanceof Error ? error.message : String(error) },
        })
      }
    },
  }), 'dsh-usage-panel: summary route')
}
