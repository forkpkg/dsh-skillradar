import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'skillradar'

export const inject = ['tools']

// ============================================================
// SkillRadar - DeepSeek Harness plugin that scans every skill visible to the current session, scores each against the recent conversation text (English + Chinese token overlap), and returns a ranked recommendation of which skill to load next.
// The model can call the skill_radar tool to get "which skill should be loaded next".
// ============================================================

// ---- stop words (Chinese-English mix, filtering high-frequency meaningless words) ----
const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'this', 'that', 'you', 'your', 'are', 'was', 'were', 'have', 'has', 'had', 'not', 'but', 'can', 'will', 'just', 'what', 'when', 'how', 'why', 'who', 'which', 'into', 'about', 'them', 'they', 'their', 'there', 'here', 'than', 'then', 'also', 'very', 'more', 'most', 'some', 'any', 'all', 'one', 'two', 'use', 'using', 'used', 'via', 'its', 'our', 'out', 'per', 'new', 'now', 'get', 'set', 'may', 'must', 'should', 'would', 'could', 'does', 'do', 'be', 'to', 'of', 'in', 'on', 'at', 'by', 'as', 'it', 'is', 'an', 'or', 'if']);

/**
 * Tokenizes text by finding English words and handling Chinese characters using a two-character sliding window.
 */
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

/**
 * Extracts the most recent text from the session's surface events (payload located at data.message).
 */
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

/**
 * Resolves the standing scope key for the current session's preset.
 * This ensures that skills listing considers the context of the current runtime.
 */
async function scopeFor(ctx, sessionId) {
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

/** Core scanning + scoring */
async function scanSkills(ctx, sessionId) {
  const skills = ctx.get('skills')
  if (!skills) throw new Error('skills service unavailable')

  let summaries = []
  const scope = await scopeFor(ctx, sessionId)
  const list = scope ? await skills.list({ scope }) : await skills.list()
  summaries = list || []

  // Conversation text: prioritize readSurface; fallback to empty text on failure
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
    const hits = Object.keys(hitMap)
      .sort((a, b) => hitMap[b] - hitMap[a])
      .slice(0, 5)
      .map((token) => ({ token, count: hitMap[token] }))
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
    sessionId,
    total: scored.length,
    hasConversation: conversationText.trim().length > 0,
    skills: scored,
  }
}

export function apply(ctx) {
  ctx.tools.register(defineTool({
    name: 'skill_radar',
    description:
      'Skill Radar: scan every skill visible to the current session, score each against the recent conversation ' +
      'text (English + Chinese token overlap), and return a ranked recommendation of which skill to load next. ' +
      'Use this when you suspect a skill exists for the current task, when the user asks what you can do, ' +
      'or before starting a task that a skill might cover (math, design, testing, bilibili, GitHub upload, ...). ' +
      'Optionally pass session_id to scan another session; omit it to scan the current one. ' +
      'Each result carries name, description, whenToUse, a 0-100 relevance score, and the hit keywords that matched.',
    parameters: {
      session_id: {
        type: 'string',
        description: 'Optional session id to scan. Omit to scan the current session automatically.',
      },
      limit: {
        type: 'integer',
        description: 'Optional max number of skills to return (default 15).',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean' },
          sessionId: { type: 'string' },
          total: { type: 'integer' },
          hasConversation: { type: 'boolean' },
          skills: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                whenToUse: { type: 'string' },
                score: { type: 'integer' },
                hits: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      token: { type: 'string' },
                      count: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
          error: { type: 'string' },
        },
      },
      render: function (args, value) {
        if (!value.ok) return [{ type: 'text', text: 'skill_radar error: ' + value.error }]
        if (value.total === 0) return [{ type: 'text', text: 'No skills are visible in this session.' }]
        const lines = [`Skill Radar - ${value.total} skills visible` + (value.hasConversation ? '' : ' (no conversation text yet)')]
        for (const sk of value.skills.slice(0, args.limit || 15)) {
          const hitText = sk.hits && sk.hits.length > 0 ? ' [' + sk.hits.map((h) => h.token).join(', ') + ']' : ''
          lines.push(`  ${sk.score}%  ${sk.name}${hitText}`)
          if (sk.whenToUse) lines.push(`       when: ${sk.whenToUse.slice(0, 100)}`)
        }
        return [{ type: 'text', text: lines.join('\n') }]
      },
    },
    execute: async function (args) {
      try {
        let sessionId = args && typeof args.session_id === 'string' && args.session_id ? args.session_id : null
        if (!sessionId) {
          const agents = ctx.get('agents')
          const agent = agents && agents.currentInitiator()
          sessionId = agent ? agent.id : null
        }
        const result = await scanSkills(ctx, sessionId)
        return { ok: true, ...result }
      } catch (e) {
        return { ok: false, sessionId: null, total: 0, hasConversation: false, skills: [], error: String((e && e.message) || e) }
      }
    },
  }))
}
