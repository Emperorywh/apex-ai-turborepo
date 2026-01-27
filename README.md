# Apex AI Turborepo

这是 Apex AI 的官方单体仓库，使用 [Turborepo](https://turbo.build/repo) 构建。

## 包含内容

本仓库包含以下应用和包：

### 应用和包 (Apps and Packages)

- `apps/apex-ai`: 主要的 Apex AI 应用程序 (Next.js)。一个集成了 ChromaDB、LangChain 和 LLM (OpenAI/DeepSeek) 的 RAG 聊天应用，用于智能问答。在线地址：https://ai.imywh.com
- `apps/node-tools`: 后端工具服务 (Express/Node.js)。处理数据摄取任务，例如处理 [HowToCook](https://github.com/Anduin2017/HowToCook) 仓库的食谱并将其索引到 ChromaDB 中。
- `apps/docs`: 文档站点 (Next.js)。
- `apps/web`: Web 应用程序 (Next.js)。
- `packages/ui`: 共享 React 组件库 (`@repo/ui`)。
- `packages/eslint-config`: 共享 ESLint 配置 (`@repo/eslint-config`)。
- `packages/typescript-config`: 共享 TypeScript 配置 (`@repo/typescript-config`)。

## Git 提交规范 (Git Commit Convention)

我们遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范。
我们的提交信息会通过 `commitlint` 进行检查，并使用自定义配置动态验证 scope 是否符合目录结构。

### 格式

```text
<type>(<scope>): <subject>
```

> **注意**: 本仓库**强制要求**填写 Scope。

### 类型 (Types)

- `feat`: 新功能 (A new feature)
- `fix`: Bug 修复 (A bug fix)
- `docs`: 仅文档变更 (Documentation only changes)
- `style`: 不影响代码含义的变更 (空格, 格式化等)
- `refactor`: 既不是修复 Bug 也不是添加功能的代码更改 (重构)
- `perf`: 提高性能的代码更改
- `test`: 添加缺失的测试或更正现有的测试
- `build`: 影响构建系统或外部依赖关系的更改
- `ci`: 对 CI 配置文件和脚本的更改
- `chore`: 其他不修改 src 或测试文件的更改
- `revert`: 撤销之前的提交

### 范围 (Scopes)

Scope 必须是 `apps/` 或 `packages/` 目录下的目录名，或者是用于根目录变更的 `repo`。
当前有效的 scope 包括：

- `apex-ai`
- `node-tools`
- `docs`
- `web`
- `ui`
- `eslint-config`
- `typescript-config`
- `repo` (用于根目录 `package.json`, `turbo.json` 等的变更)

**注意**: Scope 列表是根据文件系统在 `commitlint.config.js` 中动态生成的。如果你添加了新的应用或包，它会自动成为有效的 scope。

### 示例

✅ **正确:**
```bash
feat(apex-ai): add new chat component
fix(node-tools): fix ingestion error
docs(repo): update readme with commit convention
chore(eslint-config): update rules
```

❌ **错误:**
```bash
feat: add new chat component (缺少 scope)
fix(unknown): correct button padding (无效的 scope)
update readme (格式错误)
```

## 开发 (Development)

### 安装依赖

```bash
pnpm install
```

### 构建

运行以下命令构建所有应用和包：

```bash
pnpm build
```

### 开发模式

运行以下命令启动所有应用和包的开发模式：

```bash
pnpm dev
```
