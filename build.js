import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import CleanCSS from 'clean-css';
import fs from 'fs-extra';
import { glob } from 'glob';
import htmlMinifier from 'html-minifier-terser';
import UglifyJS from 'uglify-js';

const SRC_DIR = './src';
const RESULT_DIR = './results';

// Function to process include directive @include('file.html')
async function processIncludes(filePath, content, visited = new Set()) {
  const includeRegex = /@include\(([^)]+)\)/g;
  let newContent = content;
  const baseDir = path.dirname(filePath);

  let match = includeRegex.exec(newContent);

  while (match !== null) {
    let includePath = match[1].trim();

    if (
      (includePath.startsWith("'") && includePath.endsWith("'")) ||
      (includePath.startsWith('"') && includePath.endsWith('"'))
    ) {
      includePath = includePath.slice(1, -1);
    }

    const fullIncludePath = path.resolve(baseDir, includePath);

    if (visited.has(fullIncludePath)) {
      match = includeRegex.exec(newContent);
      continue;
    }

    visited.add(fullIncludePath);

    if (await fs.pathExists(fullIncludePath)) {
      let includeContent = await fs.readFile(fullIncludePath, 'utf8');

      // 🔄 urutan processing
      includeContent = await processConfigDirectives(includeContent);
      includeContent = await processIfDirectives(includeContent);
      includeContent = await processIncludes(
        fullIncludePath,
        includeContent,
        visited
      );

      newContent = newContent.replace(match[0], includeContent);

      // ⚠️ important: reset regex because string changed
      includeRegex.lastIndex = 0;
    } else {
      console.error(`❌ File not found: ${fullIncludePath}`);
    }

    visited.delete(fullIncludePath);

    match = includeRegex.exec(newContent);
  }

  return newContent;
}

// Function to process config directive @config('...')
const configCache = null;
async function loadConfig() {
  if (configCache) return configCache;

  const configPath = path.join(process.cwd(), 'config.json');
  if (!(await fs.pathExists(configPath))) {
    console.error('\n❌ ERROR: config.json not found in root folder!');
    console.error('📝 Please generate it first by running:');
    console.error('   npm run genconfig\n');
    process.exit(1);
  }

  try {
    const content = await fs.readFile(configPath, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    console.error('❌ Failed to parse config.json:', e.message);
    console.error('📝 Please check your src/config.json syntax.\n');
    process.exit(1);
  }
}

function getNestedValue(obj, keyPath) {
  // Supports key like 'site.title' or 'title'
  const keys = keyPath.split('.');
  let value = obj;
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return undefined;
    }
  }
  return value;
}

async function processConfigDirectives(content) {
  const config = await loadConfig();
  const regex = /@config\(([^)]+)\)/g;
  return content.replace(regex, (_match, param) => {
    let keyPath = param.trim();

    if (
      (keyPath.startsWith("'") && keyPath.endsWith("'")) ||
      (keyPath.startsWith('"') && keyPath.endsWith('"'))
    ) {
      keyPath = keyPath.slice(1, -1);
    }
    const value = getNestedValue(config, keyPath);
    if (value === undefined) {
      console.warn(`⚠️ Key config '${keyPath}' tidak ditemukan di config.json`);
      return '';
    }
    return String(value);
  });
}

