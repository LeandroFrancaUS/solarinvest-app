import { promises as fs, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SRC_DIR = path.join(__dirname, '..', 'src')
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']

async function collectSourceFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') {
      continue
    }
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(fullPath)))
    } else if (EXTENSIONS.includes(path.extname(entry.name))) {
      files.push(fullPath)
    }
  }
  return files
}

function extractImportSpecifiers(source) {
  const staticImportRegex = /\bimport\s+(?:type\s+)?[^'"\n]+['"]([^'"\n]+)['"]/g
  const dynamicImportRegex = /\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g
  const specifiers = new Set()

  let match
  while ((match = staticImportRegex.exec(source)) !== null) {
    specifiers.add(match[1])
  }
  while ((match = dynamicImportRegex.exec(source)) !== null) {
    specifiers.add(match[1])
  }

  return Array.from(specifiers)
}

function resolveImport(fromFile, specifier) {
  if (!specifier.startsWith('.')) {
    return null
  }

  const basePath = path.resolve(path.dirname(fromFile), specifier)

  if (path.extname(basePath)) {
    if (EXTENSIONS.includes(path.extname(basePath)) && existsSync(basePath)) {
      return basePath
    }
  }

  for (const ext of EXTENSIONS) {
    const candidate = `${basePath}${ext}`
    if (existsSync(candidate)) {
      return candidate
    }
  }

  for (const ext of EXTENSIONS) {
    const candidate = path.join(basePath, `index${ext}`)
    if (existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

async function buildDependencyGraph(files) {
  const graph = new Map()

  for (const file of files) {
    const source = await fs.readFile(file, 'utf8')
    const specifiers = extractImportSpecifiers(source)
    const deps = []
    for (const specifier of specifiers) {
      const resolved = resolveImport(file, specifier)
      if (resolved) {
        deps.push(path.relative(SRC_DIR, resolved))
      }
    }
    graph.set(path.relative(SRC_DIR, file), deps)
  }

  return graph
}

function canonicalizeCycle(cycle) {
  const withoutDup = cycle.slice(0, -1)
  if (withoutDup.length === 0) {
    return cycle.join(' -> ')
  }
  let best = null
  for (let index = 0; index < withoutDup.length; index += 1) {
    const rotated = withoutDup.slice(index).concat(withoutDup.slice(0, index))
    if (!best || rotated.join('>') < best.join('>')) {
      best = rotated
    }
  }
  const normalized = best.concat(best[0])
  return normalized.join(' -> ')
}

function findCycles(graph) {
  const visiting = new Set()
  const visited = new Set()
  const stack = []
  const cycles = new Set()

  function dfs(node) {
    if (visiting.has(node)) {
      const idx = stack.indexOf(node)
      if (idx !== -1) {
        const cycle = stack.slice(idx).concat(node)
        cycles.add(canonicalizeCycle(cycle))
      }
      return
    }
    if (visited.has(node)) {
      return
    }

    visiting.add(node)
    stack.push(node)

    const deps = graph.get(node) ?? []
    for (const dep of deps) {
      if (graph.has(dep)) {
        dfs(dep)
      }
    }

    stack.pop()
    visiting.delete(node)
    visited.add(node)
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node)
    }
  }

  return Array.from(cycles)
}

async function main() {
  const files = await collectSourceFiles(SRC_DIR)
  const graph = await buildDependencyGraph(files)
  const cycles = findCycles(graph)

  if (cycles.length === 0) {
    console.log('No circular dependencies detected.')
    return
  }

  console.log('Circular dependencies detected:')
  for (const cycle of cycles) {
    console.log(` - ${cycle}`)
  }
  process.exitCode = 1
}

main().catch((error) => {
  console.error('Failed to analyze imports:', error)
  process.exitCode = 1
})
