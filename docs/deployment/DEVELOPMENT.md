# Development Guide

## Local Development

### Prerequisites

- Node.js 22+
- Yarn package manager

### Setup

```bash
# Install dependencies
yarn install

# Run the full CI pipeline locally
yarn ci
```

### Available Scripts

- `yarn build` - Build all projects
- `yarn test` - Run all tests (unit + e2e)
- `yarn lint` - Lint all projects
- `yarn ci` - Run full CI pipeline (install, lint, build, test)

## Git Hooks

This project uses Husky for Git hooks to ensure code quality:

### Pre-commit Hook

Runs automatically before each commit:

1. **Lint-staged**: Lints and formats only staged files
2. **Build**: Ensures all projects compile successfully
3. **Tests**: Runs all unit and e2e tests

### Pre-push Hook

Runs automatically before each push:

1. **Full CI Pipeline**: Runs the complete CI pipeline locally

## CI Pipeline

The CI pipeline includes:

1. **Install**: `yarn install --frozen-lockfile`
2. **Lint**: `yarn lint` - ESLint across all projects
3. **Build**: `yarn build` - TypeScript compilation for all projects
4. **Test**: `yarn test` - Unit tests and e2e tests

## Project Structure

- `backend/` - Express.js API server
- `frontend/admin-dashboard/` - React admin interface
- `frontend/employer-portal/` - React employer interface
- `protobuff/` - Protocol buffer definitions
- `shared/` - Shared utilities and types
- `infrastructure/` - AWS CDK infrastructure code

## Development Workflow

1. Make your changes
2. Stage files: `git add .`
3. Commit: `git commit -m "your message"` (pre-commit hook runs automatically)
4. Push: `git push` (pre-push hook runs full CI pipeline)

If any hook fails, fix the issues and try again. This ensures that only working code reaches the repository.
