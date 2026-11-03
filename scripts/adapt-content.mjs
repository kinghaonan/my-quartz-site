/**
 * content/ → content-build/：Volantis 语法转语义 HTML，原文不动。
 * 构建：npx quartz build -d content-build
 *
 * 两个不能踩的坑：
 * - content-build 不能写进 .gitignore（Quartz 的 globby 会把整个目录当成 ignored，扫到 0 篇）。
 * - 代码块和 `{% raw %}` 必须先保护，否则 Volantis 语法文档里的示例会被误转换。
 */
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function arg(name, fallback) {
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`))
  if (eq) return eq.slice(name.length + 3)
  const i = process.argv.indexOf(`--${name}`)
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) {
    return process.argv[i + 1]
  }
  return fallback
}

const SRC = path.resolve(ROOT, arg("src", "content"))
const OUT = path.resolve(ROOT, arg("out", "content-build"))
const IMAGE_ROOT = path.resolve(arg("image-root", "D:/kinghaonan.github.io/public/image"))

if (!fs.existsSync(SRC)) {
  console.error(`[adapt] 源目录不存在：${SRC}`)
  process.exit(1)
}
if (OUT === SRC || OUT.startsWith(SRC + path.sep)) {
  console.error("[adapt] 输出目录不能等于或位于源目录内")
  process.exit(1)
}

const COLOR_WORDS = new Set([
  "blue", "red", "yellow", "green", "gray", "grey", "pink", "purple", "cyan", "orange", "gold",
])
const TYPE_WORDS = new Set([
  "info", "error", "success", "quote", "warning", "idea", "danger", "bug", "note", "default",
])

const esc = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")

function classesFrom(args) {
  const out = []
  for (const word of String(args || "").trim().split(/\s+/).filter(Boolean)) {
    const lower = word.toLowerCase()
    if (COLOR_WORDS.has(lower)) out.push(`is-${lower}`)
    else if (TYPE_WORDS.has(lower)) out.push(`t-${lower}`)
    else if (lower === "theme") out.push("is-gold")
  }
  return out.join(" ")
}

function makeStash(prefix) {
  const items = []
  return {
    protect(text) {
      const token = `\u0000${prefix}${items.length}\u0000`
      items.push(text)
      return token
    },
    restore(text) {
      return text.replace(new RegExp(`\u0000${prefix}(\\d+)\u0000`, "g"), (_, i) => items[Number(i)])
    },
  }
}

function protectFences(src, stash) {
  const lines = src.split("\n")
  const out = []
  for (let i = 0; i < lines.length; ) {
    const open = lines[i].match(/^([ \t]*)(`{3,}|~{3,})(.*)$/)
    if (!open) {
      out.push(lines[i++])
      continue
    }
    const marker = open[2][0]
    const length = open[2].length
    const block = [lines[i++]]
    while (i < lines.length) {
      const line = lines[i++]
      block.push(line)
      const close = line.match(/^[ \t]*(`{3,}|~{3,})\s*$/)
      if (close && close[1][0] === marker && close[1].length >= length) break
    }
    out.push(stash.protect(block.join("\n")))
  }
  return out.join("\n")
}

function protectInlineCode(src, stash) {
  let out = ""
  let i = 0
  while (i < src.length) {
    if (src[i] !== "`") {
      out += src[i++]
      continue
    }
    let n = 1
    while (src[i + n] === "`") n++
    const delim = "`".repeat(n)
    const end = src.indexOf(delim, i + n)
    if (end < 0) {
      out += src.slice(i)
      break
    }
    out += stash.protect(src.slice(i, end + n))
    i = end + n
  }
  return out
}

function protectRaw(src, stash) {
  return src.replace(/\{%\s*raw\s*%\}([\s\S]*?)\{%\s*endraw\s*%\}/gi, (_, inner) =>
    stash.protect(inner),
  )
}

function replaceBlock(src, tag, render) {
  const re = new RegExp(
    `^([ \\t]*)\\\{%\\s*${tag}(?:\\s+([^\\n]*?))?\\s*%\\}([\\s\\S]*?)\\\{%\\s*end${tag}\\s*%\\}`,
    "gim",
  )
  return src.replace(re, (_, indent, args, inner) => render(indent, (args || "").trim(), inner))
}

function splitFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!m) return { head: "", body: raw, title: "" }
  const title = (m[1].match(/^title:\s*(.*?)\s*$/im) || [])[1] || ""
  return { head: `---\n${m[1]}\n---\n\n`, body: m[2], title }
}

/* 正文第一个标题就是 H1 且与 frontmatter 标题一致时去掉它，避免页头重复；
   其余情况（没有 frontmatter、或 H1 是章节名）一律保留 */
function dropDuplicateTitleHeading(body, fmTitle) {
  if (!fmTitle) return body
  const norm = (s) => s.replace(/[`*_~\s]/g, "").toLowerCase()
  const m = body.match(/^ {0,3}#\s+(.+?)\s*$/m)
  if (!m) return body
  if (/^ {0,3}#{1,6}\s+/m.test(body.slice(0, m.index))) return body
  if (norm(m[1]) !== norm(fmTitle)) return body
  return body.slice(0, m.index) + body.slice(m.index + m[0].length).replace(/^\r?\n+/, "\n")
}

function walk(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (entry.isFile()) out.push(full)
  }
  return out
}

const copiedImages = new Set()
const missingImages = new Set()
const imageRootExists = fs.existsSync(IMAGE_ROOT)

function copyReferencedImage(rel) {
  const clean = rel.replace(/[?#].*$/, "")
  // 图片根目录不存在（CI 上就没有 D:/kinghaonan.github.io）也要记下来，
  // 否则会静默发布一堆破图
  if (!imageRootExists) {
    missingImages.add(clean)
    return false
  }
  const source = path.resolve(IMAGE_ROOT, clean)
  if (!source.startsWith(IMAGE_ROOT + path.sep) || !fs.existsSync(source)) {
    missingImages.add(clean)
    return false
  }
  const dest = path.join(OUT, "image", clean)
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(source, dest)
    copiedImages.add(clean)
  }
  return true
}

function normalizeImageUrl(url, noteDir) {
  if (!url || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url)) return url
  const m = url.match(/(?:^|\/)image\/(.+)$/)
  if (!m) return url
  const rel = m[1]
  if (!copyReferencedImage(rel)) return url
  return path.posix.relative(noteDir, `image/${rel}`) || "."
}

function rewriteImages(src, noteDir) {
  src = src.replace(
    /\]\(([^)\s]+)((?:\s+(?:"[^"]*"|'[^']*'))?)\)/g,
    (whole, url, title = "") => {
      const next = normalizeImageUrl(url, noteDir)
      return next === url ? whole : `](${next}${title})`
    },
  )
  src = src.replace(/(\b(?:src|href)=)(["'])([^"']+)\2/gi, (whole, attr, quote, url) => {
    const next = normalizeImageUrl(url, noteDir)
    return next === url ? whole : `${attr}${quote}${next}${quote}`
  })
  return src
}

function transformVolantis(body, relPosix) {
  const fences = makeStash("F")
  const inline = makeStash("C")
  const raw = makeStash("R")
  const fileHash = crypto.createHash("sha1").update(relPosix).digest("hex").slice(0, 6)
  const tabState = { n: 0 }

  let s = protectFences(body, fences)
  s = protectInlineCode(s, inline)
  s = protectRaw(s, raw)

  s = replaceBlock(s, "timenode", (indent, title, inner) => {
    return `${indent}<div class="v-timenode"><div class="v-timenode-title">${esc(title)}</div><div class="v-timenode-body">\n\n${inner.trim()}\n\n${indent}</div></div>`
  })

  s = replaceBlock(s, "timeline", (indent, _args, inner) => {
    return `${indent}<div class="v-timeline">\n${inner.trim()}\n${indent}</div>`
  })

  s = replaceBlock(s, "gallery", (indent, args, inner) => {
    let cls = "v-gallery"
    let style = ""
    if (/^stretch/i.test(args)) {
      cls += " v-gallery--stretch"
      const parts = args.split("::")
      const cols = Number.parseInt(parts[1], 10) || 2
      const gap = Number.parseInt(parts[2], 10)
      style = ` style="--v-cols:${cols}${gap ? `;--v-gap:${gap}px` : ""}"`
    }
    return `${indent}<div class="${cls}"${style}>\n${inner.trim()}\n${indent}</div>`
  })

  s = replaceBlock(s, "noteblock", (indent, args, inner) => {
    const cls = classesFrom(args)
    return `${indent}<div class="v-noteblock${cls ? ` ${cls}` : ""}">\n\n${inner.trim()}\n\n${indent}</div>`
  })

  s = replaceBlock(s, "folding", (indent, args, inner) => {
    let color = ""
    let title = args || "详情"
    const m = title.match(/^([a-z]+)\s*::\s*([\s\S]*)$/i)
    if (m) {
      if (COLOR_WORDS.has(m[1].toLowerCase())) color = ` is-${m[1].toLowerCase()}`
      title = m[2].trim()
    }
    return `${indent}<details class="v-folding${color}"><summary>${esc(title || "详情")}</summary><div class="v-folding-body">\n\n${inner.trim()}\n\n${indent}</div></details>`
  })

  s = replaceBlock(s, "tabs", (indent, _args, inner) => {
    const panes = []
    const re = /<!--\s*tab\s+([\s\S]*?)\s*-->\s*([\s\S]*?)\s*<!--\s*endtab\s*-->/g
    let m
    while ((m = re.exec(inner))) panes.push({ title: m[1].trim(), body: m[2].trim() })
    if (!panes.length) return inner
    if (panes.length > 8) {
      console.warn(`[adapt] ${relPosix}: tabs 有 ${panes.length} 个分栏，CSS 只覆盖前 8 个`)
    }
    const group = ++tabState.n
    const name = `vtab-${fileHash}-${group}`
    const inputs = panes
      .map((_, i) => `${indent}<input class="v-tab-input" type="radio" name="${name}" id="${name}-${i}"${i === 0 ? " checked" : ""}>`)
      .join("\n")
    const labels = panes
      .map((pane, i) => `${indent}<label class="v-tabs-tab" for="${name}-${i}">${esc(pane.title)}</label>`)
      .join("\n")
    const bodies = panes
      .map((pane, i) => `${indent}<div class="v-tabs-pane">\n\n${pane.body}\n\n${indent}</div>`)
      .join("\n")
    return `${indent}<div class="v-tabs">\n${inputs}\n${indent}<div class="v-tabs-nav">\n${labels}\n${indent}</div>\n${indent}<div class="v-tabs-panes">\n${bodies}\n${indent}</div>\n${indent}</div>`
  })

  s = s.replace(/\{%\s*note\s+([^%:]*?)\s*::\s*([^\n]*?)\s*%\}/gi, (_, type, text) => {
    const cls = classesFrom(type)
    return `<div class="v-note${cls ? ` ${cls}` : ""}">${text.trim()}</div>`
  })

  s = s.replace(/\{%\s*note\s+([^%\n]+?)\s*%\}/gi, (_, text) => {
    return `<div class="v-note">${text.trim()}</div>`
  })

  s = s.replace(/\{%\s*btn\s*,?\s*([^\n]*?)\s*%\}/gi, (_, args) => {
    const parts = args.split(",").map((x) => x.trim()).filter(Boolean)
    let url = "#"
    let text = "按钮"
    if (parts.length >= 2) {
      if (/^https?:\/\//.test(parts[0])) {
        url = parts[0]
        text = parts[1]
      } else {
        text = parts[0]
        url = parts[1]
      }
    } else if (parts.length === 1) {
      text = parts[0]
    }
    return `<a class="v-btn" href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>`
  })

  s = s.replace(/\{%\s*link\s+([^\n]*?)\s*%\}/gi, (_, args) => {
    const [title, url, icon] = args.split("::").map((x) => (x || "").trim())
    const href = url || "#"
    const iconHtml = icon
      ? `<img class="v-link-icon" src="${esc(icon)}" alt="" loading="lazy">`
      : ""
    return `<a class="v-link" href="${esc(href)}" target="_blank" rel="noopener">${iconHtml}<span class="v-link-title">${esc(title || href)}</span></a>`
  })

  s = s.replace(/\{%\s*(video|audio)\s+([^,%，\s]+)[^\n]*?%\}/gi, (_, kind, src) => {
    const tag = kind.toLowerCase()
    return `<div class="v-media"><${tag} controls preload="metadata" src="${esc(src)}"></${tag}></div>`
  })

  s = s.replace(/\{%\s*p\s+([^,%]+?)\s*,\s*([\s\S]*?)\s*%\}/gi, (_, cls, text) => {
    const names = String(cls)
      .trim()
      .split(/\s+/)
      .map((x) => `vp-${x.replace(/[^a-zA-Z0-9_-]/g, "")}`)
      .filter(Boolean)
      .join(" ")
    return `<p class="v-p ${names}">${text.trim()}</p>`
  })

  s = s.replace(/\{%\s*span\s+([^,%]+?)\s*,\s*([\s\S]*?)\s*%\}/gi, (_, cls, text) => {
    const names = String(cls)
      .trim()
      .split(/\s+/)
      .map((x) => `vs-${x.replace(/[^a-zA-Z0-9_-]/g, "")}`)
      .filter(Boolean)
      .join(" ")
    return `<span class="v-span ${names}">${text.trim()}</span>`
  })

  s = s.replace(/\{%\s*u\s*%\}([\s\S]*?)\{%\s*endu\s*%\}/gi, "<u>$1</u>")
  s = s.replace(/\{%\s*emp\s*%\}([\s\S]*?)\{%\s*endemp\s*%\}/gi, "<em>$1</em>")
  s = s.replace(/\{%\s*del\s*%\}([\s\S]*?)\{%\s*enddel\s*%\}/gi, "<del>$1</del>")
  s = s.replace(/\{%\s*wavy\s*%\}([\s\S]*?)\{%\s*endwavy\s*%\}/gi, '<span class="v-wavy">$1</span>')

  s = s.replace(/\{%\s*(u|emp|del|wavy)\s+([^%\n]+?)\s*%\}/gi, (_, kind, text) => {
    if (kind.toLowerCase() === "wavy") return `<span class="v-wavy">${text.trim()}</span>`
    return `<${kind.toLowerCase()}>${text.trim()}</${kind.toLowerCase()}>`
  })

  const leftover = (s.match(/\{%/g) || []).length
  if (leftover > 0) {
    console.warn(`[adapt] ${relPosix}: 仍有 ${leftover} 处未解析的 {%`)
  }

  s = raw.restore(s)
  s = inline.restore(s)
  s = fences.restore(s)

  return { text: s, leftover }
}

fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })

const files = walk(SRC)
let mdCount = 0
let assetCount = 0
let leftoverCount = 0

for (const file of files) {
  const rel = path.relative(SRC, file)
  const relPosix = rel.split(path.sep).join("/")
  if (!rel.toLowerCase().endsWith(".md")) {
    const dest = path.join(OUT, rel)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(file, dest)
    assetCount++
    continue
  }

  try {
    const raw = fs.readFileSync(file, "utf8").replace(/^\uFEFF+/, "").replace(/\r\n/g, "\n")
    const { head, body, title } = splitFrontmatter(raw)
    const noteDir = path.posix.dirname(relPosix) || "."
    const transformed = transformVolantis(dropDuplicateTitleHeading(body, title), relPosix)
    const output = head + rewriteImages(transformed.text, noteDir)
    const dest = path.join(OUT, rel)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.writeFileSync(dest, output, "utf8")
    mdCount++
    leftoverCount += transformed.leftover
  } catch (error) {
    console.error(`[adapt] ${relPosix} 处理失败：${error && error.message ? error.message : error}`)
    process.exitCode = 1
  }
}

const gitignore = path.join(ROOT, ".gitignore")
if (fs.existsSync(gitignore)) {
  const ignored = fs
    .readFileSync(gitignore, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (ignored.includes("content-build") || ignored.includes("content-build/")) {
    console.warn(
      "[adapt] ⚠ content-build 出现在 .gitignore；Quartz 的 globby 会扫不到内容，请改用 .git/info/exclude",
    )
  }
}

console.log(`[adapt] ${mdCount} 篇 → ${path.relative(ROOT, OUT) || OUT}`)
console.log(`[adapt] 复制资产 ${assetCount} 个，引用图片 ${copiedImages.size} 个`)
if (missingImages.size) {
  const list = [...missingImages].slice(0, 8).join(", ")
  const why = imageRootExists ? "" : `（找不到图片根目录 ${IMAGE_ROOT}）`
  console.error(
    `[adapt] ${missingImages.size} 张 /image/ 图片没能搬进构建${why}：${list}${missingImages.size > 8 ? " …" : ""}`,
  )
  console.error("[adapt] 请把图片放进笔记正文所在文件夹的 attachments/ 并改成相对引用，构建已标记失败")
  process.exitCode = 1
}
if (leftoverCount) {
  console.warn(`[adapt] 共 ${leftoverCount} 处 Volantis 标签未解析，构建已标记失败`)
  process.exitCode = 1
}
