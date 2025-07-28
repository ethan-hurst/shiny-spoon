/**
 * File System Utilities
 * Helper functions for file operations
 */

import { promises as fs } from 'fs'
import { dirname, join } from 'path'
import { logger } from './logger'

/**
 * Ensure a directory exists
 */
export async function ensureDir(path: string): Promise<void> {
  try {
    await fs.mkdir(dirname(path), { recursive: true })
  } catch (error) {
    // Directory might already exist
  }
}

/**
 * Write a file with directory creation
 */
export async function writeFile(path: string, content: string): Promise<void> {
  await ensureDir(path)
  await fs.writeFile(path, content, 'utf-8')
  logger.file(path)
}

/**
 * Check if a file exists
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

/**
 * Read a file
 */
export async function readFile(path: string): Promise<string> {
  return fs.readFile(path, 'utf-8')
}

/**
 * Get project root directory
 */
export function getProjectRoot(): string {
  return process.cwd()
}

/**
 * Resolve path relative to project root
 */
export function resolvePath(...paths: string[]): string {
  return join(getProjectRoot(), ...paths)
}