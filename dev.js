import { exec } from 'node:child_process';
import path from 'node:path';
import browserSync from 'browser-sync';
import fs from 'fs-extra';

const SRC_DIR = './src';

let configCache = null;

/**
 * Load config.json once then cache
 */
async function loadConfig() {
  // if (configCache) return configCache;

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
  const safeExpr = expr.replace(/config\.([a-zA-Z0-9_.]+)/g, (_, path) =>
    JSON.stringify(getNestedValue(config, path))
  );

  if (!/^[\w\s'"!=<>|&().+\-*/%]+$/.test(safeExpr)) {
    console.warn(`⚠️ Invalid expression: ${expr}`);
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const ifMatch = line.match(/^\s*@if\((.+)\)\s*$/);
    if (ifMatch) {
      stack.push({
        type: 'if',
        condition: ifMatch[1],
        children: [],
        elseIf: [],
        elseBlock: null,
        mode: 'if',
      });
      continue;
    }

    const elseifMatch = line.match(/^\s*@elseif\((.+)\)\s*$/);
    if (elseifMatch && stack.length) {
      const top = stack[stack.length - 1];
      top.elseIf.push({
        condition: elseifMatch[1],
        block: [],
      });
      top.mode = 'elseif';
      continue;
    }

    if (/^\s*@else\s*$/.test(line) && stack.length) {
      const top = stack[stack.length - 1];
      top.mode = 'else';
      top.elseBlock = [];
      continue;
    }

    if (/^\s*@endif\s*$/.test(line)) {
      const top = stack.pop();

      let rendered = false;

      if (evaluateCondition(top.condition, config)) {
        output.push(...top.children);
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

      if (top.mode === 'if') {
        top.children.push(line);
      } else if (top.mode === 'elseif') {
        top.elseIf[top.elseIf.length - 1].block.push(line);
      } else {
        top.elseBlock.push(line);
      }
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
    if (!asMatch) {
      console.log(`⚠️ @foreach syntax error`);
      return content;
    }

    const arrayPath = asMatch[1].replace(/^config\./, '').trim();
    const keyVar = asMatch[2];
    const itemVar = asMatch[3];

    const arr = getNestedValue(config, arrayPath);
    if (!Array.isArray(arr)) {
      console.log(`⚠️ @foreach ${arrayPath} is not an array`);
      return content;
    }

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
    fileContent = await processIfDirectives(fileContent, config);
    fileContent = await processForeachDirectives(
      fileContent,
      config,
      path.dirname(fullPath)
    );
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
 * Middleware BrowserSync
 */
async function htmlIncludeMiddleware(req, res, next) {
  try {
    const url = req.url === '/' ? '/login.html' : req.url;

    if (!url.endsWith('.html')) return next();

    const fullPath = path.join(SRC_DIR, url);
    const config = await loadConfig();

    let content = await fs.readFile(fullPath, 'utf8');
    const baseDir = path.dirname(fullPath);

    content = processConfigDirectives(content, config);
    content = await processForeachDirectives(content, config, baseDir);
    content = await processIfDirectives(content, config);
    content = await processIncludes(baseDir, content, config);

    res.setHeader('Content-Type', 'text/html');
    res.end(content);
  } catch (err) {
    next(err);
  }
}

/**
 * Tailwind watcher
 */
function startTailwindWatch() {
  const proc = exec(
    'npx tailwindcss -i ./src/css/input.css -o ./src/css/style.css --watch'
  );

  proc.stderr.on('data', (d) => console.error('[tailwind]', d));

  return proc;
}

/**
 * Dev server
 */
function startDevServer() {
  browserSync.init({
    server: {
      baseDir: SRC_DIR,
      middleware: [htmlIncludeMiddleware],
      serveStaticOptions: {
        extensions: ['html'],
      },
    },
    port: 3000,
    open: true,
    notify: false,
    files: [`${SRC_DIR}/**/*`, `./config.json`],
  });
}

/**
 * Main dev
 */
async function dev() {
  await fs.ensureDir(`${SRC_DIR}/css`);

  const cssPath = `${SRC_DIR}/css/input.css`;

  if (!(await fs.pathExists(cssPath))) {
    await fs.writeFile(
      cssPath,
      `@tailwind base;\n@tailwind components;\n@tailwind utilities;`
    );
  }

  await loadConfig();
  startTailwindWatch();
  startDevServer();
}

dev().catch(console.error);
