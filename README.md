# dsh-skillradar

Scans the skills visible to the current DeepSeek Harness session, scores each against the recent conversation (English + Chinese token overlap), and returns a ranked recommendation of which skill to load next. Provides the `skill_radar` model tool; the `client/` directory holds the optional interactive radar panel (dynamic Cordis plugin).

Install: `dsh plugin add github:hellosky983/dsh-skillradar`
