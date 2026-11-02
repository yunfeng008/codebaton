# codebaton 🏃‍♂️🏃 Agent 接力棒

**跨 AI 编程工具的任务接力协议 + 小工具。** 让 ZCode、DeepSeek、Kimi、MiniMax、Claude Code、Codex……任何一个工具，都能接住另一个工具没干完的活。

> **✨ 功能完整 · 极致轻量 · 安全透明 · 零遥测** —— 3 个 markdown 文件 + 1 个零依赖 CLI，不装守护进程、不占端口、不联网上报，所有数据只存在你自己的仓库里。

```bash
npx codebaton init
```

## 为什么需要它

同时用多个 AI 编程工具的人都会撞上同一堵墙：**会话不能跨工具迁移**。ZCode 里干到一半的产品，换 DeepSeek 接手，它两眼一抹黑——项目背景、做到哪了、为什么这么设计，全要重新解释，或者让它烧几十 k token 自己翻代码。

我们核实的现状是：主流编排/记忆工具全部围着 Claude Code / Codex 生态转——

| 工具 | 跨 agent 交接 | 支持国产 harness |
|---|---|---|
| 编排面板（Orca 等） | ❌ | 部分支持但无交接 |
| 交接工具（Paseo / Cindy） | ✅ | ❌ 引擎锁死 |
| 记忆插件（claude-mem / EverOS） | ✅ | ❌ 捕捉端没有国产 |

**codebaton 填的就是这个格子。** 思路不是迁移会话（做不到），而是：**不迁会话，迁状态**——把任务状态放进仓库里的三个 markdown 文件，任何工具、任何模型都能读。

## 三件套

| 文件 | 管什么 | 谁维护 |
|---|---|---|
| `AGENTS.md` | 规则层：项目是什么、怎么构建验证、红线 | 基本不变 |
| `TASKS.md` | 任务层：⬜ 待办 / 🔨 进行中 / 👀 待验证 / ✅ 完成 | 每次收尾更新 |
| `HANDOFF.md` | 交接层：此刻干到哪、关键决定、踩过的坑、下一步 | **谁收尾谁写** |

核心纪律只有一条：**谁收尾，谁写交接。** 换工具前，让当前工具更新 HANDOFF.md；新工具进来，第一句话：**"按 AGENTS.md 接手"**——协议已写进 AGENTS.md（开工前必读 TASKS.md 和 HANDOFF.md），口令只负责叫门，一句话就够（`npx codebaton brief` 随时取）。交接成本从"重新解释一切"降到"读三份文件"（约 1-3k token）。

## 三个命令

```bash
npx codebaton init      # 生成三件套（检测到已有文件不覆盖）
npx codebaton handoff   # 用 git 事实（分支/未提交改动/最近提交/diff）自动起草交接草稿
npx codebaton brief     # 开工口令：一句话让任意工具接手（自动复制到剪贴板）
npx codebaton board     # 终端渲染 TASKS.md 看板
```

`handoff` 的用法：切换工具前运行它，把生成的 `HANDOFF.draft.md` 交给当前 agent：

> 读 HANDOFF.draft.md，结合本轮会话补全交接（做了什么/为什么/坑/下一步），合并进 HANDOFF.md 后删除草稿

git 收集事实，agent 补充"为什么"——交接稿既有硬数据又有决策上下文。

零依赖，Node ≥ 16，不需要安装任何运行时服务。

## 工作流示例

```
你（手机/地铁上，ZCode 会话里）：把登录改成手机号验证码，做一半要下车了
ZCode：改完 TtdkLoginController，编译通过，TASKS.md 挂"进行中"，
       npx codebaton handoff 起草交接，commit
——晚上——
你：DeepSeek 打开同一仓库
你：按 AGENTS.md 接手
DeepSeek：明白，登录改到手机号验证码，controller 已有雏形，
          service 层还差短信网关对接，我继续……
```

## FAQ

**Q：这不就是三个 markdown 文件吗？**
对，工具的核心就是三个文件和一条纪律，CLI 只是让"初始化"和"交接"更省事。我们刻意不碰任何 harness 的私有会话格式——所以它永远兼容，各家工具改版、出新模型都不影响。

**Q：和 Backlog.md / 任务管理工具有什么区别？**
它们管"任务列表"，codebaton 管"跨工具接力"——重点是 HANDOFF 交接仪式和给 agent 的定向协议（AGENTS.md 红线 + 验证纪律）。可以配合使用。

**Q：为什么不做成 GUI / 管理面板？**
面板解决"同时跑多个 agent"的体验问题，三件套解决"换 agent 不丢状态"的问题，两层互补不冲突。先用文件跑顺流程，真需要面板再选（那时你已经有了干净的任务数据）。

**Q：Claude Code 用户能用吗？**
能用，它对 Claude Code 同样有效——只是 Claude Code 生态已有更多现成工具可选，codebaton 对国产 harness（ZCode / DeepSeek / Kimi / MiniMax / Qwen Code）用户价值最大。

## 承诺（Design Principles）

1. **功能完整**：init 生成规范、handoff 自动起草交接、board 终端看板——覆盖接力闭环
2. **极致轻量**：零依赖（node_modules 为 0 个包）、单文件 CLI、Node ≥ 16，`npx` 即用即走
3. **安全透明**：只读写你项目目录内的 markdown；唯一的"外部调用"是本地的 `git` 命令
4. **零遥测**：无账号、无上报、无统计埋点，连版本检查都不发——CLI 加模板总共不到 300 行，可全文审计
5. **不碰私有格式**：纯 markdown + git，harness 改版、出新模型都不影响，永远兼容

## License

MIT
