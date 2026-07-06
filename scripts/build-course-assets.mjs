import fs from 'fs'
import path from 'path'

const root = process.cwd()
const sourceDir = path.join(root, 'courses')
const outputDir = path.join(root, 'public', 'images', 'courses')
const allowed = new Set(['.png', '.jpg', '.jpeg', '.webp'])

if (!fs.existsSync(sourceDir)) {
  console.error(`courses 폴더가 없습니다: ${sourceDir}`)
  process.exit(1)
}

fs.mkdirSync(outputDir, { recursive: true })

const files = fs.readdirSync(sourceDir)
  .filter((file) => allowed.has(path.extname(file).toLowerCase()))

if (files.length === 0) {
  console.warn('복사할 골프장 이미지가 없습니다. 예: courses/hillsky.png, courses/bomun.png')
}

for (const file of files) {
  const src = path.join(sourceDir, file)
  const dest = path.join(outputDir, file)
  fs.copyFileSync(src, dest)
  console.log(`copied: courses/${file} -> public/images/courses/${file}`)
}

console.log('Course hero assets build complete.')
