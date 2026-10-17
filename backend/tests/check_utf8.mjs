// 检测前端源文件是否可被严格 UTF-8 解码
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.argv[2]
const bad = []

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) { walk(p); continue }
    if (!/\.(tsx?|css|html)$/.test(name)) continue
    const buf = readFileSync(p)
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(buf)
    } catch {
      bad.push(p)
    }
  }
}

walk(root)
if (bad.length === 0) console.log('ALL_OK')
else { console.log('BAD_FILES:'); bad.forEach(f => console.log(f)) }
