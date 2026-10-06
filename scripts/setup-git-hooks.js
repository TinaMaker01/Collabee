#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const gitHooksDir = path.resolve(__dirname, '..', '.git', 'hooks')

if (fs.existsSync(gitHooksDir)) {
  const hookPath = path.join(gitHooksDir, 'pre-commit')
  const hookContent = `#!/bin/sh\nnode scripts/pre-commit.js\n`
  fs.writeFileSync(hookPath, hookContent, { mode: 0o755 })
  console.log('✅ Git pre-commit hook configured in .git/hooks/pre-commit')
} else {
  console.log('ℹ️ No .git directory detected, skipping hook installation.')
}
