import fs from 'node:fs'
import path from 'node:path'

export function loadJsonFixture<T = any>(relPath: string): T {
    const base = path.resolve(process.cwd(), 'src', 'test', 'fixtures')
    const full = path.join(base, relPath)
    const raw = fs.readFileSync(full, 'utf-8')
    return JSON.parse(raw) as T
}
