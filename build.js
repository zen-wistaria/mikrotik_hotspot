import { execSync } from 'node:child_process';
import path from 'node:path';
import CleanCSS from 'clean-css';
import fs from 'fs-extra';
import { glob } from 'glob';
import htmlMinifier from 'html-minifier-terser';
import UglifyJS from 'uglify-js';

const SRC_DIR = path.resolve(process.cwd(), 'src');
const RESULT_DIR = path.resolve(process.cwd(), 'results');

// Function to process include directive @include('file.html')
async function processIncludes(filePath, content, visited = new Set()) {
  const includeRegex = /@include\(['"](.+?)['"]\)/g;
  let newContent = content;
  const baseDir = path.dirname(filePath);

  let match = includeRegex.exec(newContent);

  while (match !== null) {
    const includePath = match[1];
    const fullIncludePath = path.resolve(baseDir, includePath);

    if (visited.has(fullIncludePath)) {
      console.warn(`⚠️ Circular include detected: ${fullIncludePath}`);
      match = includeRegex.exec(newContent);
      continue;
    }

    visited.add(fullIncludePath);

    if (await fs.pathExists(fullIncludePath)) {
      let includeContent = await fs.readFile(fullIncludePath, 'utf8');

      includeContent = await processIncludes(
        fullIncludePath,
        includeContent,
        visited
      );

      newContent = newContent.replace(match[0], includeContent);
    } else {
      console.error(
        `❌ File not found: ${fullIncludePath} (included from ${filePath})`
      );
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
  const regex = /@config\(['"](.+?)['"]\)/g;
  const newContent = content.replace(regex, (_match, keyPath) => {
    const value = getNestedValue(config, keyPath);
    if (value === undefined) {
      console.warn(`⚠️ Key config '${keyPath}' not found in config.json`);
      return '';
    }
    return String(value);
  });
  return newContent;
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

// Doesn't support nested if @elseif
async function processIfDirectives(content) {
  const config = await loadConfig();
  const ifRegex = /@if\((.+?)\)\s*([\s\S]*?)\s*@endif/gi;
  return content.replace(ifRegex, (_match, condition, block) => {
    // Check @if @else @endif there are in block
    const elseParts = block.split(/@else\s*/);
    const ifBlock = elseParts[0];
    const elseBlock = elseParts.length > 1 ? elseParts[1] : '';

    const condResult = evaluateCondition(condition, config);
    if (condResult) {
      // remove @elseif
      return ifBlock.replace(/@elseif\(.+?\)\s*/g, '');
    } else {
      return elseBlock;
    }
  });
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

// Build CSS Tailwind from input.css to style.css (minified)
async function buildTailwind() {
  console.log('🎨 Building Tailwind CSS...');
  const inputCss = path.join(SRC_DIR, 'css', 'input.css');
  const outputCss = path.join(RESULT_DIR, 'css', 'style.css');

  // ensure result/css folder
  await fs.ensureDir(path.dirname(outputCss));

  try {
    execSync(`npx tailwindcss -i "${inputCss}" -o "${outputCss}" --minify`, {
      stdio: 'inherit',
    });
    console.log(`✅ Tailwind CSS generated: ${outputCss}`);
  } catch (err) {
    console.error('Gagal build Tailwind:', err);
  }
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
async function processHTMLFiles() {
  const ignorePatterns = [
    `${SRC_DIR}/partials/**/*`, // all files in partials folder
  ];
  const htmlFiles = glob.sync(`${SRC_DIR}/**/*.html`, {
    ignore: ignorePatterns,
  });
  for (const file of htmlFiles) {
    // console.log(`📄 Processing ${file}`);
    let content = await fs.readFile(file, 'utf8');

    // Process include directive
    content = await processIncludes(file, content);

    // Process config directives
    content = await processConfigDirectives(content);

    // Process if directives
    content = await processIfDirectives(content);

    // Minify HTML (with $(...) protection)
    const minified = await minifyHTML(content);

    // Determine path in result
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
    `${SRC_DIR}/partials/**/*`, // all files in partials folder (and subfolder)
    `${SRC_DIR}/**/input.css`, // input.css file anywhere in src
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

// Main build
async function build() {
  try {
    await fs.remove(RESULT_DIR);
    await fs.ensureDir(RESULT_DIR);

    console.log('🚀 Starting build...\n');

    await loadConfig();
    await buildTailwind();
    await processHTMLFiles();
    await copyOtherFiles();
    await minifyCSSFiles();
    await minifyJSFiles();

    console.log(`\n✨ Build completed! Result folder: ${RESULT_DIR}`);
  } catch (err) {
    console.error('Build failed:', err);
  }
}

build();
