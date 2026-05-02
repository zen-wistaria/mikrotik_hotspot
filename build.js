import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'fs-extra';
import { glob } from 'glob';
import htmlMinifier from 'html-minifier-terser';
import UglifyJS from 'uglify-js';

const SRC_DIR = './src';
const RESULT_DIR = './results';

let configCache = null;

/**
 * Load config.json once then cache
 */
async function loadConfig() {
  if (configCache) return configCache;

  const configPath = path.join(process.cwd(), 'config.json');

  if (!(await fs.pathExists(configPath))) {
    throw new Error('config.json not found. Run: npm run genconfig');
  }

  const content = await fs.readFile(configPath, 'utf8');
  configCache = JSON.parse(content);

  return configCache;
}

/**
 * Get value nested from object using dot notation
 */
function getNestedValue(obj, keyPath) {
  return keyPath.split('.').reduce((acc, key) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return acc[key];
    }
    return undefined;
  }, obj);
}

/**
 * Replace directive @config('key')
 */
function processConfigDirectives(content, config) {
  return content.replace(/@config\(([^)]+)\)/g, (_, param) => {
    const key = param.trim().replace(/^['"]|['"]$/g, '');
    const value = getNestedValue(config, key);

    if (value === undefined) {
      console.warn(`⚠️ config '${key}' tidak ditemukan`);
      return '';
    }

    return String(value);
  });
}

/**
 * Evaluate condition @if with safe
 */
function evaluateCondition(expr, config) {
  const safeExpr = expr.replace(/config\.([a-zA-Z0-9_.]+)/g, (_, key) =>
    JSON.stringify(getNestedValue(config, key))
  );

  if (!/^[\w\s'"!=<>|&().+\-*/%]+$/.test(safeExpr)) {
    console.warn(`⚠️ Invalid condition: ${expr}`);
    return false;
  }

  try {
    return Function(`"use strict"; return (${safeExpr})`)();
  } catch {
    return false;
  }
}

/**
 * Process directive @if, @elseif, @else, @endif
 */
async function processIfDirectives(content, config) {
  const lines = content.split('\n');
  const output = [];
  const stack = [];

  for (const line of lines) {
    const ifMatch = line.match(/^\s*@if\((.+)\)\s*$/);

    if (ifMatch) {
      stack.push({
        condition: ifMatch[1],
        ifBlock: [],
        elseIf: [],
        elseBlock: null,
        mode: 'if',
      });
      continue;
    }

    const elseifMatch = line.match(/^\s*@elseif\((.+)\)/);
    if (elseifMatch && stack.length) {
      stack[stack.length - 1].elseIf.push({
        condition: elseifMatch[1],
        block: [],
      });
      stack[stack.length - 1].mode = 'elseif';
      continue;
    }

    if (/^\s*@else/.test(line) && stack.length) {
      const top = stack[stack.length - 1];
      top.mode = 'else';
      top.elseBlock = [];
      continue;
    }

    if (/^\s*@endif/.test(line)) {
      const top = stack.pop();

      let rendered = false;

      if (evaluateCondition(top.condition, config)) {
        output.push(...top.ifBlock);
        rendered = true;
      }

      if (!rendered) {
        for (const e of top.elseIf) {
          if (evaluateCondition(e.condition, config)) {
            output.push(...e.block);
            rendered = true;
            break;
          }
        }
      }

      if (!rendered && top.elseBlock) {
        output.push(...top.elseBlock);
      }

      continue;
    }

    if (stack.length === 0) {
      output.push(line);
    } else {
      const top = stack[stack.length - 1];

      if (top.mode === 'if') top.ifBlock.push(line);
      else if (top.mode === 'elseif')
        top.elseIf[top.elseIf.length - 1].block.push(line);
      else top.elseBlock.push(line);
    }
  }

  return output.join('\n');
}

/**
 * Process directive @foreach
 */
async function processForeachDirectives(content, config) {
  const regex = /@foreach\(([^)]+)\)\s*([\s\S]*?)@endforeach/g;

  let match = regex.exec(content);
  let result = content;

  while (match !== null) {
    const [full, params, inner] = match;

    const asMatch = params.match(/^(.+?)\s+as\s+(?:(\w+)\s*=>\s*)?(\w+)$/);
    if (!asMatch) continue;

    const arrayPath = asMatch[1].replace(/^config\./, '').trim();
    const keyVar = asMatch[2];
    const itemVar = asMatch[3];

    const arr = getNestedValue(config, arrayPath);
    if (!Array.isArray(arr)) continue;

    let loopResult = '';

    for (let i = 0; i < arr.length; i++) {
      let block = inner;
      const item = arr[i];

      if (keyVar) {
        block = block.replace(
          new RegExp(`\\{\\{\\s*${keyVar}\\s*\\}\\}`, 'g'),
          i
        );
      }

      if (typeof item === 'object') {
        block = block.replace(
          new RegExp(`\\{\\{\\s*${itemVar}\\.(\\w+)\\s*\\}\\}`, 'g'),
          (_, prop) => item[prop] ?? ''
        );
      } else {
        block = block.replace(
          new RegExp(`\\{\\{\\s*${itemVar}\\s*\\}\\}`, 'g'),
          String(item)
        );
      }

      // chain directive
      block = processConfigDirectives(block, config);
      block = await processIfDirectives(block, config);

      loopResult += block;
    }

    result = result.replace(full, loopResult);

    match = regex.exec(content);
  }

  return result;
}

/**
 * Process directive @include recursively
 */
async function processIncludes(baseDir, content, config, visited = new Set()) {
  const regex = /@include\(([^)]+)\)/g;

  let match = regex.exec(content);
  let result = content;

  while (match !== null) {
    const [full, raw] = match;
    const file = raw.trim().replace(/^['"]|['"]$/g, '');

    const fullPath = path.resolve(baseDir, file);

    if (visited.has(fullPath)) continue;

    visited.add(fullPath);

    if (!(await fs.pathExists(fullPath))) continue;

    let fileContent = await fs.readFile(fullPath, 'utf8');

    fileContent = processConfigDirectives(fileContent, config);
    fileContent = await processForeachDirectives(
      fileContent,
      config,
      path.dirname(fullPath)
    );
    fileContent = await processIfDirectives(fileContent, config);
    fileContent = await processIncludes(
      path.dirname(fullPath),
      fileContent,
      config,
      visited
    );

    result = result.replace(full, fileContent);

    match = regex.exec(content);
  }

  return result;
}

/**
 * Minify HTML
 */
async function minifyHTML(html) {
  return htmlMinifier.minify(html, {
    collapseWhitespace: true,
    removeComments: true,
    removeRedundantAttributes: true,
    removeScriptTypeAttributes: true,
    removeStyleLinkTypeAttributes: true,
    useShortDoctype: true,
    // removeEmptyAttributes: true,
    // removeEmptyElements: true,
    // removeOptionalTags: true,
    minifyJS: true,
    minifyCSS: true,

    // ignore mikrotik $(...) directive
    ignoreCustomFragments: [/\$\([^)]*\)/g],
  });
}

/**
 * Generate hash file (for cache busting)
 */
function generateHash(content) {
  return crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
}
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build Tailwind CSS + hash
 */
async function buildTailwind() {
  console.log('🎨 Building Tailwind...');

  const inputCss = path.join(SRC_DIR, 'css/input.css');
  const tempCss = path.join(RESULT_DIR, 'css/style.tmp.css');

  await fs.ensureDir(path.dirname(tempCss));

  execSync(`npx tailwindcss -i "${inputCss}" -o "${tempCss}" --minify`, {
    stdio: 'inherit',
  });

  const css = await fs.readFile(tempCss, 'utf8');
  const hash = generateHash(css);

  const finalName = `style.${hash}.css`;
  const finalPath = path.join(RESULT_DIR, 'css', finalName);

  await fs.move(tempCss, finalPath, { overwrite: true });

  return finalName;
}

/**
 * Process JS (minify + hash)
 */
async function processJSFiles() {
  const files = glob.sync(`${SRC_DIR}/**/*.js`);
  const mapping = {};

  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    const result = UglifyJS.minify(content);

    if (result.error) continue;

    const hash = generateHash(result.code);
    const rel = path.relative(SRC_DIR, file);

    const newName = rel.replace(/\.js$/, `.${hash}.js`);
    const dest = path.join(RESULT_DIR, newName);

    await fs.ensureDir(path.dirname(dest));
    await fs.writeFile(dest, result.code);

    mapping[rel.replace(/\\/g, '/')] = newName.replace(/\\/g, '/');
  }

  return mapping;
}

