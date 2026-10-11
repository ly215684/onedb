// 无依赖生成 OneDB 应用图标 PNG (1024x1024, RGBA)
// electron-builder 会依据 build/icon.png 自动生成 .ico / .icns
import { deflateSync } from 'zlib'
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const W = 1024
const H = 1024
const __dirname = dirname(fileURLToPath(import.meta.url))

// ---- 画布 ----
const buf = new Uint8Array(W * H * 4)

function setPx(x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= W || y >= H) return
  const i = (y * W + x) * 4
  // 源在目标上的 alpha-over 合成
  const dstA = buf[i + 3] / 255
  const srcA = a / 255
  const outA = srcA + dstA * (1 - srcA)
  if (outA === 0) return
  buf[i] = Math.round((r * srcA + buf[i] * dstA * (1 - srcA)) / outA)
  buf[i + 1] = Math.round((g * srcA + buf[i + 1] * dstA * (1 - srcA)) / outA)
  buf[i + 2] = Math.round((b * srcA + buf[i + 2] * dstA * (1 - srcA)) / outA)
  buf[i + 3] = Math.round(outA * 255)
}

// 圆角矩形内部判定（带超采样抗锯齿）
function roundedAlpha(px, py, rx, ry, rw, rh, radius) {
  const samples = 3
  let hit = 0
  for (let sy = 0; sy < samples; sy++) {
    for (let sx = 0; sx < samples; sx++) {
      const x = px + (sx + 0.5) / samples - 0.5
      const y = py + (sy + 0.5) / samples - 0.5
      const dx = Math.max(Math.abs(x - (rx + rw / 2)) - (rw / 2 - radius), 0)
      const dy = Math.max(Math.abs(y - (ry + rh / 2)) - (rh / 2 - radius), 0)
      if (dx * dx + dy * dy <= radius * radius) hit++
    }
  }
  return hit / (samples * samples)
}

// 椭圆覆盖（超采样）
function ellipseAlpha(px, py, cx, cy, rxE, ryE) {
  const samples = 3
  let hit = 0
  for (let sy = 0; sy < samples; sy++) {
    for (let sx = 0; sx < samples; sx++) {
      const x = px + (sx + 0.5) / samples - 0.5
      const y = py + (sy + 0.5) / samples - 0.5
      const dx = (x - cx) / rxE
      const dy = (y - cy) / ryE
      if (dx * dx + dy * dy <= 1) hit++
    }
  }
  return hit / (samples * samples)
}

// 颜色
const cStart = [37, 99, 235] // #2563eb
const cEnd = [20, 184, 166] // #14b8a6

// 背景圆角矩形留白
const pad = 60
const bw = W - pad * 2
const bh = H - pad * 2
const radius = 210

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const bg = roundedAlpha(x, y, pad, pad, bw, bh, radius)
    if (bg > 0) {
      const t = (x + y) / (W + H)
      const r = Math.round(cStart[0] + (cEnd[0] - cStart[0]) * t)
      const g = Math.round(cStart[1] + (cEnd[1] - cStart[1]) * t)
      const b = Math.round(cStart[2] + (cEnd[2] - cStart[2]) * t)
      setPx(x, y, r, g, b, Math.round(bg * 255))
    }
  }
}

// 数据库标志：三个堆叠白色椭圆 (disc) + 柱体侧边
const cx = W / 2
const rx = 250
const ry = 70
const discYs = [H / 2 - 150, H / 2, H / 2 + 150]

// 白色覆盖，超采样
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    // 柱体侧面（连接最上与最下 disc 的矩形）
    let a = 0
    const bodyTop = discYs[0]
    const bodyBot = discYs[2]
    if (x >= cx - rx && x <= cx + rx && y >= bodyTop && y <= bodyBot) a = 1
    // 每个 disc 椭圆
    for (const dy of discYs) {
      a = Math.max(a, ellipseAlpha(x, y, cx, dy, rx, ry))
    }
    if (a > 0) {
      // 轻微的白色渐变提升质感（钳制避免 >255 溢出）
      const tt = Math.min(1, Math.max(0, (y - bodyTop) / (bodyBot - bodyTop)))
      const shade = 255 - Math.round(tt * 14)
      setPx(x, y, shade, shade, shade, Math.round(a * 255))
    }
  }
}

// 每个 disc 顶部加深色分隔弧线，突出堆叠层次
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    for (const dy of [discYs[1], discYs[2]]) {
      const dx = (x - cx) / rx
      const dyy = (y - dy) / ry
      const d = dx * dx + dyy * dyy
      if (y < dy && d >= 0.92 && d <= 1.0) {
        setPx(x, y, 30, 58, 138, 255) // #1e3a8a 分隔线
      }
    }
  }
}

// ---- PNG 编码 ----
const crcTable = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()
function crc32(bytes) {
  let c = -1
  for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const t = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(W, 0)
ihdr.writeUInt32BE(H, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 6 // color type RGBA
const raw = Buffer.alloc(H * (1 + W * 4))
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 4)] = 0 // filter none
  for (let x = 0; x < W; x++) {
    const si = (y * W + x) * 4
    const di = y * (1 + W * 4) + 1 + x * 4
    raw[di] = buf[si]
    raw[di + 1] = buf[si + 1]
    raw[di + 2] = buf[si + 2]
    raw[di + 3] = buf[si + 3]
  }
}
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
])

const out = resolve(__dirname, '../build/icon.png')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, png)
console.log('icon written:', out, png.length, 'bytes')
