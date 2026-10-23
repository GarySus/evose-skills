# 精准定位与自动学习

导航助手复用 ego-browser 的本轮 TaskSpace/Page，封装正常页面导航、DOM 读取与本地文本导出。它不创建或接管 TaskSpace，不请求业务 API，不读取凭据，不保存、发布或运行云端应用。先完整读取 `ego-browser skill` 的当前 guide。

## 配置与导入

从本轮用户链接或当前页面核对部署 origin、空间和资源 ID。默认支持 `https://app.evose.ai` 的候选路由；其来源是历史静态证据，不代表所有页面均已实测。历史运行验证来自另一个部署，使用前仍须检查当前界面。

ego Node不继承终端环境变量。其他部署在 `ego-browser nodejs` 脚本内、首次导入前设置白名单，例如 `process.env.EVOSE_ORIGINS = 'https://your-evose.example.com'`；这是要替换的示例，不是真实部署地址。可逗号分隔多个 HTTPS origin，不带路径、凭据或查询。每个新进程重新写明配置，导入后修改不会更新已创建的白名单。

不要使用作者电脑的绝对路径。先从当前 Skill 目录找到 `scripts/navigation.mjs`，然后在 `ego-browser nodejs` 中导入其真实绝对路径：

```js
const { pathToFileURL } = await import('node:url');
// skillDirectory 是本次安装目录的真实绝对路径。
const nav = await import(pathToFileURL(`${skillDirectory}/scripts/navigation.mjs`).href);
// target 来自本轮已核验对象；所有 ID 必须是非零十进制字符串。
console.log(await nav.open(page, target));
```

`target` 为 `{origin, workspaceId, kind, resourceId?}`。kind 是 `agent-list`、`agent-config`、`workflow-list`、`workflow-config`、`skill-list` 或 `skill-config`；配置页须提供 resourceId，列表不接受 resourceId。

## 名称、节点与提示词

```js
console.log(await nav.inspect(page, { name: exactResourceName }));
console.log(await nav.openByName(page, exactResourceName));
// 已在正确工作流配置页；只定位，不运行节点。
console.log(await nav.locateNode(page, exactNodeName));
// 已在正确 Agent 配置页；新文件、绝对路径，拒绝覆盖已有文件。
console.log(await nav.savePrompt(page, absoluteNewOutputPath));
```

`inspect` 返回资源身份、完整名称、选择器、渲染数量及覆盖说明。默认20张卡片/节点，可设 limit 1–50。仅代表当前渲染卡片，筛选、搜索、虚拟滚动与权限都会影响结果；零卡片不证明资源不存在。精确名称多匹配会报错，不点第一个。

提示词导出为 `rendered-innerText`，不是原始 Markdown/Tiptap 序列；返回字符数和 SHA-256，不默认打印正文。不能直接用导出文本覆盖原提示词或校验语义缩进。

| 对象 | 历史观察的定位点 |
|---|---|
| Agent / Workflow 卡片 | `[role="button"].app-item` 内头像 `alt` 完整名称 |
| Skill 卡片 | `[data-testid="skill-card"][data-skill-id]` |
| Agent 提示词 | `[data-slot="rich-editor-scroll-area"] .tiptap[contenteditable="true"]` |
| Workflow 节点 | `.react-flow__node[data-id]` |
| Skill 文件 | `[role="treeitem"][aria-label="SKILL.md"]` |

Workflow 列表为 `/workspace/<id>/build-service/workflow`，配置页为 `/workspace/<id>/workflow/<id>/configure`。不要机械拼列表URL。组织管理、计划、观测及深层弹窗按[操作知识](operations.md)处理。助手失效时退回当前局部 DOM，重新观察和验证。

## 自动学习

```js
const learning = await import(pathToFileURL(`${skillDirectory}/scripts/learning.mjs`).href);
const state = await learning.openResource(page, { origin, workspaceId, type, name });
console.log({ identity: state.identity, resolution: state.resolution });
```

type 为 agent / workflow / skill。首次从正确列表发现并核对目标名与真实身份，返回 `discovered`；后续直达后重新核对，返回 `learned`。`openByName` 自动记录资源，`locateNode` 自动记录节点，`savePrompt` 自动记录编辑器；首次即记 `single-observation`，不自动升级为长期稳定。

新元素仍需先按当前 DOM 验证，再登记：

```js
await learning.learnLocator(page, {
  key: semanticKey, selector: observedCssSelector,
  expectedText: shortExpectedLabel, // 可省略；不存编辑器正文。
});
console.log(await learning.recallLocator(page, semanticKey));
```

登记检查唯一、可见与可选标签；复用重新比对 tag、role、aria-label、data-testid 等特征。失效追加 stale，不静默删除历史。页面跳转、导航超时、权限或用户接管错误保留原错误，不用它们推断元素已失效。

默认数据文件为 `${XDG_DATA_HOME:-~/.local/share}/evose-skills/locations.jsonl`，独立于安装目录。可在脚本首次导入前通过 `process.env.EVOSE_LEARNING_STORE` 指定绝对路径，或调用时传 `{store: absolutePath}`；ego未配置XDG目录时使用系统用户主目录。自动导航也会写入默认记录，故临时隔离测试应先设置进程级store。不随Git分发；记录可能包含私人资源名和ID，仍应按业务数据保护。旧版 `learned/locations.jsonl` 不自动迁入，可经检查后复制到新位置，已有目标先备份。

按 `(origin, workspaceId, kind, resourceId)` 隔离，不保存 Cookie、令牌、提示词正文或整页 DOM，不从学习记录生成代码或扩大操作权限。并发追加是轻量日志机制，不提供跨进程事务或业务写入锁。

边界检查：在项目根运行 `npm test`；安装与升级隔离验证运行 `npm run test:install`。这些不代替当前 Evose 页面运行验证。