/**
 * Process HTML (FULL PIPELINE)
 */
async function processHTMLFiles(cssFileName, jsMapping) {
  const config = await loadConfig();

  const files = glob.sync(`${SRC_DIR}/**/*.html`, {
    ignore: [`${SRC_DIR}/partials/**/*`],
  });

  for (const file of files) {
    let content = await fs.readFile(file, 'utf8');

    // replace CSS
    content = content.replace(
      /(href=["'](?:\.\.\/|\.\/)*css\/)style\.css(["'])/g,
      `$1${cssFileName}$2`
    );

    // replace JS
    for (const [oldRef, newRef] of Object.entries(jsMapping)) {
      const escaped = escapeRegex(oldRef);

      content = content.replace(
        new RegExp(`(src=["'])(\\.{1,2}\\/)*${escaped}(["'])`, 'g'),
        (match, p1, p2, p3) => {
          return `${p1}${p2 || ""}${newRef}${p3}`;
        }
      );
    }

    const baseDir = path.dirname(file);

    // full directive chain
    content = processConfigDirectives(content, config);
    content = await processForeachDirectives(content, config, baseDir);
    content = await processIfDirectives(content, config);
    content = await processIncludes(baseDir, content, config);

    const minified = await minifyHTML(content);

    const dest = path.join(RESULT_DIR, path.relative(SRC_DIR, file));

    await fs.ensureDir(path.dirname(dest));
    await fs.writeFile(dest, minified);

    console.log(`✅ ${dest}`);
  }
}

/**
 * Copy other assets (img, font, dll)
 */
async function copyOtherFiles() {
  const files = glob.sync(`${SRC_DIR}/**/*`, {
    nodir: true,
    ignore: [
      `${SRC_DIR}/**/*.html`,
      `${SRC_DIR}/**/*.js`,
      `${SRC_DIR}/**/*.css`,
      `${SRC_DIR}/partials/**/*`,
    ],
  });

  for (const file of files) {
    const dest = path.join(RESULT_DIR, path.relative(SRC_DIR, file));
    await fs.ensureDir(path.dirname(dest));
    await fs.copy(file, dest);
  }
}

/**
 * Generate errors.txt
 */
async function generateErrorsFile() {
  const config = await loadConfig();
  const errorsFile = path.join(RESULT_DIR, 'errors.txt');
  let content;
  if (config.errors_lang === 'en') {
    content = `
internal-error = internal error ($(error-orig))
config-error = configuration error ($(error-orig))
not-logged-in = you are not logged in (ip $(ip))
ippool-empty = cannot assign ip address - no more free addresses from pool
shutting-down = hotspot service is shutting down
user-session-limit = no more sessions are allowed for user $(username)
license-session-limit = session limit reached ($(error-orig))
wrong-mac-username = invalid username ($(username)): this MAC address is not yours
chap-missing = web browser did not send challenge response (try again, enable JavaScript)
invalid-username = invalid username or password
otp-already-used = this OTP token is already used
invalid-mac = user $(username) is not allowed to log in from this MAC address
uptime-limit = user $(username) has reached uptime limit
traffic-limit = user $(username) has reached traffic limit
radius-timeout = RADIUS server is not responding
auth-in-progress = already authorizing, retry later
radius-reply = $(error-orig)
`;
  } else if (config.errors_lang === 'id') {
    content = `
internal-error = error internal ($(error-orig))
config-error = error konfigurasi ($(error-orig))
not-logged-in = lo belum login (ip $(ip))
ippool-empty = ga bisa dapet IP - alamat IP di pool udah habis
shutting-down = layanan hotspot lagi dimatiin
user-session-limit = sesi buat user $(username) udah mentok, ga bisa nambah lagi
license-session-limit = limit sesi udah kena ($(error-orig))
wrong-mac-username = username ga valid ($(username)): MAC address ini bukan punya lo
chap-missing = browser lo ga ngirim response challenge (coba lagi, aktifin JavaScript)
invalid-username = username atau password salah
otp-already-used = token OTP ini udah kepake
invalid-mac = user $(username) ga diizinin login dari MAC address ini
uptime-limit = user $(username) udah nyampe batas waktu pemakaian
traffic-limit = user $(username) udah nyampe batas kuota
radius-timeout = server RADIUS ga ngerespon
auth-in-progress = lagi proses autentikasi, coba lagi nanti
radius-reply = $(error-orig)
`;
  }
  if (content) {
    fs.writeFile(errorsFile, content);
    console.log(`✅ ${errorsFile}`);
  }
}

/**
 * Main build
 */
async function build() {
  try {
    await fs.remove(RESULT_DIR);
    await fs.ensureDir(RESULT_DIR);

    console.log('🚀 Build started...\n');

    await loadConfig();

    const cssFile = await buildTailwind();
    const jsMap = await processJSFiles();

    await processHTMLFiles(cssFile, jsMap);
    await copyOtherFiles();
    await generateErrorsFile();

    console.log('\n✨ Build success!');
  } catch (err) {
    console.error('❌ Build failed:', err);
  }
}

build();
