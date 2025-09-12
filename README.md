# Licensing Verification Platform

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a>

[![Coverage](https://codecov.io/gh/your-org/licensing-verification-platform/branch/main/graph/badge.svg)](https://codecov.io/gh/your-org/licensing-verification-platform)
[![Tests](https://github.com/your-org/licensing-verification-platform/workflows/Test%20Coverage/badge.svg)](https://github.com/your-org/licensing-verification-platform/actions/workflows/coverage.yml)
[![Build Status](https://github.com/your-org/licensing-verification-platform/workflows/CI/badge.svg)](https://github.com/your-org/licensing-verification-platform/actions/workflows/ci.yml)

A **verification-first** professional licensing platform that becomes the "Stripe of Professional Credentials" for medical, legal, and engineering licensing boards. The platform provides privacy-preserving credential verification using Zero-Knowledge Proofs (ZKPs) without exam-taking.

## 🎯 Key Features

- **Privacy-Preserving Verification**: ZKPs ensure verification without revealing sensitive data
- **Multi-Board Support**: Medical, legal, and engineering licensing boards
- **Instant Verification**: Employers can verify credentials without contacting boards
- **L2 Blockchain Integration**: Cost-effective on-chain storage and verification
- **Comprehensive Testing**: 98% test coverage with TDD approach
- **Production-Ready**: HIPAA compliant with SOC 2 security controls

## 🏗️ Architecture

### Backend (Node.js + TypeScript)

- Express.js with TypeScript (strict mode)
- DynamoDB for credential storage, Redis for caching
- JWT tokens with role-based access control
- ZKP integration with Circom circuits
- AWS SDK v3 for all AWS integrations

### Frontend (React + TypeScript)

- React 18+ with TypeScript
- Material-UI for admin dashboard
- Wagmi + Viem for L2 blockchain integration
- Responsive design for all devices

### ZKP Circuits

- Circom circuits for privacy-preserving verification
- Comprehensive test suite with 98% coverage
- On-chain verification with L2 networks
- Nullifier system for replay attack prevention

## 🧪 Testing

This project maintains high test coverage across all components:

### Test Coverage Targets

- **Circuits**: 98% coverage (branches, functions, lines, statements)
- **Backend**: 85% coverage
- **Shared Library**: 90% coverage
- **Frontend**: 80% coverage
- **Infrastructure**: 75% coverage

### Running Tests

```bash
# Run all tests
yarn test

# Run tests with coverage
yarn test:coverage

# Run tests with coverage (CI mode)
yarn test:coverage:ci

# Generate comprehensive coverage report
yarn test:coverage:report

# Clean coverage data
yarn coverage:clean
```

### Test Structure

- **Unit Tests**: Individual component testing
- **Integration Tests**: Cross-component testing
- **E2E Tests**: Full workflow testing
- **Performance Tests**: Load and stress testing
- **Security Tests**: Security vulnerability testing

## 🚀 Development

### Prerequisites

- Node.js 22+
- Yarn package manager
- Docker (for circuit compilation)

### Getting Started

```bash
# Install dependencies
yarn install

# Build all projects
yarn build

# Run tests
yarn test

# Start development servers
yarn dev
```

## Run tasks

To run tasks with Nx use:

```sh
npx nx <target> <project-name>
```

For example:

```sh
npx nx build myproject
```

These targets are either [inferred automatically](https://nx.dev/concepts/inferred-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) or defined in the `project.json` or `package.json` files.

[More about running tasks in the docs &raquo;](https://nx.dev/features/run-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Add new projects

While you could add new projects to your workspace manually, you might want to leverage [Nx plugins](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) and their [code generation](https://nx.dev/features/generate-code?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) feature.

To install a new plugin you can use the `nx add` command. Here's an example of adding the React plugin:

```sh
npx nx add @nx/react
```

Use the plugin's generator to create new projects. For example, to create a new React app or library:

```sh
# Generate an app
npx nx g @nx/react:app demo

# Generate a library
npx nx g @nx/react:lib some-lib
```

You can use `npx nx list` to get a list of installed plugins. Then, run `npx nx list <plugin-name>` to learn about more specific capabilities of a particular plugin. Alternatively, [install Nx Console](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) to browse plugins and generators in your IDE.

[Learn more about Nx plugins &raquo;](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) | [Browse the plugin registry &raquo;](https://nx.dev/plugin-registry?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Set up CI!

### Step 1

To connect to Nx Cloud, run the following command:

```sh
npx nx connect
```

Connecting to Nx Cloud ensures a [fast and scalable CI](https://nx.dev/ci/intro/why-nx-cloud?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) pipeline. It includes features such as:

- [Remote caching](https://nx.dev/ci/features/remote-cache?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Task distribution across multiple machines](https://nx.dev/ci/features/distribute-task-execution?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Automated e2e test splitting](https://nx.dev/ci/features/split-e2e-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Task flakiness detection and rerunning](https://nx.dev/ci/features/flaky-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

### Step 2

Use the following command to configure a CI workflow for your workspace:

```sh
npx nx g ci-workflow
```

[Learn more about Nx on CI](https://nx.dev/ci/intro/ci-with-nx#ready-get-started-with-your-provider?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Install Nx Console

Nx Console is an editor extension that enriches your developer experience. It lets you run tasks, generate code, and improves code autocompletion in your IDE. It is available for VSCode and IntelliJ.

[Install Nx Console &raquo;](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Useful links

Learn more:

- [Learn more about this workspace setup](https://nx.dev/getting-started/intro#learn-nx?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Learn about Nx on CI](https://nx.dev/ci/intro/ci-with-nx?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Releasing Packages with Nx release](https://nx.dev/features/manage-releases?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [What are Nx plugins?](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

And join the Nx community:

- [Discord](https://go.nx.dev/community)
- [Follow us on X](https://twitter.com/nxdevtools) or [LinkedIn](https://www.linkedin.com/company/nrwl)
- [Our Youtube channel](https://www.youtube.com/@nxdevtools)
- [Our blog](https://nx.dev/blog?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

# Test commit
