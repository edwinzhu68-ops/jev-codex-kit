# Jev Coding Kit

新增：[自动静默入口](docs/automatic-codex.md)和[Computer Use / 浏览器整合说明](docs/integration-map.md)。浏览器已实测一次调用连续完成两次点击；桌面原生操作仍需兼容运行环境，不能用浏览器结果代替验收。

当前 `main` 新增 [工作准备](docs/work-preparation.md)：`jev_prepare_work` 在主会话自行执行或派发子代理前，批量整理明确材料、检查前提，保留全部原文、约束和验收要求。每个不同任务有独立 task_id 和准备过程，即使读取相同文件也不套用其他任务的判断；仅同一任务从主控交给对应执行者时传递已有工作包。共 13 个工具；此能力尚未包含在 v0.4.2 发布包中。

当前 `main` 分支：`workflow` 模式会在每条符合条件的实质工作请求前给主控一条本地分流提醒，提醒本身零 Jev 模型调用；“继续”等简短续接仍需由主控的任务规则承接。0.4.2 的[工作量对照](docs/evaluations/workload-benefit-20260922.md)中，8 条中文问题分类约 0.69 秒、8/8 符合预设答案，但源码声明核对仍有错误和大量待复核项。证据文本去掉重复字段，保留完整原文和判断；不据此宣称整项编程任务提速。

一个入口，把 **Jev 结构化判断、源码定位简报、批量证据核对**接入 Codex、Claude Code、Cursor、OpenCode、Pi 和 VS Code。仓库和技能标识保留 `jev-codex-kit`，方便现有用户升级。

编码助手可以先收集限定范围内的源码和日志，按需用 Jev 筛选、核对，再拿着完整材料、源码哈希和反证继续工作。它减少重复整理材料的机会；实际提速仍需针对任务测量。