// Function to process if directive @if(...), @else(...), @endif(...)
function evaluateCondition(expr, config) {
  // Replace config.key pattern (supports nested like config.site.title)
  expr = expr.replace(
    /config\.([a-zA-Z_][a-zA-Z0-9_.]*)/g,
    (_match, keyPath) => {
      const value = getNestedValue(config, keyPath);
      // Convert to JSON string to be safe for comparison (string, number, boolean)
      return value !== undefined ? JSON.stringify(value) : 'null';
    }
  );

  // If there is still config('...') give a warning and assume false
  if (expr.includes('config(')) {
    console.warn(`⚠️ Avoid config('key'), use config.key: ${expr}`);
    return false;
  }

  // Validate expression only contains safe characters
  const allowedPattern = /^[\w\s'"!=<>|&().+\-*/%]+$/;
  if (!allowedPattern.test(expr)) {
    console.warn(`⚠️ Invalid expression: ${expr}`);
    return false;
  }

  try {
    const fn = new Function(`return (${expr})`);
    return fn();
  } catch (e) {
    console.warn(`⚠️ Failed to evaluate condition: ${expr}`, e.message);
    return false;
  }
}

async function processIfDirectives(content) {
  const config = await loadConfig();
  const lines = content.split('\n');
  const output = [];
  const stack = []; // stack for blocks that haven't been closed

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // @if(condition)
    const ifMatch = line.match(/^\s*@if\((.+)\)\s*$/);
    if (ifMatch) {
      const condition = ifMatch[1].trim();
      stack.push({
        type: 'if',
        condition: condition,
        children: [],
        ifBlock: null,
        elseIfConditions: [],
        elseContent: null,
        currentBlock: 'if',
      });
      i++;
      continue;
    }

    // @elseif(condition)
    const elseifMatch = line.match(/^\s*@elseif\((.+)\)\s*$/);
    if (elseifMatch) {
      if (stack.length === 0) {
        console.warn('@elseif tanpa @if');
        i++;
        continue;
      }
      const top = stack[stack.length - 1];
      if (top.currentBlock === 'if') {
        top.ifBlock = top.children;
        top.children = [];
        top.currentBlock = 'elseif';
        top.elseIfConditions.push({
          condition: elseifMatch[1].trim(),
          block: [],
        });
      } else if (top.currentBlock === 'elseif') {
        const last = top.elseIfConditions[top.elseIfConditions.length - 1];
        last.block = top.children;
        top.children = [];
        top.elseIfConditions.push({
          condition: elseifMatch[1].trim(),
          block: [],
        });
      } else {
        console.warn('@elseif setelah @else');
      }
      i++;
      continue;
    }

    // @else
    const elseMatch = line.match(/^\s*@else\s*$/);
    if (elseMatch) {
      if (stack.length === 0) {
        console.warn('@else tanpa @if');
        i++;
        continue;
      }
      const top = stack[stack.length - 1];
      if (top.currentBlock === 'if') {
        top.ifBlock = top.children;
        top.children = [];
        top.currentBlock = 'else';
      } else if (top.currentBlock === 'elseif') {
        const last = top.elseIfConditions[top.elseIfConditions.length - 1];
        last.block = top.children;
        top.children = [];
        top.currentBlock = 'else';
      } else {
        console.warn('@else ganda');
      }
      i++;
      continue;
    }

    // @endif
    const endifMatch = line.match(/^\s*@endif\s*$/);
    if (endifMatch) {
      if (stack.length === 0) {
        console.warn('@endif tanpa @if');
        i++;
        continue;
      }
      const top = stack.pop();

      // Save last block if not already saved
      if (top.currentBlock === 'if') {
        top.ifBlock = top.children;
      } else if (top.currentBlock === 'elseif') {
        const last = top.elseIfConditions[top.elseIfConditions.length - 1];
        last.block = top.children;
      } else if (top.currentBlock === 'else') {
        top.elseContent = top.children;
      }

      // Evaluate which block to render
      let rendered = false;
      if (top.ifBlock) {
        const condResult = evaluateCondition(top.condition, config);
        if (condResult) {
          output.push(...top.ifBlock);
          rendered = true;
        }
      }
      if (!rendered && top.elseIfConditions) {
        for (const ec of top.elseIfConditions) {
          const condResult = evaluateCondition(ec.condition, config);
          if (condResult) {
            output.push(...ec.block);
            rendered = true;
            break;
          }
        }
      }
      if (!rendered && top.elseContent) {
        output.push(...top.elseContent);
      }
      i++;
      continue;
    }

    // Row normal: add to top stack or output
    if (stack.length === 0) {
      output.push(line);
    } else {
      stack[stack.length - 1].children.push(line);
    }
    i++;
  }

  if (stack.length > 0) {
    console.warn('⚠️ Ada @if tanpa @endif');
  }
  return output.join('\n');
}

// Minify HTML with protection for MikroTik $(...) directive
async function minifyHTML(html) {
  return await htmlMinifier.minify(html, {
    collapseWhitespace: true,
    removeComments: true,
    removeRedundantAttributes: true,
    removeScriptTypeAttributes: true,
    removeStyleLinkTypeAttributes: true,
    useShortDoctype: true,
    minifyCSS: true,
    minifyJS: true,
    // ignore mikrotik $(...) directive
    ignoreCustomFragments: [/\$\([^)]*\)/g],
  });
}

function generateHash(content) {
  return crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
}

// Build CSS Tailwind from input.css to style.css (minified)
async function buildTailwind() {
  console.log('🎨 Building Tailwind CSS...');
  const inputCss = path.join(SRC_DIR, 'css', 'input.css');
  const tempCss = path.join(RESULT_DIR, 'css', 'style.tmp.css');

  await fs.ensureDir(path.dirname(tempCss));

  try {
    execSync(`npx tailwindcss -i "${inputCss}" -o "${tempCss}" --minify`, {
      stdio: 'inherit',
    });

    // Read file result to hash
    const cssContent = await fs.readFile(tempCss, 'utf8');
    const hash = generateHash(cssContent);
    const newCssName = `style.${hash}.css`;
    const finalCssPath = path.join(RESULT_DIR, 'css', newCssName);

    // Rename file from temporary to final name
    await fs.move(tempCss, finalCssPath, { overwrite: true });
    console.log(`✅ Tailwind CSS generated: ${finalCssPath}`);

    return newCssName;
  } catch (err) {
    console.error('Failed build Tailwind:', err);
    throw err;
  }
}

