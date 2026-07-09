---
name: cli-tooling-js-ts
description: "CLI tooling: argument parsing (commander, yargs, citty), terminal UX (ora, chalk, ink), configuration loading, distribution (Bun compile, pkg), interactive prompts. Use for building JS/TS CLI tools."
compatibility: opencode
metadata:
  domain: cli
  audience: senior-engineer
---

# CLI Tooling

Guide for building production-grade command-line tools with JavaScript/TypeScript and Bun.

## When to apply

- Building new CLI tools or scripts.
- Adding argument parsing and help text.
- Designing terminal output with colors, spinners, and progress bars.
- Distributing CLI tools as standalone binaries.
- Reviewing existing CLI tools for UX and error handling.

## Core principles

### 1. Project setup

```bash
bun init
bun add commander zod chalk ora
bun add -d typescript @types/node
```

```json
// package.json
{
  "name": "my-cli",
  "type": "module",
  "bin": { "my-cli": "./dist/index.js" },
  "files": ["dist/"]
}
```

```typescript
#!/usr/bin/env bun
// index.ts — entry point with shebang
```

### 2. Argument parsing

```typescript
// Commander
import { Command } from 'commander';

const program = new Command()
  .name('my-cli')
  .description('My awesome CLI tool')
  .version('1.0.0');

program
  .command('deploy')
  .description('Deploy to production')
  .option('-e, --env <environment>', 'Target environment', 'production')
  .option('-f, --force', 'Skip confirmation')
  .argument('<service>', 'Service to deploy')
  .action(async (service, options) => {
    console.log(`Deploying ${service} to ${options.env}...`);
  });

program.parse();
```

### 3. Terminal UX

```typescript
// Colors and styling
import chalk from 'chalk';
console.log(chalk.green('✓ Done'));
console.log(chalk.red.bold('✗ Error'));
console.log(chalk.yellow('⚠ Warning'));
console.log(chalk.blue.underline('https://example.com'));

// Spinner for async operations
import ora from 'ora';
const spinner = ora('Loading...').start();
try {
  await doWork();
  spinner.succeed('Loaded');
} catch (err) {
  spinner.fail('Failed');
}

// Progress bar
import cliProgress from 'cli-progress';
const bar = new cliProgress.SingleBar({});
bar.start(100, 0);
for (let i = 0; i < 100; i++) {
  await doChunk();
  bar.update(i + 1);
}
bar.stop();
```

### 4. Configuration loading

```typescript
// Load from multiple sources: defaults → config file → env → CLI args
import { z } from 'zod';

const ConfigSchema = z.object({
  apiUrl: z.string().url().default('https://api.example.com'),
  token: z.string().min(1),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

// Priority: CLI args > env vars > config file > defaults
const config = ConfigSchema.parse({
  apiUrl: cliOptions.apiUrl ?? process.env.API_URL,
  token: cliOptions.token ?? process.env.TOKEN,
  logLevel: cliOptions.logLevel ?? process.env.LOG_LEVEL,
});
```

### 5. Error handling

```typescript
function handleError(error: unknown): never {
  if (error instanceof z.ZodError) {
    console.error(chalk.red('Configuration error:'));
    for (const issue of error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
  } else if (error instanceof Error) {
    console.error(chalk.red(`Error: ${error.message}`));
    if (process.env.DEBUG) console.error(error.stack);
  } else {
    console.error(chalk.red('Unknown error'));
  }
  process.exit(1);
}

process.on('unhandledRejection', handleError);
```

### 6. Distribution with Bun

```bash
# Compile to standalone binary
bun build ./index.ts --compile --outfile my-cli

# Cross-platform
bun build ./index.ts --compile --target=bun-linux-x64 --outfile my-cli-linux
bun build ./index.ts --compile --target=bun-darwin-arm64 --outfile my-cli-macos
```

### 7. Interactive prompts

```typescript
import { confirm, input, select } from '@inquirer/prompts';

const name = await input({ message: 'Project name:' });
const framework = await select({
  message: 'Choose framework:',
  choices: [
    { name: 'React', value: 'react' },
    { name: 'Svelte', value: 'svelte' },
    { name: 'Vue', value: 'vue' },
  ],
});
const useTs = await confirm({ message: 'Use TypeScript?', default: true });
```

### 8. Testing CLI tools

```typescript
import { execSync } from 'node:child_process';

it('outputs help text', () => {
  const output = execSync('bun run dist/index.js --help', { encoding: 'utf8' });
  expect(output).toContain('Usage:');
  expect(output).toContain('deploy');
});

it('deploy command requires service argument', () => {
  expect(() => {
    execSync('bun run dist/index.js deploy', { encoding: 'utf8' });
  }).toThrow();
});
```

## Reference materials

- `references/cli-design-checklist.md` — CLI design principles and UX checklist.
- `references/bun-compile-guide.md` — standalone binary compilation with Bun.
