# Apex AI Turborepo

This is the official monorepo for Apex AI, built with [Turborepo](https://turbo.build/repo).

## What's inside?

This Turborepo includes the following packages/apps:

### Apps and Packages

- `apps/apex-ai`: The main Apex AI application (Next.js)
- `apps/docs`: Documentation site (Next.js)
- `apps/web`: Web application (Next.js)
- `packages/ui`: Shared React component library (`@repo/ui`)
- `packages/eslint-config`: Shared ESLint configurations (`@repo/eslint-config`)
- `packages/typescript-config`: Shared TypeScript configurations (`@repo/typescript-config`)

## Git Commit Convention

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.
Our commit messages are linted by `commitlint` with a custom configuration that dynamically checks scopes against our directory structure.

### Format

```text
<type>(<scope>): <subject>
```

> **Note**: Scope is **mandatory** in this repository.

### Types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (white-space, formatting, etc)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `build`: Changes that affect the build system or external dependencies
- `ci`: Changes to our CI configuration files and scripts
- `chore`: Other changes that don't modify src or test files
- `revert`: Reverts a previous commit

### Scopes

The scope must be one of the directories in `apps/` or `packages/`, or `repo` for root-level changes.
Current valid scopes include:

- `apex-ai`
- `docs`
- `web`
- `ui`
- `eslint-config`
- `typescript-config`
- `repo` (use this for changes to the root `package.json`, `turbo.json`, etc.)

**Note**: The list of scopes is dynamically generated from the file system in `commitlint.config.js`. If you add a new app or package, it automatically becomes a valid scope.

### Examples

✅ **Good:**
```bash
feat(apex-ai): add new chat component
fix(ui): correct button padding
docs(repo): update readme with commit convention
chore(eslint-config): update rules
```

❌ **Bad:**
```bash
feat: add new chat component (missing scope)
fix(unknown): correct button padding (invalid scope)
update readme (invalid format)
```

## Development

### Install Dependencies

```bash
pnpm install
```

### Build

To build all apps and packages, run the following command:

```bash
pnpm build
```

### Develop

To develop all apps and packages, run the following command:

```bash
pnpm dev
```

### Remote Caching

Turborepo can use a technique known as [Remote Caching](https://turborepo.com/docs/core-concepts/remote-caching) to share cache artifacts across machines, enabling you to share build caches with your team and CI/CD pipelines.

By default, Turborepo will cache locally. To enable Remote Caching you will need an account with Vercel. If you don't have an account you can [create one](https://vercel.com/signup?utm_source=turborepo-examples), then enter the following commands:

```bash
pnpm turbo login
pnpm turbo link
```

## Useful Links

Learn more about the power of Turborepo:

- [Tasks](https://turborepo.com/docs/crafting-your-repository/running-tasks)
- [Caching](https://turborepo.com/docs/crafting-your-repository/caching)
- [Remote Caching](https://turborepo.com/docs/core-concepts/remote-caching)
- [Filtering](https://turborepo.com/docs/crafting-your-repository/running-tasks#using-filters)
- [Configuration Options](https://turborepo.com/docs/reference/configuration)
- [CLI Usage](https://turborepo.com/docs/reference/command-line-reference)
