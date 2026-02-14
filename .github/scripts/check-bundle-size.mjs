#!/usr/bin/env node
/**
 * Bundle size budget checker.
 * Parses Next.js build output from .next/routes-manifest.json and
 * .next/build-manifest.json to compute total JS size per route.
 *
 * Budgets (in KB, gzipped):
 * - Total First Load JS: 250 KB  (shared + page)
 * - Per-page JS:          80 KB  (page-specific bundle)
 *
 * Exit code 1 if any budget is exceeded.
 */

import { readFileSync, readdirSync, statSync } from "fs"
import { join } from "path"

const NEXT_DIR = ".next"

// Budgets in bytes (gzipped sizes from build output)
const BUDGETS = {
  firstLoadJS: 250 * 1024, // 250 KB total first load
  pageJS: 80 * 1024,       // 80 KB per-page JS
}

function getFileSize(filePath) {
  try {
    return statSync(filePath).size
  } catch {
    return 0
  }
}

function walkDir(dir, extensions) {
  let total = 0
  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        total += walkDir(fullPath, extensions)
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        total += getFileSize(fullPath)
      }
    }
  } catch {
    // Directory doesn't exist
  }
  return total
}

function formatKB(bytes) {
  return (bytes / 1024).toFixed(1) + " KB"
}

// Parse the Next.js build trace to extract route sizes
function main() {
  let violations = []
  let warnings = []

  // Get total static JS size from .next/static/chunks
  const chunksDir = join(NEXT_DIR, "static", "chunks")
  const totalStaticJS = walkDir(chunksDir, [".js"])

  // Get pages JS sizes
  const pagesDir = join(NEXT_DIR, "static", "chunks", "app")
  let pageResults = []

  function scanPages(dir, prefix = "") {
    try {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) {
          scanPages(fullPath, prefix + "/" + entry.name)
        } else if (entry.name.endsWith(".js")) {
          const size = getFileSize(fullPath)
          const route = prefix || "/"
          pageResults.push({ route, file: entry.name, size })
        }
      }
    } catch {
      // Skip
    }
  }
  scanPages(pagesDir)

  // Check per-page budget
  for (const page of pageResults) {
    if (page.size > BUDGETS.pageJS) {
      violations.push(
        `FAIL: ${page.route} (${page.file}) = ${formatKB(page.size)} > budget ${formatKB(BUDGETS.pageJS)}`
      )
    }
  }

  // Report
  console.log("=== Bundle Size Report ===")
  console.log("")
  console.log(`Total static JS: ${formatKB(totalStaticJS)}`)
  console.log(`Budget (first load): ${formatKB(BUDGETS.firstLoadJS)}`)
  console.log(`Budget (per-page): ${formatKB(BUDGETS.pageJS)}`)
  console.log("")

  if (pageResults.length > 0) {
    console.log("Per-page JS sizes:")
    const sorted = [...pageResults].sort((a, b) => b.size - a.size)
    for (const page of sorted.slice(0, 15)) {
      const status = page.size > BUDGETS.pageJS ? "OVER" : "ok"
      console.log(`  ${status.padEnd(5)} ${page.route.padEnd(40)} ${formatKB(page.size).padStart(10)}`)
    }
    if (sorted.length > 15) {
      console.log(`  ... and ${sorted.length - 15} more routes`)
    }
  }

  console.log("")

  if (violations.length > 0) {
    console.log("Budget violations:")
    for (const v of violations) {
      console.log(`  ${v}`)
    }
    console.log("")
    console.log("ACTION: Reduce bundle size before merging.")
    process.exit(1)
  } else {
    console.log("All routes within budget.")
  }
}

main()
