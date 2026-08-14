# dsh-skillradar 🎯

> 技能雷达:让 DeepSeek Harness 的 AI 知道"当前最该加载哪个技能"。

[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

## 📖 项目简介

dsh-skillradar 是 [DeepSeek Harness (dsh)](https://github.com/deepseek-ai/deepseek-harness) 的插件。
它会扫描当前会话可见的全部 skills(技能),读取最近对话文本,用中英文分词计算每个技能与当前任务的相关性分数,并返回排序后的推荐列表。

**解决什么问题**:DSH 里技能很多,模型/用户常常不知道某个技能存在、或者不知道该用哪个。技能雷达把"哪些技能可用 + 哪些最贴合当前任务"变成一次调用就能看到的结果。

## ✨ 功能特性

- ✅ 扫描当前会话可见的全部技能(含 preset 层技能,`skills.list({ scope })`)
- 🧮 相关性打分:英文单词 + 中文双字窗口分词,特异性词加权、停用词过滤,0–100 分
- 🔍 命中关键词回显:每个技能显示"因为哪几个词匹配了当前对话"
- 📊 排序推荐:分数从高到低,一眼看出最该加载哪个技能
- 🚀 一行安装、纯 JS 零构建、无网络依赖

## 🚀 快速开始(傻瓜式三步)

**环境要求**:已安装 dsh CLI(任意版本),Node.js 18+

1. 下载项目:

   ```bash
   git clone https://github.com/hellosky983/dsh-skillradar.git
   ```

2. 安装到你的 dsh profile(把 `web` 换成你的 profile 名):

   ```bash
   cd dsh-skillradar
   dsh plugin --profile web add .
   ```

3. 重启 dsh,然后直接对 AI 说:

   > "扫描一下当前有哪些技能适合这个任务"

   或让 AI 调用 `skill_radar` 工具,返回结果示例:

   ```
   Skill Radar — 16 skills visible
     100%  github-upload [github, 仓库, readme, 上传]
          when: 把 AI 辅助制作的东西一键上传到 GitHub
      85%  cordis-plugin-development [client, host, cordis, run]
      35%  math-clever [有没, 使用, 简单]
   ```

## 📖 使用说明

`skill_radar` 工具参数:

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `session_id` | string | 可选。扫描指定会话;省略则自动扫描当前会话 |
| `limit` | integer | 可选。最多返回几个技能(默认 15) |

返回字段:`skills[]` 数组,每项包含 `name` / `description` / `whenToUse` / `score`(0–100)/ `hits`(命中关键词)。

**交互式雷达面板**:本仓库 `client/` 目录下附带了完整的雷达 UI 面板源码(`skillradar.client.js` + `skillradar.host.js`,动态 Cordis 插件形态)——会话头部出现"🎯 技能雷达"按钮,点开是全屏雷达图:技能圆点按相关性分布、越靠近中心越相关,支持搜索、技能详情(SKILL.md 正文)、一键载入到输入框、面板拖拽缩放。用 `cordis_define` 加载即可体验完整 UI。

## 📁 项目结构

```
dsh-skillradar/
├── index.js              # 插件主体:扫描 + 打分 + 注册 skill_radar 工具
├── cordis.patch.yml      # 插件安装清单(插入到 dsh composition)
├── package.json          # bundle 声明(dsh.bundle)
├── client/
│   ├── skillradar.host.js   # 动态插件 Host 半(雷达 RPC + 打分)
│   └── skillradar.client.js # 动态插件 Client 半(雷达 UI 面板)
└── README.md
```

## ❓ 常见问题(FAQ)

- **Q:安装后 AI 不会主动调用这个工具?**
  A:工具注册后模型会自动看到;你也可以主动说"用技能雷达看看现在该加载哪个技能"。

- **Q:分数是怎么算的?**
  A:把技能名 + 描述 + 适用场景分词,和最近 8000 字符的对话文本做重叠统计;英文长词权重更高,通用词(停用词)被过滤,避免所有技能都拿高分。

- **Q:能商用吗?**
  A:能,MIT 协议,随便用。

## 🛠️ 技术栈

纯 JavaScript(ESM)· 零依赖 · [@deepseek-ai/dsh-tools](https://www.npmjs.com/package/@deepseek-ai/dsh-tools) · 标准 Cordis API

## 📄 许可证

MIT © hellosky983
