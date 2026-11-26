/**
 * @local/dsh-capability-map — Host half.
 *
 * Serves GET /usage/api/summary?sessionId=<id> on the harness web server:
 * folds the live session's event log into a capability-usage summary
 * (skill tool calls with their skill name, plus all other tool calls
 * aggregated by name) and lists the locally available skills from the
 * harness skill registry (ctx.skills) so the browser tab can also preview
 * capabilities this session has not called.
 */

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
  // Pass 1: collect every callId that has a result. A single forward scan
  // cannot do this — a call event always precedes its result, so "settled"
  // would be false for every already-finished call and every card would show
  // 运行中 forever. Result events carry the id in data.message.toolCallId
  // (data.callId does not exist on them).
  const settled = new Set()
  for (const event of events) {
    if (event?.type === 'tool/result') {
      const callId = event.data?.callId
        ?? event.data?.message?.toolCallId
        ?? event.data?.message?.source?.callId
      if (typeof callId === 'string' && callId !== '') settled.add(callId)
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
    if (wireName === 'skill') {
      const name = skillNameOf(typeof data?.arguments === 'string' ? data.arguments : '') ?? '(unknown)'
      const entry = skills.get(name)
      if (entry === undefined) {
        skills.set(name, { kind: 'skill', name, count: 1, lastTime: time, lastSettled: isSettled, running: isSettled ? 0 : 1 })
      } else {
        entry.count += 1
        entry.lastTime = time
        entry.lastSettled = isSettled
        if (!isSettled) entry.running += 1
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
        mcp.set(key, { kind: 'mcp', name: mcpMatch[2], server: mcpMatch[1], count: 1, lastTime: time, lastSettled: isSettled, running: isSettled ? 0 : 1 })
      } else {
        entry.count += 1
        entry.lastTime = time
        entry.lastSettled = isSettled
        if (!isSettled) entry.running += 1
      }
      continue
    }
    const entry = tools.get(wireName)
    if (entry === undefined) {
      tools.set(wireName, { kind: 'tool', name: wireName, count: 1, lastTime: time, lastSettled: isSettled, running: isSettled ? 0 : 1 })
    } else {
      entry.count += 1
      entry.lastTime = time
      entry.lastSettled = isSettled
      if (!isSettled) entry.running += 1
    }
  }
  return {
    skills: [...skills.values()],
    tools: [...tools.values()],
    mcp: [...mcp.values()],
  }
}

function writeJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store' })
  res.end(JSON.stringify(body))
}

/** Host plugin body: mount the summary route. Lives for the plugin's fiber. */
export const inject = ['webServer', 'sessions', 'skills', 'agents', 'tools']

export function apply(ctx) {
  // Skill catalog as THE SESSION sees it: preset compositions may add
  // customSkillDirs (e.g. nwy-workflow injects its skills dir into the
  // standard-preset override), which live in the agent's composed scope and
  // never reach the host-side registry. So read the live agent's own `skills`
  // service — the same per-session source the "/" picker lists — and fall back
  // to the host registry only when the agent context is unavailable.
  async function availableSkills(sessionId, session) {
    const cwd = typeof session?.workingDirectory === 'string' && session.workingDirectory !== ''
      ? session.workingDirectory
      : undefined
    try {
      const agent = ctx.agents?.get?.(sessionId)
      const scoped = agent?.ctx?.reflect?.get?.('skills')
      if (scoped && typeof scoped.list === 'function') {
        // `scope` selects the preset-composed layer — exactly what the
        // `skills/list` Remote behind the "/" menu resolves for the session.
        return toSummaries(await scoped.list({ cwd, scope: agent }))
      }
    } catch { /* fall through to the host registry */ }
    return toSummaries(await ctx.skills.list({ cwd }))
  }

  /** Normalize whatever `skills.list` yields into the wire shape. */
  function toSummaries(summaries) {
    return (Array.isArray(summaries) ? summaries : []).map(s => ({
      name: s.name,
      ...(typeof s.description === 'string' && s.description !== '' ? { description: s.description } : {}),
      ...(typeof s.source === 'string' && s.source !== '' ? { source: s.source } : {}),
    }))
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
        const { skills, tools, mcp } = summarize(session.snapshotEvents())
        writeJson(res, 200, {
          ok: true,
          available: true,
          skills,
          tools,
          mcp,
          availableSkills: await availableSkills(sessionId, session),
          toolInfo: await toolInfo(sessionId),
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
