/**
 * dsh-capability-map — Client half.
 *
 * Registers a native right-Sidebar tab type ("Capability map" / 能力地图) via
 * ctx.sidebarRightTabs, whose guide entry (with icon) shows one card in the
 * "+" add panel; the body slot renders a filterable card grid of the
 * skills / tools / MCP tools the session has called, fetched from the Host
 * route /usage/api/summary. A header toggle previews every locally
 * available skill (uncalled ones show 0 calls).
 */
window.__ModuleLoader__.load({
  id: 'dsh-capability-map',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const KIND = 'dsh-capability-map'

    // Component-local stylesheet: rendered as a React element, so unmounting
    // the panel removes it. Colors go through theme tokens with neutral
    // chain tails so the panel follows light/dark themes.
    const STYLE = `
.cmap-root{height:100%;display:flex;flex-direction:column;font-size:12.5px;color:var(--dsw-alias-label-primary,#1c1c1e);overflow:hidden}
.cmap-head{display:flex;align-items:center;gap:8px;padding:12px 14px 10px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.2));flex:none}
.cmap-head .cmap-title{font-size:13px;font-weight:650;letter-spacing:.2px}
.cmap-head .cmap-sub{font-size:11px;color:var(--dsw-alias-label-secondary,#8a8a8e)}
.cmap-refresh{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.25));background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-secondary,#8a8a8e);cursor:pointer;flex:none}
.cmap-refresh:hover{color:var(--dsw-alias-brand-primary,#4a8fd6);border-color:var(--dsw-alias-brand-primary,#4a8fd6)}
.cmap-refresh:disabled{opacity:.45;cursor:default}
.cmap-toggle{margin-left:auto;display:inline-flex;align-items:center;height:24px;padding:0 10px;border-radius:999px;border:.5px solid var(--dsw-alias-border-l3,rgba(127,127,127,.28));background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-secondary,#8a8a8e);font-size:11.5px;font-weight:500;cursor:pointer;flex:none;transition:background .12s ease}
.cmap-toggle:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.07))}
.cmap-toggle.active{color:var(--dsw-alias-brand-primary,#4a8fd6);border-color:var(--dsw-alias-brand-primary,#4a8fd6);background:color-mix(in srgb,var(--dsw-alias-brand-primary,#4a8fd6) 12%,transparent);font-weight:650}
.cmap-scroll{flex:1;overflow-y:auto;padding:10px 14px 18px;box-sizing:border-box}
.cmap-tabs{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;align-items:center}
.cmap-tab{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:500;padding:4px 12px;border-radius:999px;cursor:pointer;border:.5px solid var(--dsw-alias-border-l3,rgba(127,127,127,.28));background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-secondary,#8a8a8e);transition:background .12s ease}
.cmap-tab:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.07))}
.cmap-tab.active{color:var(--dsw-alias-brand-primary,#4a8fd6);border-color:var(--dsw-alias-brand-primary,#4a8fd6);background:color-mix(in srgb,var(--dsw-alias-brand-primary,#4a8fd6) 12%,transparent);font-weight:650}.cmap-tab .cmap-tab-count{font-size:11px;font-weight:600;padding:0 6px;border-radius:999px;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.14));color:inherit}
.cmap-tab.active .cmap-tab-count{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#4a8fd6) 22%,transparent)}
.cmap-sort{margin-left:auto;display:inline-flex;align-items:center;gap:2px;padding:2px;border-radius:999px;border:.5px solid var(--dsw-alias-border-l3,rgba(127,127,127,.28));background:var(--dsw-alias-bg-layer-1,transparent);flex:none}
.cmap-sort button{border:none;border-radius:999px;padding:3px 9px;font-size:11.5px;line-height:1.3;font-weight:500;background:transparent;color:var(--dsw-alias-label-secondary,#8a8a8e);cursor:pointer;transition:background .12s ease,color .12s ease;white-space:nowrap}
.cmap-sort button:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.07))}
.cmap-sort button.active{color:var(--dsw-alias-brand-primary,#4a8fd6);background:color-mix(in srgb,var(--dsw-alias-brand-primary,#4a8fd6) 12%,transparent);font-weight:650}
.cmap-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}
.cmap-card{position:relative;display:flex;flex-direction:column;gap:8px;padding:12px 14px;border-radius:var(--dsw-radius-xl,16px);border:.5px solid var(--dsw-alias-border-l3,rgba(127,127,127,.28));background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.04));transition:background .12s ease;min-height:74px}
.cmap-card:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.08))}
.cmap-card-top{display:flex;align-items:center;gap:8px;min-width:0;margin-bottom:2px}
.cmap-card-pkg{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10.5px;color:var(--dsw-alias-label-tertiary,#a0a0a6)}
.cmap-card-top .cmap-badge{margin-left:auto;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.cmap-glyph{width:26px;height:26px;border-radius:8px;flex:none;display:flex;align-items:center;justify-content:center}
.cmap-glyph svg{width:14px;height:14px}
.cmap-glyph-skill{color:var(--dsw-alias-state-warn-primary,#c78a2e)}
.cmap-glyph-tool{color:var(--dsw-alias-brand-primary,#4a8fd6)}
.cmap-glyph-mcp{color:var(--dsw-alias-state-success-primary,#3d9a63)}
.cmap-card-name{font-weight:500;font-size:13px;line-height:1.4;color:var(--dsw-alias-label-primary,#1c1c1e);overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word}
.cmap-card-tags{margin-top:4px;display:flex;flex-wrap:wrap;gap:4px;min-width:0}
.cmap-badge{display:inline-flex;justify-content:center;min-width:32px;font-size:10px;font-weight:500;line-height:1;padding:2px 4px;border-radius:6px;white-space:nowrap}
.cmap-badge-blue{color:#3b76c4;background:rgba(59,118,196,.12)}
.cmap-badge-green{color:#3d9a63;background:rgba(61,154,99,.13)}
.cmap-badge-purple{color:#8a63c9;background:rgba(138,99,201,.13)}
.cmap-badge-teal{color:#2e8f96;background:rgba(46,143,150,.13)}
.cmap-badge-orange{color:#c07a2e;background:rgba(192,122,46,.14)}
.cmap-badge-gray{color:#8a8a8e;background:rgba(127,127,127,.12)}
.cmap-badge-violet{color:#7b61c9;background:rgba(123,97,201,.13)}
.cmap-badge-slate{color:#5f7a8a;background:rgba(95,122,138,.13)}
.cmap-card-foot{margin-top:auto;display:flex;align-items:flex-end;justify-content:space-between;gap:6px}
.cmap-card-time{font-size:10.5px;color:var(--dsw-alias-label-tertiary,#a0a0a6);white-space:nowrap}
.cmap-count{display:inline-flex;align-items:baseline;gap:3px;flex:none}
.cmap-count .cmap-count-num{font-size:16px;font-weight:750;line-height:1;color:var(--dsw-alias-brand-primary,#4a8fd6)}
.cmap-count .cmap-count-unit{font-size:10px;color:var(--dsw-alias-label-tertiary,#a0a0a6)}
.cmap-chip{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;padding:1px 8px;border-radius:999px;white-space:nowrap;flex:none;color:var(--dsw-alias-state-warn-primary,#c78a2e);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#c78a2e) 13%,transparent)}
.cmap-chip .cmap-dot{width:6px;height:6px;border-radius:999px;background:currentColor;animation:cmap-pulse 1.1s ease-in-out infinite}
@keyframes cmap-pulse{0%,100%{opacity:1}50%{opacity:.25}}
.cmap-search{flex:1;display:flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.25));background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-secondary,#8a8a8e);min-width:0;transition:border-color .12s ease}
.cmap-search:focus-within{border-color:var(--dsw-alias-brand-primary,#4a8fd6);color:var(--dsw-alias-label-primary,#1c1c1e)}
.cmap-search svg{flex:none;opacity:.55}
.cmap-search input{flex:1;min-width:0;border:none;outline:none;background:transparent;color:inherit;font-size:12.5px;padding:0}
.cmap-search input::placeholder{color:var(--dsw-alias-label-tertiary,#a0a0a6)}
.cmap-search-clear{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:999px;border:none;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.14));color:var(--dsw-alias-label-secondary,#8a8a8e);cursor:pointer;flex:none;font-size:12px;line-height:1;padding:0}
.cmap-search-clear:hover{color:var(--dsw-alias-label-primary,#1c1c1e)}
.cmap-state{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:40px 20px;text-align:center;color:var(--dsw-alias-label-secondary,#8a8a8e);font-size:12.5px;line-height:1.8}
.cmap-state .cmap-state-icon{width:44px;height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.07));border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.18))}
.cmap-state svg{width:22px;height:22px;opacity:.6}
.cmap-error{color:var(--dsw-alias-state-error-primary,#d05a5a)}
`

    // Every icon carries explicit width/height so no SVG ever sizes to its
    // container (the giant-star bug).
    const ICON_SPARK = h('svg', { viewBox: '0 0 16 16', width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
      h('path', { d: 'M8 1.5 9.7 6l4.5 1.7-4.5 1.7L8 14l-1.7-4.6L1.8 7.7 6.3 6 8 1.5Z' }))

    const ICON_TOOL = h('svg', { viewBox: '0 0 16 16', width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
      h('path', { d: 'M9.6 2.8a3.4 3.4 0 0 1 4.6 4.4l-8 8-3.4-3.4 8-8-1.2-1Z' }),
      h('path', { d: 'm5 11 1.4 1.4' }))

    const ICON_PLUG = h('svg', { viewBox: '0 0 16 16', width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
      h('path', { d: 'M5.5 1.5v3M10.5 1.5v3' }),
      h('path', { d: 'M4 4.5h8v2.6a4 4 0 0 1-4 4 4 4 0 0 1-4-4V4.5Z' }),
      h('path', { d: 'M8 11.2v3.3' }))

    const ICON_REFRESH = h('svg', { viewBox: '0 0 16 16', width: 13, height: 13, fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
      h('path', { d: 'M13.5 8a5.5 5.5 0 1 1-1.6-3.9' }),
      h('path', { d: 'M13.7 1.8v2.7H11' }))

    const ICON_SEARCH = h('svg', { viewBox: '0 0 16 16', width: 13, height: 13, fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', 'aria-hidden': true },
      h('circle', { cx: 7, cy: 7, r: 4.5 }),
      h('path', { d: 'm10.5 10.5 3 3' }))

    const ICON_MAP = h('svg', { viewBox: '0 0 24 24', width: 22, height: 22, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
      h('circle', { cx: 12, cy: 12, r: 3 }),
      h('circle', { cx: 5, cy: 6, r: 2 }),
      h('circle', { cx: 19, cy: 7, r: 2 }),
      h('circle', { cx: 15, cy: 19, r: 2 }),
      h('path', { d: 'M6.6 7.3 10 10.4M13.9 10.6l3.4-2.4M13.4 14.6l1.1 2.7' }))

    /** The Guide card glyph; `size` comes from the host guide renderer. */
    function guideIcon(props) {
      const size = (props && typeof props.size === 'number' ? props.size : 16)
      return h('svg', {
        viewBox: '0 0 24 24', width: size, height: size, fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
      },
        h('circle', { cx: 12, cy: 12, r: 3 }),
        h('circle', { cx: 5, cy: 6, r: 2 }),
        h('circle', { cx: 19, cy: 7, r: 2 }),
        h('circle', { cx: 15, cy: 19, r: 2 }),
        h('path', { d: 'M6.6 7.3 10 10.4M13.9 10.6l3.4-2.4M13.4 14.6l1.1 2.7' }))
    }

    function formatTime(ms) {
      if (typeof ms !== 'number' || !Number.isFinite(ms)) return ''
      try { return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) } catch { return '' }
    }

    function State(props) {
      return h('div', { className: `cmap-state ${props.error ? 'cmap-error' : ''}` },
        h('div', { className: 'cmap-state-icon' }, props.error ? ICON_TOOL : ICON_MAP),
        h('div', null, props.text))
    }

    /**
     * Origin kind → badge. The host resolves a skill's kind and, for tools,
     * sends the declared `origins` plus the installation's official tool names;
     * the browser matches wire names, applies the registry fallback and renders
     * the result.
     */
    const KIND_BADGES = {
      official: { label: '内置', cls: 'cmap-badge-blue' },
      market: { label: '市场', cls: 'cmap-badge-green' },
      git: { label: 'Git', cls: 'cmap-badge-violet' },
      local: { label: '本地', cls: 'cmap-badge-slate' },
      project: { label: '项目', cls: 'cmap-badge-purple' },
      user: { label: '用户', cls: 'cmap-badge-teal' },
      other: { label: '其他', cls: 'cmap-badge-gray' },
      // MCP server access, derived from the row's transport: stdio runs as a
      // child process on this machine (local), network transports are remote.
      accessLocal: { label: '本地', cls: 'cmap-badge-teal' },
      accessRemote: { label: '远程', cls: 'cmap-badge-orange' },
    }

    /** Registry `source` → kind, for a summary that predates `originKind`. */
    const SOURCE_KINDS = {
      // `bundled` is NOT official evidence: a third-party bundle ships its
      // skills under the same source, so both fall back to the neutral badge.
      bundled: 'other',
      custom: 'local',
      'project-dsh': 'project',
      'project-agents': 'project',
      'user-dsh': 'user',
      'user-agents': 'user',
    }

    const OTHER_BADGE = KIND_BADGES.other

    /**
     * Card order inside a category: built in first, then progressively farther
     * from the user — project skills, the user's own roots, local dev links,
     * git checkouts, the registry, and finally anything unlocated.
     */
    const KIND_ORDER = ['official', 'project', 'user', 'local', 'git', 'market', 'other']
    const KIND_RANK = new Map(KIND_ORDER.map((kind, index) => [kind, index]))
    const UNRANKED = KIND_ORDER.length

    /** Exact wire name first, then an `origins` wildcard such as `blender_rt_*`. */
    function originFor(name, origins) {
      if (origins === undefined) return undefined
      if (Object.hasOwn(origins, name)) return origins[name]
      for (const [pattern, origin] of Object.entries(origins)) {
        if (!pattern.includes('*')) continue
        const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
        if (new RegExp(`^${escaped}$`).test(name)) return origin
      }
      return undefined
    }

    /**
     * The resolved origin kind of one card; MCP cards have none (badge = server).
     *
     * Skills arrive with the host's `originKind`; tools only carry declared
     * `origins` and the installation's official names, so the browser does the
     * name matching. A host that predates those fields keeps the legacy 内置
     * for tools — the client can reload live while the host half only restarts
     * with the app, so version skew is a real state.
     */
    function kindOf(entry, origins, officialTools) {
      if (entry.kind === 'mcp') return undefined
      if (entry.kind === 'skill') return entry.originKind ?? SOURCE_KINDS[entry.source] ?? 'other'
      // Tools carry no owner in their definition: a declared origin decides
      // first, then the installation's own tool-name list; anything else stays
      // 「其他」 rather than claiming to be built in.
      const origin = originFor(entry.name, origins)
      if (origin !== undefined) return origin.kind
      if (officialTools === undefined) return 'official'
      return officialTools.has(entry.name) ? 'official' : 'other'
    }

    function badgeOf(entry, origins, officialTools, serverAccess) {
      if (entry.kind === 'mcp') {
        // Access badge when the server's transport is known; otherwise the
        // server name stays the badge so the card never loses its identity.
        const access = serverAccess?.[entry.server]
        if (access === 'local' || access === 'remote') return KIND_BADGES[`access${access[0].toUpperCase()}${access.slice(1)}`] ?? KIND_BADGES.other
        return entry.server ? { label: entry.server, cls: 'cmap-badge-orange' } : null
      }
      return KIND_BADGES[kindOf(entry, origins, officialTools)] ?? OTHER_BADGE
    }

    /**
     * The owning plugin's display name: npm scope dropped, `dsh-` prefix
     * dropped (`@local/nwy-workflow` → `nwy-workflow`). Official tools skip
     * it — the 内置 badge already says everything. MCP cards skip it too:
     * their server badge covers the same ownership.
     */
    function stripPackageName(packageName) {
      if (typeof packageName !== 'string' || packageName === '') return undefined
      return packageName.replace(/^@[^/]+\//, '').replace(/^dsh-/i, '') || undefined
    }

    function pkgOf(entry, origins, officialTools, skillCatalog, serverAccess) {
      // MCP cards carry the server name as their ownership line once the
      // access badge (本地/远程) replaces the server-name badge; without the
      // access the badge still shows the server name, so the line stays empty.
      if (entry.kind === 'mcp') return serverAccess?.[entry.server] !== undefined ? entry.server : undefined
      if (entry.kind !== 'skill' && entry.kind !== 'tool') return undefined
      if (entry.kind === 'tool' && officialTools !== undefined && officialTools.has(entry.name)) return undefined
      const declared = entry.kind === 'tool' ? stripPackageName(origins?.[entry.name]?.package) : undefined
      if (declared !== undefined) return declared
      if (entry.pkg !== undefined) return entry.pkg
      return stripPackageName(skillCatalog.get(entry.name)?.pkg)
    }

    function CapabilityCard(props) {
      const entry = props.entry
      const glyphClass = entry.kind === 'skill' ? 'cmap-glyph-skill' : entry.kind === 'mcp' ? 'cmap-glyph-mcp' : 'cmap-glyph-tool'
      const glyph = entry.kind === 'skill' ? ICON_SPARK : entry.kind === 'mcp' ? ICON_PLUG : ICON_TOOL
      const idle = entry.count === 0
      const badge = badgeOf(entry, props.origins, props.officialTools, props.serverAccess)
      const pkg = pkgOf(entry, props.origins, props.officialTools, props.skillCatalog, props.serverAccess)
      const rawDescription = props.description
      const description = typeof rawDescription === 'string' && rawDescription.length > 400
        ? `${rawDescription.slice(0, 400).trimEnd()}…`
        : rawDescription
      // When the access badge replaces the server-name badge, the hover text
      // keeps the server identity in front of the description.
      const hoverServer = entry.kind === 'mcp' && props.serverAccess?.[entry.server] !== undefined && entry.server
        ? `${entry.server}（${props.serverAccess[entry.server] === 'local' ? '本地' : '远程'}）\n`
        : ''
      return h('div', { className: 'cmap-card', title: description ? `${hoverServer}${description}` : null },
        // Top row: icon, owning plugin's short name, then the badge. The name
        // truncates with an ellipsis so a long package name never squeezes the
        // badge or wraps awkwardly; the full name stays in the hover text.
        h('div', { className: 'cmap-card-top' },
          h('span', { className: `cmap-glyph ${glyphClass}` }, glyph),
          pkg
            ? h('span', { className: 'cmap-card-pkg', title: pkg }, pkg)
            : null,
          badge
            ? h('span', { className: `cmap-badge ${badge.cls}` }, badge.label)
            : null),
        // The name owns the full card width below, so long skill names wrap
        // naturally instead of fighting the badge for horizontal space.
        h('div', { className: 'cmap-card-name' }, entry.name),
        h('div', { className: 'cmap-card-foot' },
          h('span', { className: 'cmap-card-time' }, idle ? '' : formatTime(entry.lastTime)),
          // A 0 count already says "not called in this session", so only a
          // live call needs a chip here.
          entry.running > 0
            ? h('span', { className: 'cmap-chip' }, h('span', { className: 'cmap-dot' }), '运行中')
            : null,
          h('span', { className: 'cmap-count' },
            h('span', { className: 'cmap-count-num' }, String(entry.count)),
            h('span', { className: 'cmap-count-unit' }, '次')))
      )
    }

    const TABS = [
      { id: 'all', label: '全部' },
      { id: 'skill', label: '技能' },
      { id: 'tool', label: '工具' },
      { id: 'mcp', label: 'MCP' },
    ]

    function UsagePanel(props) {
      const sessionId = props.sessionId
      const [data, setData] = React.useState(undefined)
      const [error, setError] = React.useState(undefined)
      const [busy, setBusy] = React.useState(false)
      const [tab, setTab] = React.useState('all')
      const [showAll, setShowAll] = React.useState(false)
      const [query, setQuery] = React.useState('')
      // 'badge' (default) groups by provenance; 'count' ranks by this session's
      // call counts. Name breaks the last tie in both modes.
      const [sort, setSort] = React.useState('badge')

      const refresh = React.useCallback(async () => {
        if (!sessionId) return
        setBusy(true)
        try {
          const response = await fetch(`/usage/api/summary?sessionId=${encodeURIComponent(sessionId)}`, {
            credentials: 'same-origin', cache: 'no-store',
          })
          const body = await response.json()
          if (!response.ok || body?.ok !== true) throw new Error(body?.error?.message || `HTTP ${response.status}`)
          setData(body)
          setError(undefined)
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
        } finally {
          setBusy(false)
        }
      }, [sessionId])

      React.useEffect(() => {
        void refresh()
        const timer = setInterval(() => { void refresh() }, 5000)
        return () => clearInterval(timer)
      }, [refresh])

      const byKind = {
        skill: [...(data?.skills ?? [])],
        tool: [...(data?.tools ?? [])],
        mcp: [...(data?.mcp ?? [])],
      }
      // Preview of every locally available skill: uncalled ones join the grid
      // with count 0 when "show all" is on.
      const availableSkills = Array.isArray(data?.availableSkills) ? data.availableSkills : []
      const skillCatalog = new Map(availableSkills.map(s => [s.name, s]))
      const toolInfoMap = data?.toolInfo && typeof data.toolInfo === 'object' ? data.toolInfo : {}
      // Declared tool provenance (`{ [wireName]: { package, official } }`): the
      // only source of an owning package, so an absent entry means unlocated.
      const originsMap = data?.origins && typeof data.origins === 'object' ? data.origins : {}
      // Tool names the installation itself ships. `undefined` means the host
      // predates the field, not "no official tools": keep the legacy 内置.
      const officialTools = Array.isArray(data?.officialTools) ? new Set(data.officialTools) : undefined
      const serverAccess = data?.serverAccess && typeof data.serverAccess === 'object' ? data.serverAccess : undefined
      // Card order inside a category: the sort toggle picks the primary key —
      // badge priority (KIND_ORDER) or this session's call count — and the
      // capability name always breaks the last tie, so a group keeps one
      // findable layout. MCP cards have no origin kind: their server groups
      // them and names sort inside a server.
      const sortEntries = entries => {
        const ranked = entries.map(entry => ({ entry, rank: KIND_RANK.get(kindOf(entry, originsMap, officialTools)) ?? UNRANKED }))
        if (sort === 'count') {
          ranked.sort((left, right) => (right.entry.count ?? 0) - (left.entry.count ?? 0)
            || left.rank - right.rank
            || left.entry.name.localeCompare(right.entry.name))
        } else {
          ranked.sort((left, right) => left.rank - right.rank
            || left.entry.name.localeCompare(right.entry.name))
        }
        return ranked.map(({ entry }) => entry)
      }
      const sortMcp = entries => {
        const list = [...entries]
        if (sort === 'count') {
          list.sort((left, right) => (right.count ?? 0) - (left.count ?? 0)
            || (left.server ?? '').localeCompare(right.server ?? '')
            || left.name.localeCompare(right.name))
        } else {
          list.sort((left, right) => (left.server ?? '').localeCompare(right.server ?? '')
            || left.name.localeCompare(right.name))
        }
        return list
      }
      // Hover text and badge data: called entries carry only names/counts, so
      // skills merge from the session catalog and tools/MCP from the wire-name
      // description map the host builds from its tool registry.
      const describe = e => e.description
        ?? (e.kind === 'skill' ? skillCatalog.get(e.name)?.description : undefined)
        ?? (e.kind === 'tool' ? toolInfoMap[e.name] : undefined)
        ?? (e.kind === 'mcp' ? toolInfoMap[`mcp__${e.server}__${e.name}`] : undefined)
      const sourceOf = e => e.source ?? (e.kind === 'skill' ? skillCatalog.get(e.name)?.source : undefined)
      const originKindOf = e => e.originKind ?? (e.kind === 'skill' ? skillCatalog.get(e.name)?.originKind : undefined)
      // The header search also targets the badge: typing 「其他」 keeps exactly
      // the cards wearing that badge. Both the visible label and the kind id
      // match, so `market` finds 市场 as well.
      const tagTextOf = e => {
        const merged = { ...e, source: sourceOf(e), originKind: originKindOf(e) }
        const badge = badgeOf(merged, originsMap, officialTools, serverAccess)
        const kind = kindOf(merged, originsMap, officialTools)
        // The owning package short name joins the search text too, so
        // `nwy-workflow` finds every card of that plugin.
        const pkg = pkgOf(merged, originsMap, officialTools, skillCatalog, serverAccess) ?? ''
        return `${badge?.label ?? ''} ${kind ?? ''} ${pkg}`.toLowerCase()
      }
      const usedSkillNames = new Set(byKind.skill.map(e => e.name))
      const skillEntries = showAll
        ? [...byKind.skill, ...availableSkills
            .filter(s => !usedSkillNames.has(s.name))
            .map(s => ({ kind: 'skill', name: s.name, count: 0, running: 0, lastTime: undefined, source: s.source, originKind: s.originKind, description: s.description }))]
        : byKind.skill
      // "Show all" also previews uncalled tools and MCP tools: the toolInfo
      // wire-name map enumerates every tool the session can call, so uncalled
      // ones join the grid with count 0. Same greedy `mcp__<server>__<name>`
      // split as the host's event folding.
      const usedToolNames = new Set(byKind.tool.map(e => e.name))
      const usedMcpKeys = new Set(byKind.mcp.map(e => `mcp__${e.server}__${e.name}`))
      const previewTools = []
      const previewMcp = []
      if (showAll) {
        for (const wire of Object.keys(toolInfoMap)) {
          const mcpMatch = /^mcp__(.+)__(.+)$/.exec(wire)
          if (mcpMatch !== null) {
            if (!usedMcpKeys.has(wire)) previewMcp.push({ kind: 'mcp', name: mcpMatch[2], server: mcpMatch[1], count: 0, running: 0, lastTime: undefined, description: toolInfoMap[wire] })
          } else if (!usedToolNames.has(wire)) {
            previewTools.push({ kind: 'tool', name: wire, count: 0, running: 0, lastTime: undefined, description: toolInfoMap[wire] })
          }
        }
      }
      const toolEntries = [...byKind.tool, ...previewTools]
      const mcpEntries = [...byKind.mcp, ...previewMcp]
      // The header search narrows every category by name, MCP server, or badge
      // text; the tab badges count the FILTERED lists so a badge always equals
      // the cards actually shown.
      const q = query.trim().toLowerCase()
      const matchesQuery = e => e.name.toLowerCase().includes(q)
        || (e.server || '').toLowerCase().includes(q)
        || tagTextOf(e).includes(q)
      const filtered = {
        skill: sortEntries(q ? skillEntries.filter(matchesQuery) : skillEntries),
        tool: sortEntries(q ? toolEntries.filter(matchesQuery) : toolEntries),
        mcp: sortMcp(q ? mcpEntries.filter(matchesQuery) : mcpEntries),
      }
      const shownAll = tab === 'all' ? [...filtered.skill, ...filtered.tool, ...filtered.mcp] : tab === 'skill' ? filtered.skill : tab === 'tool' ? filtered.tool : filtered.mcp
      const shown = shownAll

      let body
      if (error !== undefined) {
        body = h(State, { error: true, text: `加载失败：${error}\n请稍后点右上角刷新重试。` })
      } else if (data === undefined) {
        body = h(State, { text: '加载中…' })
      } else if (data.available === false) {
        body = h(State, { text: '该会话当前未驻留，\n暂不统计历史（冷）会话的调用记录。' })
      } else {
        // The filter tabs always stay visible, so an empty category (say MCP)
        // is just a blank grid — never a dead end that hides the tab bar.
        body = h(React.Fragment, null,
          h('div', { className: 'cmap-tabs' },
            TABS.map(t => {
              // The badge mirrors what the grid actually shows: card count
              // per category, including uncalled previews when "show all".
              const count = t.id === 'all' ? filtered.skill.length + filtered.tool.length + filtered.mcp.length : filtered[t.id].length
              return h('button', {
                key: t.id,
                className: `cmap-tab ${tab === t.id ? 'active' : ''}`,
                onClick: () => setTab(t.id),
              }, t.label, h('span', { className: 'cmap-tab-count' }, String(count)))
            }),
            // Sort mode rides the filter row's right edge: it orders whatever
            // the tabs and the search selected, so it belongs next to them.
            h('div', { className: 'cmap-sort', role: 'group', 'aria-label': '排序方式' },
              h('button', {
                className: sort === 'badge' ? 'active' : '',
                title: '按来源徽标排序：内置 → 项目 → 用户 → 本地 → Git → 市场 → 其他，同级按名称',
                onClick: () => setSort('badge'),
              }, '标签'),
              h('button', {
                className: sort === 'count' ? 'active' : '',
                title: '按本会话调用次数降序，次数相同再按徽标、名称',
                onClick: () => setSort('count'),
              }, '次数'))),
          shown.length > 0
            ? h('div', { className: 'cmap-grid' },
                shown.map(entry => h(CapabilityCard, {
                  key: `${entry.kind}:${entry.kind === 'mcp' ? `${entry.server}__${entry.name}` : entry.name}`,
                  entry: { ...entry, source: sourceOf(entry), originKind: originKindOf(entry) },
                  origins: originsMap,
                  officialTools,
                  skillCatalog,
                  serverAccess,
                  description: describe(entry),
                })))
            : null,
        )
      }

      return h('div', { className: 'cmap-root' },
        h('style', null, STYLE),
        h('div', { className: 'cmap-head' },
          h('div', { className: 'cmap-search' },
            ICON_SEARCH,
            h('input', {
              value: query,
              placeholder: '搜索能力或标签…',
              spellCheck: false,
              onChange: e => setQuery(e.target.value),
            }),
            query
              ? h('button', { className: 'cmap-search-clear', title: '清空搜索', onClick: () => setQuery('') }, '×')
              : null),
          h('button', {
            className: `cmap-toggle ${showAll ? 'active' : ''}`,
            title: showAll ? '只显示本会话调用过的能力' : '显示本会话可用的全部技能（未调用的计 0 次）',
            onClick: () => setShowAll(v => !v),
          }, showAll ? '仅本会话' : '显示全部'),
          h('button', {
            className: 'cmap-refresh',
            title: '立即刷新',
            onClick: () => { void refresh() },
            disabled: busy,
          }, ICON_REFRESH)),
        h('div', { className: 'cmap-scroll' }, body))
    }

    return {
      inject: ['slots', 'sidebarRightTabs'],
      apply(ctx) {
        ctx.effect(() => ctx.inject(['sidebarRightTabs'], (bag) => {
          const tabs = bag.get('sidebarRightTabs')
          if (tabs === undefined || typeof tabs.register !== 'function') return undefined
          const disposers = []
          // 1. The tab TYPE: a page tab (no patterns) opened by kind, with one
          //    guide entry (icon + description) that draws the card in the
          //    "+" add panel.
          disposers.push(tabs.register({
            id: KIND,
            kind: KIND,
            keepMounted: true,
            title: () => '能力地图',
            guide: [{
              id: 'capability-map',
              order: 120,
              title: () => '能力地图',
              description: () => '会话调用的技能与工具汇总，可预览全部本地可用技能',
              icon: guideIcon,
            }],
          }))
          // 2. The body slot under the same key.
          disposers.push(ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
            name: 'sidebar.right.pane.tab',
            key: KIND,
            inject: (sessionId) => ({ sessionId }),
          }, UsagePanel)))
          // 3. The title chip: the map glyph before the label, the same seat the
          //    built-in 文件/Git tabs draw their icons through. The seat supplies
          //    the useTabInfo hook; reading it can throw before the tab record is
          //    committed, so the label falls back to the static title.
          disposers.push(ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register(
            { name: 'sidebar.right.pane.tab.title', key: KIND },
            function MapTitle(props) {
              let label = '能力地图'
              try {
                const info = typeof props?.useTabInfo === 'function' ? props.useTabInfo() : undefined
                if (typeof info?.tab?.title === 'string' && info.tab.title) label = info.tab.title
              } catch { /* tab record not committed yet */ }
              return h(React.Fragment, null, guideIcon({ size: 13 }), label)
            })))
          return () => {
            for (const dispose of disposers) {
              try { dispose() } catch { /* releasing a partial registration */ }
            }
          }
        }), 'dsh-capability-map: capability-map tab registration')
      },
    }
  },
})
