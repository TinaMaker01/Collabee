#!/usr/bin/env node
import { execSync } from 'node:child_process'

console.log('🔍 Running pre-commit validation checks...')

try {
  console.log('⏳ Checking code linter...')
  execSync('npm run lint', { stdio: 'inherit' })

  console.log('⏳ Checking TypeScript types...')
  execSync('npm run typecheck', { stdio: 'inherit' })

  console.log('⏳ Running automated tests...')
  execSync('npm run test', { stdio: 'inherit' })

  console.log('✅ All pre-commit checks passed!')
} catch {
  console.error('\n❌ Pre-commit check failed. Commit aborted.')
  process.exit(1)
}