// Process JS files: minify + hash + copy
async function processJSFiles() {
  const jsFiles = glob.sync(`${SRC_DIR}/**/*.js`);
  const hashMapping = {}; // { 'js/app.js': 'js/app.a1b2c3d4.js', 'js/md5.js': 'js/md5.e5f6g7h8.js' }

  for (const file of jsFiles) {
    const content = await fs.readFile(file, 'utf8');
    // Minify JS
    const result = UglifyJS.minify(content);
    if (result.error) {
      console.error(`❌ Error minify JS ${file}:`, result.error);
      continue;
    }
    const minified = result.code;
    const hash = generateHash(minified);
    const parsedPath = path.parse(file);
    const newBasename = `${parsedPath.name}.${hash}${parsedPath.ext}`;
    const relativePath = path.relative(SRC_DIR, file);
    const newRelativePath = path.join(path.dirname(relativePath), newBasename);
    const destPath = path.join(RESULT_DIR, newRelativePath);

    await fs.ensureDir(path.dirname(destPath));
    await fs.writeFile(destPath, minified);
    console.log(`✅ JS generated: ${destPath}`);

    // Save mapping for update references in HTML (use forward slash)
    const originalRef = relativePath.split(path.sep).join('/');
    const newRef = newRelativePath.split(path.sep).join('/');
    hashMapping[originalRef] = newRef;
  }
  return hashMapping;
}

// Minify CSS files (except style.css)
async function minifyCSSFiles() {
  const cssFiles = glob.sync(`${RESULT_DIR}/**/*.css`);
  for (const file of cssFiles) {
    const content = await fs.readFile(file, 'utf8');
    const minified = new CleanCSS().minify(content).styles;
    await fs.writeFile(file, minified);
    console.log(`✅ Minified CSS: ${file}`);
  }
}

// Minify JS files
async function minifyJSFiles() {
  const jsFiles = glob.sync(`${RESULT_DIR}/**/*.js`);
  for (const file of jsFiles) {
    const content = await fs.readFile(file, 'utf8');
    const result = UglifyJS.minify(content);
    if (result.error) {
      console.error(`❌ Error minify JS ${file}:`, result.error);
    } else {
      await fs.writeFile(file, result.code);
      console.log(`✅ Minified JS: ${file}`);
    }
  }
}

// Process all HTML files: include + minify
async function processHTMLFiles(cssFileName, jsMapping) {
  const ignorePatterns = [
    `${SRC_DIR}/partials/**/*`, // all files in partials folder
  ];

  const htmlFiles = glob.sync(`${SRC_DIR}/**/*.html`, {
    ignore: ignorePatterns,
  });
  for (const file of htmlFiles) {
    // console.log(`📄 Processing ${file}`);
    let content = await fs.readFile(file, 'utf8');

    // 1. Replace CSS reference: href="css/style.css" -> href="css/style.[hash].css"
    content = content.replace(
      /(href=["']css\/)style\.css(["'])/g,
      `$1${cssFileName}$2`
    );

    // 2. Replace JS reference: src="js/app.js" -> src="js/app.[hash].js"
    for (const [oldRef, newRef] of Object.entries(jsMapping)) {
      const regex = new RegExp(
        `(src=["']${oldRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'])`,
        'g'
      );
      content = content.replace(regex, `src="${newRef}"`);
    }

    // 3. Process directive (config, if, include)
    content = await processConfigDirectives(content);
    content = await processIfDirectives(content);
    content = await processIncludes(file, content);

    // 4. Minify HTML
    const minified = await minifyHTML(content);

    // 5. Write to result
    const relativePath = path.relative(SRC_DIR, file);
    const destPath = path.join(RESULT_DIR, relativePath);
    await fs.ensureDir(path.dirname(destPath));
    await fs.writeFile(destPath, minified);
    console.log(`✅ Written: ${destPath}`);
  }
}

// Copy all non-HTML files (images, fonts, etc.) except those already processed
async function copyOtherFiles() {
  const ignorePatterns = [
    `${SRC_DIR}/**/*.html`, // all .html files (already processed separately)
    `${SRC_DIR}/**/*.js`, // all .js files (already processed separately)
    `${SRC_DIR}/**/*.css`, // all .css files (already processed separately)
    `${SRC_DIR}/partials/**/*`, // all files in partials folder (and subfolder)
  ];

  // Get all non-html files, except those in the ignore pattern
  const files = glob.sync(`${SRC_DIR}/**/*`, {
    nodir: true,
    ignore: ignorePatterns,
  });

  for (const file of files) {
    const relativePath = path.relative(SRC_DIR, file);
    const destPath = path.join(RESULT_DIR, relativePath);
    await fs.ensureDir(path.dirname(destPath));
    await fs.copy(file, destPath);
    console.log(`📁 Copied: ${destPath}`);
  }
}

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
    console.log(`✅ Written errors.txt: ${errorsFile}`);
  }
}

// Main build
async function build() {
  try {
    await fs.remove(RESULT_DIR);
    await fs.ensureDir(RESULT_DIR);

    console.log('🚀 Starting build...\n');

    await loadConfig();
    const cssFileName = await buildTailwind();
    const jsMapping = await processJSFiles();
    await processHTMLFiles(cssFileName, jsMapping);
    await copyOtherFiles();
    await minifyCSSFiles();
    await minifyJSFiles();
    await generateErrorsFile();

    console.log(`\n✨ Build completed! Result folder: ${RESULT_DIR}`);
  } catch (err) {
    console.error('Build failed:', err);
  }
}

build();
