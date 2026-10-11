// 版本号更新脚本
// 用法:
//   node scripts/version.mjs patch            # 0.1.0 -> 0.1.1
//   node scripts/version.mjs minor            # 0.1.0 -> 0.2.0
//   node scripts/version.mjs major            # 0.1.0 -> 1.0.0
//   node scripts/version.mjs 1.2.3            # 直接指定版本
//   node scripts/version.mjs patch --tag      # 更新后自动 git commit + tag v<version>
//   node scripts/version.mjs patch --tag --push   # 并推送当前分支与 tag 到远端(触发 Release)
import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkgPath = resolve(__dirname, '../package.json')

const args = process.argv.slice(2)
const flags = new Set(args.filter((a) => a.startsWith('--')))
const positional = args.filter((a) => !a.startsWith('--'))
const target = positional[0]

if (!target) {
  console.error('用法: node scripts/version.mjs <major|minor|patch|x.y.z> [--tag] [--push]')
  process.exit(1)
}

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const oldVersion = pkg.version
const re = /^(\d+)\.(\d+)\.(\d+)$/
const m = oldVersion.match(re)
if (!m) {
  console.error(`当前版本号不是标准的 x.y.z 格式: ${oldVersion}`)
  process.exit(1)
}

let next
if (['major', 'minor', 'patch'].includes(target)) {
  let [maj, min, pat] = m.slice(1).map(Number)
  if (target === 'major') {
    maj++; min = 0; pat = 0
  } else if (target === 'minor') {
    min++; pat = 0
  } else {
    pat++
  }
  next = `${maj}.${min}.${pat}`
} else if (re.test(target)) {
  next = target
} else {
  console.error(`无效的版本参数: ${target} (应为 major|minor|patch 或 x.y.z)`)
  process.exit(1)
}

if (next === oldVersion) {
  console.error(`新版本号与当前一致: ${next}`)
  process.exit(1)
}

pkg.version = next
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8')
console.log(`版本号已更新: ${oldVersion} -> ${next}`)

if (flags.has('--tag')) {
  const tag = `v${next}`
  try {
    execSync(`git add package.json`, { stdio: 'inherit' })
    execSync(`git commit -m "chore: release ${next}"`, { stdio: 'inherit' })
    execSync(`git tag ${tag}`, { stdio: 'inherit' })
    console.log(`已创建提交并打标签: ${tag}`)
    if (flags.has('--push')) {
      // 远端不一定叫 origin（可能配置为其他别名），优先取当前分支跟踪的远端，否则回退 origin
      let remote = 'origin'
      try {
        remote = execSync('git rev-parse --abbrev-ref @{u}', { encoding: 'utf8' }).trim().split('/')[0] || 'origin'
      } catch {
        console.log('提示: 当前分支没有上游远端，将尝试推送到 origin。')
      }
      // 显式推送当前分支和本次 tag，避免 --follow-tags 因默认远端不匹配而静默失败
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim()
      execSync(`git push ${remote} refs/heads/${branch} refs/tags/${tag}`, { stdio: 'inherit' })
      console.log(`已推送 ${branch} 和 ${tag} 到 ${remote}，GitHub Actions 将触发打包发布。`)
    } else {
      console.log(`提示: 运行 "git push --follow-tags" 推送标签以触发 Release。`)
    }
  } catch {
    console.error('git 操作失败，请检查仓库状态(是否有未提交改动 / git 是否可用)。')
    process.exit(1)
  }
}
