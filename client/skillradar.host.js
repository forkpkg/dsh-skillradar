// SkillRadar Host (v4, pluginId radar-3)
// Functionality:
//   1. radar/scan  - List all skills visible in the current session and read recent session text. Scores relevance using mixed English tokenization, returning a ranked list of skills with hit keywords.
//                    score relevance using mixed Chinese/English tokenization, and return a ranked list of skills + hit keywords.
//   2. radar/load  - Read the full text of a single skill (for detail panel).
// Usage: Use as a dynamic Cordis plugin's code.host function body (returns a Cordis Plugin).
return {
    apply(ctx) {
        // Common stopwords (English, filtering high-frequency low-information words)
        const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'this', 'that', 'you', 'your', 'are', 'was', 'were', 'have', 'has', 'had', 'not', 'but', 'can', 'will', 'just', 'what', 'when', 'how', 'why', 'who', 'which', 'into', 'about', 'them', 'they', 'their', 'there', 'here', 'than', 'then', 'also', 'very', 'more', 'most', 'some', 'any', 'all', 'one', 'two', 'use', 'using', 'used', 'via', 'its', 'our', 'out', 'per', 'new', 'now', 'get', 'set', 'may', 'must', 'should', 'would', 'could', 'does', 'do', 'be', 'to', 'of', 'in', 'on', 'at', 'by', 'as', 'it', 'is', 'an', 'or', 'if']);

        function tokenize(text) {
            const out = {}
            const lower = String(text || '').toLowerCase()
            const words = lower.match(/[a-z][a-z0-9_-]{1,}/g) || []
            for (const w of words) {
                if (!STOP.has(w) && w.length > 1) out[w] = (out[w] || 0) + 1
            }
            const cjk = lower.match(/[\u4e00-\u9fff]+/g) || []
            for (const run of cjk) {
                for (let i = 0; i + 1 < run.length; i++) {
                    const big = run.slice(i, i + 2)
                    if (!STOP.has(big)) out[big] = (out[big] || 0) + 1
                }
                if (run.length === 1) out[run] = (out[run] || 0) + 1
            }
            return out
        }

        // Extracts the most recent text from the session's surface events (SessionEvent payload located at data.message)
        function textFromSurface(events) {
            const parts = []
            if (!Array.isArray(events)) return ''
            for (const ev of events) {
                if (!ev) continue
                if (ev.type !== 'user/message' && ev.type !== 'assistant/message') continue
                const content = ev.data && ev.data.message && ev.data.message.content
                if (!Array.isArray(content)) continue
                for (const block of content) {
                    if (block && block.type === 'text' && typeof block.text === 'string') parts.push(block.text)
                }
            }
            return parts.join('\n').slice(-8000)
        }

        async function scopeFor(sessionId) {
            const presets = ctx.get('agentPresets')
            if (!presets) return undefined
            try {
                if (sessionId) {
                    const agents = ctx.get('agents')
                    const agent = agents && agents.get(sessionId)
                    if (agent) {
                        const presetId = presets.composedPreset(agent.ctx)
                        if (presetId) return await presets.standingKeyFor(presetId)
                    }
                }
                return await presets.standingKeyFor()
            } catch (e) {
                return undefined
            }
        }

        harness.handle('radar/scan', async (args) => {
            const sessionId = args && typeof args.sessionId === 'string' ? args.sessionId : null
            const skills = ctx.get('skills')
            if (!skills) return {ok: false, error: 'skills service unavailable'}
            let summaries = []
            try {
                const scope = await scopeFor(sessionId)
                const list = scope ? await skills.list({scope}) : await skills.list()
                summaries = list || []
            } catch (e) {
                return {ok: false, error: String((e && e.message) || e)}
            }
            let conversationText = ''
            const q = ctx.get('sessionQuery')
            if (q && sessionId) {
                try {
                    const surface = await q.readSurface(sessionId)
                    conversationText = textFromSurface(surface && surface.events)
                } catch (e) {
                    conversationText = ''
                }
            }
            const conv = tokenize(conversationText)
            const totalConvTokens = Object.keys(conv).length
            const scored = summaries.map((s) => {
                const profile = tokenize([s.name, s.description, s.whenToUse || ''].join(' '))
                let raw = 0
                const hitMap = {}
                for (const tok of Object.keys(profile)) {
                    const count = conv[tok] || 0
                    if (count > 0) {
                        const isEnglish = /[a-z]/.test(tok)
                        const weight = tok.length >= 3 ? 2 : tok.length === 2 && !isEnglish ? 1.5 : 0.6
                        raw += weight * Math.min(count, 3)
                        hitMap[tok] = count
                    }
                }
                const hits = Object.keys(hitMap).sort((a, b) => hitMap[b] - hitMap[a]).slice(0, 5).map((token) => ({token, count: hitMap[token]}))
                const denom = Math.max(1, Math.min(totalConvTokens, 60))
                const score = Math.round(Math.min(100, (raw / denom) * 140))
                return {
                    name: s.name,
                    description: s.description || '',
                    whenToUse: s.whenToUse || '',
                    score,
                    hits,
                }
            })
            scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
            return {
                ok: true,
                sessionId,
                skills: scored,
                total: scored.length,
                hasConversation: conversationText.trim().length > 0,
            }
        })

        harness.handle('radar/load', async (args) => {
            const name = args && typeof args.name === 'string' ? args.name : ''
            if (!name) return {ok: false, error: 'Missing skill name'}
            const skills = ctx.get('skills')
            if (!skills) return {ok: false, error: 'skills service unavailable'}
            try {
                const scope = await scopeFor(null)
                const def = scope ? await skills.get(name, {scope}) : await skills.get(name)
                if (!def) return {ok: false, error: 'No skill found ' + name}
                return {
                    ok: true,
                    name: def.name,
                    description: def.description || '',
                    whenToUse: def.whenToUse || '',
                    content: String(def.content || '').slice(0, 4000),
                }
            } catch (e) {
                return {ok: false, error: String((e && e.message) || e)}
            }
        })
    },
}
