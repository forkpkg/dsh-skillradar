// SkillRadar Client Agent - Client side wrapper (v5, pluginId radar-3)
// v5 fixes (based on user feedback):
// 1. State management fix: force functional updates (x => x + 1) to prevent React from skipping setState calls when the value doesn't change, which previously prevented the panel from closing.
// 2. Button styling fix: hard-coded colors (#4a7dff) for primary buttons/dots, as theme variables are unreliable in light mode.
// 3. Radar scale increase (340px), percentage positioning for dots, and max-width/ellipsis for name tags to prevent overflow.
// 4. Detail panel moved below the radar, above the list for better flow.
// 5. One-click loading now only uses setDraft and does not submit, removing the "only fill input" button.
// 6. Panel resize: both sides support mouse drag scaling.
// Functionality: "Skill Radar" button in the conversation header + full-screen overlay radar panel (relevance distribution / list / search / details / load).
return {
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return
    styles.insert(`
.sr-panel {
  position: fixed; top: 64px; right: 20px; z-index: 9999;
  width: 620px; min-width: 420px; min-height: 340px;
  max-width: calc(100vw - 40px); max-height: calc(100vh - 96px);
  display: flex; flex-direction: column;
  background: var(--dsw-alias-bg-overlay, #20242f);
  color: var(--dsw-alias-label-primary, #e8eaf0);
  border: 1px solid var(--dsw-alias-border-l2, #3a4154);
  border-radius: 14px;
  box-shadow: 0 16px 48px rgba(0,0,0,0.4);
  overflow: hidden;
  resize: both;
  font-size: 13px; line-height: 1.5;
  pointer-events: auto;
}
.sr-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--dsw-alias-border-l1, #2c3140); }
.sr-title { font-weight: 700; font-size: 14px; }
.sr-sub { color: var(--dsw-alias-label-secondary, #9aa1b5); font-size: 11px; margin-top: 2px; }
.sr-close { background: transparent; border: none; color: var(--dsw-alias-label-secondary, #9aa1b5); cursor: pointer; font-size: 15px; padding: 2px 8px; border-radius: 6px; }
.sr-close:hover { background: var(--dsw-alias-bg-layer-1, #2a2f40); color: var(--dsw-alias-label-primary, #e8eaf0); }
.sr-toolbar { display: flex; gap: 8px; padding: 10px 16px 0; }
.sr-search { flex: 1; background: var(--dsw-alias-bg-layer-1, #2a2f40); color: var(--dsw-alias-label-primary, #e8eaf0); border: 1px solid var(--dsw-alias-border-l1, #2c3140); border-radius: 8px; padding: 6px 10px; font-size: 12px; outline: none; }
.sr-search:focus { border-color: #4a7dff; }
.sr-refresh { background: var(--dsw-alias-bg-layer-1, #2a2f40); color: var(--dsw-alias-label-secondary, #9aa1b5); border: 1px solid var(--dsw-alias-border-l1, #2c3140); border-radius: 8px; padding: 6px 12px; font-size: 12px; cursor: pointer; }
.sr-refresh:hover { color: var(--dsw-alias-label-primary, #e8eaf0); }
.sr-body { flex: 1; overflow-y: auto; padding: 10px 16px 14px; }
.sr-status { color: var(--dsw-alias-label-secondary, #9aa1b5); font-size: 12px; padding: 8px 0; }
.sr-error { color: var(--dsw-alias-state-error-primary, #ff6b6b); font-size: 12px; padding: 8px 0; }
.sr-radar { position: relative; width: 100%; height: 340px; margin: 4px 0 12px; }
.sr-radar-core { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 90px; height: 90px; border-radius: 50%; background: radial-gradient(circle, #4a7dff 0%, transparent 75%); opacity: 0.35; pointer-events: none; }
.sr-dot { position: absolute; transform: translate(-50%, -50%); border-radius: 50%; background: #4a7dff; cursor: pointer; border: 2px solid var(--dsw-alias-bg-overlay, #20242f); transition: transform 0.12s ease, box-shadow 0.12s ease; }
.sr-dot:hover { transform: translate(-50%, -50%) scale(1.35); box-shadow: 0 0 10px #4a7dff; }
.sr-dot.sel { box-shadow: 0 0 0 2px var(--dsw-alias-state-warn-primary, #f0b34f); }
.sr-dot-label { position: absolute; left: 50%; top: calc(100% + 4px); transform: translateX(-50%); font-size: 10px; color: var(--dsw-alias-label-secondary, #9aa1b5); white-space: nowrap; max-width: 120px; overflow: hidden; text-overflow: ellipsis; pointer-events: none; }
.sr-detail { margin: 0 0 10px; padding: 12px; border: 1px solid #4a7dff; border-radius: 10px; background: var(--dsw-alias-bg-layer-1, #2a2f40); }
.sr-detail-name { font-weight: 700; font-size: 13px; margin-bottom: 4px; }
.sr-detail-when { font-size: 11.5px; color: var(--dsw-alias-label-secondary, #9aa1b5); margin-bottom: 6px; }
.sr-detail-content { font-size: 11.5px; color: var(--dsw-alias-label-secondary, #9aa1b5); white-space: pre-wrap; max-height: 180px; overflow-y: auto; background: var(--dsw-alias-bg-layer-2, #242838); border-radius: 8px; padding: 8px; margin-top: 6px; }
.sr-detail-actions { display: flex; gap: 8px; margin-top: 10px; }
.sr-list { display: flex; flex-direction: column; gap: 6px; }
.sr-row { display: flex; align-items: center; gap: 10px; padding: 7px 10px; border: 1px solid var(--dsw-alias-border-l1, #2c3140); border-radius: 9px; cursor: pointer; background: var(--dsw-alias-bg-layer-1, #2a2f40); }
.sr-row:hover { border-color: #4a7dff; }
.sr-row.sel { border-color: #4a7dff; background: var(--dsw-alias-bg-layer-2, #242838); }
.sr-rank { font-size: 11px; color: var(--dsw-alias-label-secondary, #9aa1b5); min-width: 20px; text-align: right; }
.sr-score { min-width: 40px; text-align: center; font-size: 11px; font-weight: 600; color: var(--dsw-alias-state-success-primary, #3ddc97); }
.sr-row-main { flex: 1; min-width: 0; }
.sr-row-name { font-weight: 600; font-size: 12.5px; }
.sr-row-desc { color: var(--dsw-alias-label-secondary, #9aa1b5); font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sr-hits { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px; }
.sr-hit { font-size: 10px; color: var(--dsw-alias-state-warn-primary, #f0b34f); background: var(--dsw-alias-bg-layer-2, #242838); padding: 1px 6px; border-radius: 999px; }
.sr-load { background: #4a7dff; color: #ffffff; border: none; border-radius: 7px; padding: 5px 12px; font-size: 12px; cursor: pointer; white-space: nowrap; }
.sr-load:hover { filter: brightness(1.1); }
.sr-btn { border-radius: 8px; padding: 7px 14px; font-size: 12px; cursor: pointer; border: 1px solid var(--dsw-alias-border-l1, #2c3140); background: var(--dsw-alias-bg-layer-2, #242838); color: var(--dsw-alias-label-primary, #e8eaf0); }
.sr-btn:hover { border-color: #4a7dff; }
.sr-btn-primary { background: #4a7dff; color: #fff; border: none; }
.sr-empty { color: var(--dsw-alias-label-secondary, #9aa1b5); font-size: 12px; text-align: center; padding: 24px 0; }
.sr-foot { padding: 8px 16px 12px; border-top: 1px solid var(--dsw-alias-border-l1, #2c3140); color: var(--dsw-alias-label-secondary, #9aa1b5); font-size: 11px; display: flex; justify-content: space-between; }
`)

    const radarState = {
      open: false,
      sessionId: null,
      inputActions: null,
    }
    const listeners = new Set()
    const emit = () => listeners.forEach((fn) => fn())
    // Key fix: force must use functional updates (x => x + 1),
    // calling setState directly in the second emit when the value doesn't change is skipped by React, preventing the panel from closing
    const useRadar = () => {
      const [, force] = React.useState(0)
      React.useEffect(() => {
        const bump = () => force((x) => x + 1)
        listeners.add(bump)
        return () => listeners.delete(bump)
      }, [])
      return radarState.open
    }

    slots.inject('conversation.session.header.actions', () => slots.register(
      { name: 'conversation.session.header.actions', id: 'skill-radar', order: 25 },
      (props) => {
        const isOpen = useRadar()
        return React.createElement(
          'button',
          {
            onClick: () => {
              radarState.sessionId = props.sessionId || null
              radarState.inputActions = props.inputActions || null
              radarState.open = !radarState.open
              emit()
            },
            title: 'Skill Radar: Recommended skills based on current dialogue, one-click load',
            style: {
              background: isOpen ? '#4a7dff' : 'transparent',
              color: isOpen ? '#ffffff' : 'var(--dsw-alias-label-secondary, #9aa1b5)',
              border: '1px solid var(--dsw-alias-border-l1, #2c3140)',
              borderRadius: 8, padding: '5px 10px', fontSize: 12, cursor: 'pointer',
            },
          },
          'Skill Radar',
        )
      },
    ))

    slots.inject('shell.overlay', () => slots.register(
      { name: 'shell.overlay', id: 'skill-radar-panel', order: 50 },
      () => {
        const isOpen = useRadar()
        const sessionId = radarState.sessionId
        const inputActions = radarState.inputActions
        const [state, setState] = React.useState({ phase: 'idle', skills: [], error: null, selected: null, detail: null, query: '' })
        const scan = React.useCallback(() => {
          if (!sessionId) return
          setState((s) => ({ ...s, phase: 'loading', error: null }))
          host.call('radar/scan', { sessionId }).then((res) => {
            if (res && res.ok) setState((s) => ({ ...s, phase: 'ready', skills: res.skills || [] }))
            else setState((s) => ({ ...s, phase: 'error', error: (res && res.error) || 'scan failed' }))
          }).catch((e) => setState((s) => ({ ...s, phase: 'error', error: String((e && e.message) || e) })))
        }, [sessionId])
        React.useEffect(() => {
          if (isOpen) scan()
        }, [isOpen, scan])
        if (!isOpen) return null
        const { phase, skills, error, selected, detail, query } = state
        const filtered = skills.filter((sk) => {
          if (!query) return true
          const q = query.toLowerCase()
          return sk.name.toLowerCase().includes(q) || (sk.description || '').toLowerCase().includes(q)
        })
        const openDetail = (name) => {
          setState((s) => ({ ...s, selected: name, detail: null }))
          host.call('radar/load', { name }).then((res) => {
            setState((s) => (s.selected === name ? { ...s, detail: res && res.ok ? res : { error: (res && res.error) || 'Read failed' } } : s))
          }).catch((e) => {
            setState((s) => (s.selected === name ? { ...s, detail: { error: String((e && e.message) || e) } } : s))
          })
        }
        // Radar coordinates: Percentage positioning, ensuring dots and labels fit within the bounds.
        const radarDots = filtered.slice(0, 30).map((sk, i) => {
          const angle = (i / Math.max(1, filtered.length)) * Math.PI * 2 - Math.PI / 2
          const dist = 37 - (sk.score / 100) * 27
          const size = 8 + (sk.score / 100) * 10
          return React.createElement('div', {
            key: sk.name,
            className: 'sr-dot' + (selected === sk.name ? ' sel' : ''),
            onClick: () => openDetail(sk.name),
            title: sk.name + ' (' + sk.score + '%)',
            style: {
              left: (50 + Math.cos(angle) * dist) + '%',
              top: (50 + Math.sin(angle) * dist) + '%',
              width: size, height: size,
            },
          }, React.createElement('div', { className: 'sr-dot-label' }, sk.name))
        })
        const rows = filtered.map((sk, i) => React.createElement(
          'div',
          { key: sk.name, className: 'sr-row' + (selected === sk.name ? ' sel' : ''), onClick: () => openDetail(sk.name) },
          React.createElement('div', { className: 'sr-rank' }, String(i + 1)),
          React.createElement('div', { className: 'sr-score' }, sk.score + '%'),
          React.createElement('div', { className: 'sr-row-main' },
            React.createElement('div', { className: 'sr-row-name' }, sk.name),
            React.createElement('div', { className: 'sr-row-desc' }, sk.description),
            sk.hits && sk.hits.length > 0
              ? React.createElement('div', { className: 'sr-hits' }, sk.hits.map((h) => React.createElement('span', { key: h.token, className: 'sr-hit' }, h.token)))
              : null,
          ),
          React.createElement('button', {
            className: 'sr-load',
            onClick: (e) => {
              e.stopPropagation()
              openDetail(sk.name)
            },
          }, 'Details'),
        ))
        // Detail view placed below the radar and above the list for easier viewing.
        const detailView = selected
          ? React.createElement('div', { className: 'sr-detail' },
              React.createElement('div', { className: 'sr-detail-name' }, 'Skill: ' + selected),
              detail && detail.error
                ? React.createElement('div', { className: 'sr-error' }, detail.error)
                : detail && React.createElement(React.Fragment, null,
                    React.createElement('div', { className: 'sr-detail-when' }, detail.whenToUse || detail.description || ''),
                    detail.content ? React.createElement('div', { className: 'sr-detail-content' }, detail.content) : null,
                    React.createElement('div', { className: 'sr-detail-actions' },
                      React.createElement('button', {
                        className: 'sr-btn sr-btn-primary',
                        onClick: () => {
                          if (!inputActions) return
                          inputActions.setDraft('Load skill ' + selected + ' and continue according to its instructions')
                        },
                      }, 'Load into input box'),
                    ),
                  ),
            )
          : null
        return React.createElement('div', { className: 'sr-panel' },
          React.createElement('div', { className: 'sr-head' },
            React.createElement('div', null,
              React.createElement('div', { className: 'sr-title' }, 'Skill Radar'),
              React.createElement('div', { className: 'sr-sub' }, 'Visible in current session ' + skills.length + ' skills - Closer to center is more relevant - Drag to zoom at bottom right'),
            ),
            React.createElement('button', { className: 'sr-close', onClick: () => { radarState.open = false; emit() } }, 'X'),
          ),
          React.createElement('div', { className: 'sr-toolbar' },
            React.createElement('input', {
              className: 'sr-search',
              placeholder: 'Search skills...',
              value: query,
              onChange: (e) => setState((s) => ({ ...s, query: e.target.value })),
            }),
            React.createElement('button', { className: 'sr-refresh', onClick: scan }, 'Refresh'),
          ),
          React.createElement('div', { className: 'sr-body' },
            phase === 'loading' ? React.createElement('div', { className: 'sr-status' }, 'Loading...') :
            phase === 'error' ? React.createElement('div', { className: 'sr-error' }, 'Scan failed: ' + error) :
            skills.length === 0 ? React.createElement('div', { className: 'sr-empty' }, 'No usable skills found in this session.') :
            React.createElement(React.Fragment, null,
              React.createElement('div', { className: 'sr-radar' },
                React.createElement('div', { className: 'sr-radar-core' }),
                ...radarDots,
              ),
              detailView,
              React.createElement('div', { className: 'sr-list' }, ...rows),
            ),
          ),
          React.createElement('div', { className: 'sr-foot' },
            React.createElement('span', null, 'Click skill to view details, load into input box, then press Enter to send'),
            React.createElement('span', null, 'SkillRadar'),
          ),
        )
      },
    ))
  },
}
