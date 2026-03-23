// Husky install script
// This file is used by Docker to install Husky hooks
import { fileURLToPath } from 'node:url'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Create .husky directory if it doesn't exist
const huskyDir = join(__dirname, '..', '.husky')
mkdirSync(huskyDir, { recursive: true })

// This is a minimal install script for Docker builds
// Husky hooks are disabled in Docker (HUSKY=0)
console.log('Husky install script loaded')
