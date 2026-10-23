# Evose Skills

把本地编码助手操作 Evose 的经验、导航脚本和交互评测方法装到新电脑。用于管理 Agent、Workflow、Skill、计划、IM 接入与真实运行验收。

## 一句话安装提示词

复制下面这句话给 Codex 或其他能执行本地命令的编码助手：

> 请帮我在本地安装 Evose Skills：先检查 Node.js ≥22.20 和 Git（已安装则跳过），检查 ego lite 及 `ego-browser`（缺少时从 https://lite.ego.app/ 安装，首次引导由我完成），然后执行 `npx --yes skills@1.7.4 add GarySus/evose-skills --skill evose-platform-manager evose-agent-interaction -a codex -g -y --copy`，安装后完整读取 `ego-browser skill` 的输出并验证两个 Skill 已安装；Evose 登录由我在浏览器完成。

这条提示词面向支持终端和本地 Skill 的助手。首次 ego lite 引导与网站登录需要用户完成；仅运行 Skill 命令不会安装浏览器或自动登录。

## 手动安装

### 1. 检查运行环境

```bash
node --version  # 需要 >=22.20.0，建议当前 Node LTS
npm --version
git --version
```

Node 自带 npm/npx。缺少时从 [Node.js 官方](https://nodejs.org/)安装，Git 从[官方安装指引](https://git-scm.com/downloads)安装。

从 [ego lite 官方网站](https://lite.ego.app/)安装浏览器并完成首次引导。`ego-browser` 由该应用提供，不是本仓库或同名 npm 包。已有可用版本直接跳过。

```bash
ego-browser skill
```

完整 guide 应包含结束标记 `[ego-browser:skill] end of guide`。macOS 找不到命令时，先确认首次引导已完成，并在当前终端加入 `export PATH="$HOME/.local/bin:$PATH"` 后重试。Windows 安装后重开终端。上游网站抓取可能只返回错误页，下载入口以用户正常打开的官方网站为准，不使用仓库内固化的旧安装包地址。

### 2. 安装两个 Skill

```bash
npx --yes skills@1.7.4 add GarySus/evose-skills --skill evose-platform-manager evose-agent-interaction -a codex -g -y --copy
```

安装器使用成熟的 [Vercel Labs Skills CLI](https://github.com/vercel-labs/skills)，固定为已核对的 `1.7.4`，无需发布本项目到 npm。`-g` 表示用户级安装，`-a codex` 选择 Codex，`--copy` 保留独立可编辑文件；`-y` 会跳过确认并可能覆盖同名 Skill，升级前备份本地修订。首次安装后重新打开会话，让助手发现技能。

Claude Code 将 `-a codex` 换成 `-a claude-code`；要安装到全部受支持的助手：

```bash
npx --yes skills@1.7.4 add GarySus/evose-skills --skill evose-platform-manager evose-agent-interaction --agent '*' -g -y --copy
```

安装器支持多个客户端，不等于本包已逐一完成运行兼容测试。本包最初面向 Codex + ego lite；其他客户端须具备本地终端/文件能力并遵守 ego 当前 guide。

### 3. 验证与开始使用

```bash
npx --yes skills@1.7.4 list -g -a codex
ego-browser nodejs -e "console.log('ego-browser ready')"
```

确认列表里有 `evose-platform-manager` 与 `evose-agent-interaction`。在 ego lite 正常登录 Evose，再对助手说：

> 使用 evose-platform-manager，打开我提供的 Evose 工作空间链接，先核对当前 Agent、Workflow 和 Skill，不修改配置。

私有部署须提供实际URL，不内置工作空间或资源ID。默认导航白名单为 `https://app.evose.ai`，其他域名在 `ego-browser nodejs` 的脚本中、首次导入助手前显式设置：

```js
process.env.EVOSE_ORIGINS = 'https://your-evose.example.com';
// 再动态 import 本次安装目录中的 navigation.mjs / learning.mjs。
```

将示例域名替换为经核对的实际 HTTPS origin。ego Node 不继承终端环境变量；每次新进程都在脚本中写明本轮配置。助手不自动读取 `.env`。

## 包含什么

| 内容 | 用途 |
|---|---|
| `evose-platform-manager` | 平台操作、提示词结构、版本/挂载、计划、IM、观测与验收 |
| `navigation.mjs` | 从真实ID或完整名称导航、节点定位、提示词本地导出 |
| `learning.mjs` | 首次定位后学习，按部署/空间/资源隔离，使用前再核验 |
| `evose-agent-interaction` | 自然语言交互、返工连续性、可见成品、失败恢复与评测 |

本包安装在本地助手。历史 Evose 云端 Skill 仅承载 Markdown，不能将这里的执行脚本直接上传后当作云端工具。安装本包不会创建或修改线上 Agent、计划、机器人或业务数据。

## 依赖与按需扩展

| 依赖 | 要求 | 安装方式 |
|---|---|---|
| Node.js / npm / Git | Node ≥22.20；供安装器和本地检查使用 | 平台原生安装或官网 |
| Skills CLI | `1.7.4`，安装工具，不是业务运行依赖 | 上述 npx 命令；开发时由锁文件安装 |
| ego lite / ego-browser Skill | 本机当前版本，必须能完整输出 guide | 官网安装并完成引导，由应用管理 |
| Evose账号 | 可访问目标工作空间与实际操作所需权限 | 浏览器正常登录 |
| Lark CLI / Lark专用Skill | 仅需直接操作飞书或独立读回时安装 | 使用对应官方安装指引 |

飞书云端工具连接与本机CLI授权互不替代。不捆绑 `lark-*`、浏览器驱动、REA、营销业务Skill、会议纪要Skill或Agent内核；平台管理不必预装这些业务工具。需要时由目标任务选择并安装，避免把个人整套工具目录复制给别人。详见[抽离范围与依赖说明](docs/extraction.md)。

## 定位数据与升级

定位经验保存在 `${XDG_DATA_HOME:-~/.local/share}/evose-skills/locations.jsonl`，不会写进安装目录。可在首次导入前设置 `process.env.EVOSE_LEARNING_STORE` 为自选绝对路径；ego运行时未配置XDG目录则使用系统用户主目录下的 `.local/share`。该文件可能含私人资源名和ID，应保留在本机。

重复执行原安装命令即可升级仓库当前默认分支的两个Skill；本地知识文档修订会被替换，先备份。定位数据独立存储，升级保留。要固定某次内容，从 GitHub 的指定 tag/commit tree URL安装；安装器的来源格式见[官方命令参考](https://github.com/vercel-labs/skills/blob/v1.7.4/docs/commands.md#source-formats)。

旧版位于 Skill 内的 `learned/locations.jsonl` 不自动迁移；检查来源后复制到新位置，已有目标先备份。不要将原作者项目的记录带到其他工作空间。

卸载Skill：

```bash
npx --yes skills@1.7.4 remove evose-platform-manager evose-agent-interaction -a codex -g -y
```

卸载不清理独立学习记录，也不删除浏览器、登录状态或线上资源。

## 本地开发与检查

```bash
git clone https://github.com/GarySus/evose-skills.git
cd evose-skills
npm ci --ignore-scripts
npm test
npm run test:install
npm run doctor
```

`npm test` 检查本地引用、公开文件边界、导航与学习机制。`test:install` 在临时用户目录执行真实安装器，验证首次安装、重复安装及数据保留，不覆盖当前用户Skill。`doctor` 只检查本机Node、Git和ego guide，不登录Evose、不访问业务数据。

本地源码安装到当前Codex（会覆盖同名本地版本，先保留修改）：

```bash
npm run install:skills
```

历史案例是脱敏操作经验，不是当前平台验收证明。脚本、打包检查与真实网站操作结果分别报告；发布过程见[维护说明](docs/publishing.md)。

## 许可

本仓库内容采用 [MIT License](LICENSE)。Skills CLI 为MIT；ego lite及其Skill由上游分发，适用各自条款，本仓库不复制应用、安装脚本或个人浏览器经验。
