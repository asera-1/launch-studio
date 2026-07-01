# Contributing to Launch Studio

Thanks for taking the time to contribute! This guide covers everything you need to get up and running and to land a change smoothly.

## Getting Started

1. Fork the repository and clone your fork.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
   The app runs at `http://localhost:3000`.

## Branching

Create a descriptive branch off `main` using the `type/short-description` convention:

- `feat/add-export-button`
- `fix/broken-nav-link`
- `docs/update-readme`
- `chore/bump-deps`
- `refactor/simplify-config`

Keep one logical change per branch.

## Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) style:

```
<type>(optional scope): <short summary>
```

Examples:

- `feat(editor): add keyboard shortcuts`
- `fix(api): handle empty response body`
- `docs: clarify setup steps`

Write commits in the imperative mood ("add", not "added") and keep the summary under ~72 characters.

## Before You Open a PR

Please make sure the project builds and lints cleanly:

```bash
npm run build
npm run lint
```

Fix any errors or warnings introduced by your change.

## Opening a Pull Request

1. Push your branch to your fork.
2. Open a PR against `main` and fill out the pull request template.
3. Describe **what** changed and **why**, and link any related issues (e.g. `Closes #123`).
4. Add screenshots or recordings for UI changes.
5. Be responsive to review feedback — small follow-up commits are fine.

## Code of Conduct

Be kind, assume good intent, and keep discussions constructive. We want this to be a welcoming project for everyone.

Happy building!
