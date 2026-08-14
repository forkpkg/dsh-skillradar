// SkillRadar 技能雷达 — Host 半 (v4, pluginId radar-3)
// 功能:
//   1. radar/scan  — 列出当前会话可见的全部 skills,读取会话最近文本,
//                    用中英文分词做相关性打分,返回按分数排序的技能列表 + 命中关键词
//   2. radar/load  — 读取单个技能的完整正文(详情面板用)
// 用法: 作为动态 Cordis 插件的 code.host 函数体使用(return 一个 Cordis Plugin)
return {
  apply(ctx) {
    // 通用停用词(中英混合,过滤高频无信息量词)
    const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'this', 'that', 'you', 'your', 'are', 'was', 'were', 'have', 'has', 'had', 'not', 'but', 'can', 'will', 'just', 'what', 'when', 'how', 'why', 'who', 'which', 'into', 'about', 'them', 'they', 'their', 'there', 'here', 'than', 'then', 'also', 'very', 'more', 'most', 'some', 'any', 'all', 'one', 'two', 'use', 'using', 'used', 'via', 'its', 'our', 'out', 'per', 'new', 'now', 'get', 'set', 'may', 'must', 'should', 'would', 'could', 'does', 'do', 'be', 'to', 'of', 'in', 'on', 'at', 'by', 'as', 'it', 'is', 'an', 'or', 'if', '请', '把', '帮', '给', '这', '那', '个', '一', '和', '的', '了', '在', '我', '你', '他', '它', '是', '不', '有', '就', '都', '也', '还', '要', '会', '能', '想', '让', '用', '做', '写', '说', '看', '去', '直接', '这个', '那个', '什么', '怎么', '可以', '需要', '没有', '一个', '一句', '完整', '生成', '做成', '自动', '我们', '你们', '他们'])
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

    // 从会话表面事件提取最近文本(SessionEvent 载荷在 data.message)
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
      if (!skills) return { ok: false, error: 'skills 服务不可用' }
      let summaries = []
      try {
        const scope = await scopeFor(sessionId)
        const list = scope ? await skills.list({ scope }) : await skills.list()
        summaries = list || []
      } catch (e) {
        return { ok: false, error: String((e && e.message) || e) }
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
        const hits = Object.keys(hitMap).sort((a, b) => hitMap[b] - hitMap[a]).slice(0, 5).map((token) => ({ token, count: hitMap[token] }))
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
      if (!name) return { ok: false, error: '缺少技能名' }
      const skills = ctx.get('skills')
      if (!skills) return { ok: false, error: 'skills 服务不可用' }
      try {
        const scope = await scopeFor(null)
        const def = scope ? await skills.get(name, { scope }) : await skills.get(name)
        if (!def) return { ok: false, error: '未找到技能 ' + name }
        return {
          ok: true,
          name: def.name,
          description: def.description || '',
          whenToUse: def.whenToUse || '',
          content: String(def.content || '').slice(0, 4000),
        }
      } catch (e) {
        return { ok: false, error: String((e && e.message) || e) }
      }
    })
  },
}
