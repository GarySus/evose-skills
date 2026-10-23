# 发布与维护

目标仓库为 `GarySus/evose-skills`，公开。首次发布前完成下面本地检查：

```bash
npm ci --ignore-scripts
npm test
npm run test:install
git diff --check
git status --short
```

GitHub账号由用户通过官方登录完成，不在聊天或项目文件中传递密码、令牌和设备凭据。

```bash
gh auth login --hostname github.com --git-protocol https --web
gh api user --jq .login
```

确认当前返回用户为 `GarySus` 后创建并推送；若已存在同名仓库，先读取其当前内容，不覆盖既有历史：

```bash
gh repo create GarySus/evose-skills --public --source . --remote origin --push
```

首次发布后从GitHub重新安装到临时用户目录，核对远端内容与本地提交一致，再确认README命令可用。本地源码安装通过不能代替远端下载验证。按需要创建版本标签/Release；未创建的tag不写进安装命令。

后续改版更新package版本、参考资料的证据状态及必要锁文件，检查学习数据与凭据未进入Git。客户端用户可通过原安装命令更新；存在本地修订时先备份。真实Evose功能变更还需对应页面与运行验收，本地CI不代替它。
