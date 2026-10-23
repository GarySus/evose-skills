# 发布与维护

仓库：`GarySus/evose-skills`，公开。版本以 `package.json` 为准，Release 标签使用 `v` 前缀，例如 `v0.1.0`。

## 发布前检查

```bash
npm ci --ignore-scripts
npm test
npm run test:install
npm pack --dry-run --ignore-scripts
git diff --check
```

核对打包清单，不包含凭据、个人定位记录、`node_modules` 和本地输出。真实 Evose 功能变更还需对应页面与运行验收，本地 CI 不代替它。

## 发布新版本

1. 更新 `package.json` 版本、运行 `npm install --package-lock-only --ignore-scripts`，并在 `CHANGELOG.md` 写入该版本的具体变更。
2. 提交到 GitHub，等待 Check 工作流通过。
3. 在仓库 Releases 创建匹配版本的标签和 Release，标题为版本号，正文使用对应 Changelog 内容，点击 Publish release。
4. Release 工作流重新检查、构建下载包、上传附件，然后发布 GitHub npm 包。确认该工作流成功，并核对附件和 Packages 版本。

工作流使用 GitHub 自动提供的 `GITHUB_TOKEN`，权限限于当前仓库的 `contents: write` 和 `packages: write`。不需要个人 npm 密码或另行保存发布令牌。`publishConfig.registry` 将目标限定为 GitHub Packages。

首次创建 npm 包后，在包的 Package settings 中将可见性设为 Public；公开仓库不会自动让 npm 包公开。后续版本沿用该设置。版本发布后不覆盖同版本 npm 包；需要修复时发布新的补丁版本。若包尚未发布且工作流出错，可修复工作流后在 Actions → Release → Run workflow 中填写已有 Release 标签重试；构建仍检出该标签，下载附件按同名替换。

## 发布内容

| 位置 | 内容 | 用途 |
|---|---|---|
| Release：`evose-skills-v<版本>.zip` | 对应标签的完整源码快照 | 下载、解压、按安装指南安装 |
| Release：`garysus-evose-skills-<版本>.tgz` | npm 打包白名单内的 Skill、脚本和文档 | 包管理器使用、离线分发 |
| Release：`SHA256SUMS` | 两个附件的 SHA-256 | 下载后核对文件完整性 |
| GitHub Packages：`@garysus/evose-skills` | 同一版本 npm 包 | 已配置 GitHub npm registry 的项目集成 |

GitHub 还会自动提供标签源码 ZIP 和 tar.gz。优先推荐 README 中的公开仓库安装命令；GitHub npm registry 即使包公开，也要求安装方按官方说明完成认证，详见[安装指南](installation.md)。

用户可用原命令更新；存在本地修订时先备份。学习记录在 Skill 目录之外，升级不应覆盖它。发布后从公开地址下载并在临时用户目录验证安装，本地源码安装通过不能代替远端验证。