[下载最新版](https://github.com/edwinzhu68-ops/jev-codex-kit/releases/latest) · [各客户端安装与兼容性边界](docs/clients.md) · [参与贡献](CONTRIBUTING.md)

**你正常交代任务，Codex 按需选择工具；Jev 返回判断，Codex 负责编辑、执行和验收。** 不接管模型路由，不要求每句话调用，不启动自主编程代理。尚未证明普遍提速或成本节省。

[English](README.en.md) · [使用技能](skills/jev-codex-kit/SKILL.md) · [第三方来源](THIRD_PARTY_NOTICES.md) · [数据边界](SECURITY.md)

## 3 步开始

准备 **Node.js 22+、ripgrep (`rg`)、自己的 TypeSafe API Key**。自动注册 Codex 还需要 `codex` CLI 在 PATH 中。API 使用可能产生 TypeSafe 费用；本项目不提供共享 Key。

**Windows：下载并解压后双击 `setup.cmd`，选择编码工具，填写项目路径和自己的 Key。** 脚本安装依赖、构建、注册所选客户端并检查状态。macOS/Linux 在解压目录运行 `sh setup.sh`；macOS 也提供 `setup.command`，但 Finder 双击体验尚未实机验证。

1. 下载 GitHub Release 的 ZIP 并解压，或克隆本仓库。在目录中打开终端。
2. 安装和构建：

   ```sh
   npm ci --ignore-scripts --no-audit --no-fund
   npm run build
   ```

3. 配置项目并注册客户端；把 `codex` 换成 `claude`、`cursor`、`opencode`、`pi` 或 `vscode`，逗号分隔可选多个：

   ```sh
   npm run setup -- --root "你的项目绝对路径" --client codex
   npm run doctor
   ```

安装向导在需要时隐藏输入 API Key。Windows 使用当前用户 DPAPI 加密保存；macOS/Linux 使用用户目录中的权限 0600 文件（不加密）。也可自行设置 `TYPESAFE_API_KEY` 环境变量，不保存密钥。设置了环境变量时，启动 Codex 的进程也必须继承它。配置和回执保存在 `~/.jev-codex-kit`，不在源码仓库。

Codex 安装会添加名为 `jev-kit` 的 MCP、`jev-codex-kit` / `jev-ui` 两个技能和自动分工提示 hook；首次仍需 Codex 原生信任该 hook。其他服务和全局 AGENTS.md 保留。已有自定义自动目录和模式不会被默认替换；付费技能推荐仍可选 `auto mode skills`。**保留安装目录**，注册会引用其绝对路径。不要对同一判断同时调用旧 Jev 服务和这个工具包。

升级时在原安装目录更新代码、安装依赖并构建，然后运行 `node bin/jev-kit.mjs setup --root "项目路径" --client codex --upgrade --no-key-prompt`。会备份更新技能、刷新已选技能的哈希，保留凭据、历史判断和其他 hook。只升级 UI 技能可运行 `ui install --upgrade`，之后 `auto refresh`。

`doctor` 只做本地检查，不调用付费 API；READY 不代表模型服务或判断质量已验证。旧任务看不到工具时，可新建任务，或者使用下面的 CLI，不必打断其他正在运行的任务。

## 在会话中使用

新增：`jev_route_skills` 可从明确的候选描述中推荐技能，保留必用技能和无匹配出口，不接管会话。也有离线技能目录命令。见 [技能选择用法](docs/skill-routing.md) 和 [8 个固定任务的首轮实测](docs/evaluations/skill-routing-20260922.md)：本轮 Jev 8/8、简单关键词基线 6/8；这不是 Codex 编程速度或额度节省证明。

正常交代任务即可。首次可以告诉 Codex：

> 使用已安装的 jev-codex-kit 技能，按任务需要定位源码、整理证据或核对结论；你负责修改与真实测试。不要每步调用，不要重复判断。

| 需要做什么 | 工具 |
| --- | --- |
| 按明确任务在候选技能中选择 | `jev_route_skills` |
| 在授权子目录中寻找相关源码 | `jev_code_brief` |
| 收集明确文件/日志、核对证据 | `jev_prepare_evidence` |
| 排序 / 验证声明 / 审查改动 | `jev_rank` / `jev_verify` / `jev_review` |
| 同时审查改动和完成声明 | `jev_gate` |
| 选择已准备好的下一步 | `jev_step` / `jev_tool_route` / `jev_coding_loop` |
| 检查不可信文本 / 自定义原子判断 | `jev_screen` / `jev_evaluate` |

精确搜索、计算、已知文件读取直接用本地工具。`auto`、`BRIEF_READY`、`EVIDENCE_READY` 都不是测试通过或执行授权。保留不确定和反证，由宿主继续处理。

## 一个 CLI，也能在没有 MCP 的会话中用

```sh
node bin/jev-kit.mjs help
node bin/jev-kit.mjs call jev_prepare_evidence examples/evidence.json result.json
node bin/jev-kit.mjs call jev_code_brief examples/brief.json brief-result.json
node bin/jev-kit.mjs call jev_evaluate examples/evaluate.json judgment.json
```

先把示例中的项目路径改成 setup 已授权的真实路径，源文件必须存在。输出文件必须是新路径，避免覆盖证据。`pinned` 且没有分类/检查的证据收集不调用模型；其他语义判断使用你自己的额度。两个源码工具回执包含源码片段，不能公开上传。

再次授权其他项目：`npm run setup -- --root "另一个项目路径" --no-key-prompt`。只授权需要的项目目录，不能授权磁盘根目录。自定义配置目录可设 `JEV_KIT_HOME`，MCP 启动时必须使用同一环境。

## 其他 MCP 客户端

运行 `node bin/jev-kit.mjs config --client cursor` 导出相应格式；也支持 `claude`、`codex`、`opencode`、`vscode`、`windsurf` 和 `generic`。Pi 使用原生扩展，安装后 `/jev-status` 检查连接且不调用模型。配置不包含密钥。WorkBuddy/ZCode 请按其当前 MCP 文档适配，不宣称具体版本已完成实测。详细路径、升级和卸载见 [客户端说明](docs/clients.md)。

## 具体限制

- 固定模型 `jev-1.13.0`，禁止单次覆盖。每次实际推理最多 20 个问题、24000 个序列化请求字符，代码拒绝超限和截断。SDK 可在截止时间内重试临时 HTTP 错误；工具包不会循环重做判断。
- 源码简报仅在指定子目录本地发现候选，最多扫描 256 个文件、读取 2 MiB，单文件上限 256 KiB，最多返回 8 个候选。局部候选不等于完整仓库覆盖。
- JS/TS/GDScript 支持完整选中单元，最长 4500 字符；2400 字符内可读完整小文件。Lua/Luau/Python 目前仅支持小文件整体读取；更大文件需宿主直接读取或选择明确证据片段。
- 证据工具接受明确文件、行范围或 GDScript 函数，最多 10 个材料、8 条核对项；单文件 2 MiB，合并请求仍受字符/问题上限限制。
- 无生成模型、无任意命令执行器、无 Foreman/JevLoop 自动接管。常见敏感字段检测不是安全沙箱；文件哈希是时点检查，不是文件锁。

## 开发与验证

```sh
npm run build
npm test
```

测试包含真实本地文件、MCP stdio、CLI、路径限制、证据保留、错误/不确定状态，以及桩响应的语义流程测试；不需要 API Key，也不调用付费服务。离线测试不能证明线上判断准确率。构建脚本转译固定上游 TypeScript 模块，并非上游完整类型检查或全部测试套件。

发布验证与当前限制见 [VALIDATION.md](VALIDATION.md)。本项目为社区整合，不是 TypeSafe 或 OpenAI 官方产品。

暂停自动推荐：`node bin/jev-kit.mjs auto disable`。完整卸载按[客户端说明](docs/clients.md#troubleshooting-and-removal--排错与卸载)依次移除 owned hook、UI 技能、MCP 与编码技能，保留凭据和证据。没有“每天 30 次”或“一个任务 6 次”限制；单次请求大小、执行分段和超时是程序边界，并非账号额度。
