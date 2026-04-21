import { exec } from 'node:child_process';
import path from 'node:path';
import browserSync from 'browser-sync';
import fs from 'fs-extra';

const SRC_DIR = './src';

// Function to process include directive @include('file.html')
async function processIncludes(filePath, content, visited = new Set()) {
    const includeRegex = /@include\(([^)]+)\)/g;
    let newContent = content;
    const baseDir = path.dirname(filePath);
    let match;

    while ((match = includeRegex.exec(content)) !== null) {
        let includePath = match[1].trim();
        
        if ((includePath.startsWith("'") && includePath.endsWith("'")) ||
            (includePath.startsWith('"') && includePath.endsWith('"'))) {
            includePath = includePath.slice(1, -1);
        }
        
        const fullIncludePath = path.resolve(baseDir, includePath);
        
        if (visited.has(fullIncludePath)) {
            console.warn(`⚠️ Circular include detected: ${fullIncludePath}`);
            continue;
        }
        visited.add(fullIncludePath);
        
        if (await fs.pathExists(fullIncludePath)) {
            let includeContent = await fs.readFile(fullIncludePath, 'utf8');
            includeContent = await processIncludes(fullIncludePath, includeContent, visited);
            newContent = newContent.replace(match[0], includeContent);
        } else {
            console.error(`❌ File not found: ${fullIncludePath} (included from ${filePath})`);
        }
        visited.delete(fullIncludePath);
    }
    return newContent;
}

// Function to process config directive @config('...')
async function loadConfig() {
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
    
        if ((keyPath.startsWith("'") && keyPath.endsWith("'")) ||
            (keyPath.startsWith('"') && keyPath.endsWith('"'))) {
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

// Middleware for BrowserSync – process .html files dynamically
function htmlIncludeMiddleware(req, res, next) {
  const url = req.url;
  // Only process .html files (and root / -> login.html)
  const filePath = url === '/' ? '/login.html' : url;
  if (!filePath.endsWith('.html')) {
    return next(); // let BrowserSync handle other files (CSS, JS, images)
  }

  const fullPath = path.join(SRC_DIR, filePath);
  fs.readFile(fullPath, 'utf8')
    .then(async (content) => {
      // Process all @include directives
      let processed = await processIncludes(fullPath, content);
      // Process all @config directives
      processed = await processConfigDirectives(processed);
      // Process all @if @elseif @else @endif directives
      processed = await processIfDirectives(processed);
      res.setHeader('Content-Type', 'text/html');
      res.end(processed);
    })
    .catch((err) => {
      if (err.code === 'ENOENT') {
        res.statusCode = 404;
        res.end(`File ${filePath} not found`);
      } else {
        next(err);
      }
    });
}

// Run Tailwind CSS watch mode as child process
function startTailwindWatch() {
  console.log('🎨 Running Tailwind CSS watch mode...');
  const tailwind = exec(
    'npx tailwindcss -i ./src/css/input.css -o ./src/css/style.css --watch'
  );
  // tailwind.stdout.on('data', (data) => console.log(`[tailwind] ${data}`));
  tailwind.stderr.on('data', (data) => console.error(`[tailwind] ${data}`));
  return tailwind;
}

// Run BrowserSync with custom middleware
function startDevServer() {
  browserSync.init({
    server: {
      baseDir: SRC_DIR,
      middleware: [htmlIncludeMiddleware],
      // To make Tailwind compiled CSS files accessible
      serveStaticOptions: {
        extensions: ['html'],
      },
    },
    port: 3000,
    open: true,
    notify: false,
    files: [
      `${SRC_DIR}/**/*.html`,
      `${SRC_DIR}/**/*.css`,
      `${SRC_DIR}/**/*.js`,
      `${SRC_DIR}/**/*.input.css`, // let Tailwind source also trigger reload
      `${process.cwd()}/config.json`, // let config.json also trigger reload
    ],
    // Optional: reload delay to let files save
    reloadDelay: 100,
  });

  console.log('🚀 Development server running at http://localhost:3000');
  console.log(`📁 Watch folder: ${SRC_DIR}`);
  console.log('⚡ Hot reload active for HTML, CSS, JS');
}

// Main dev
async function dev() {
  // Ensure src/css folder exists, create tailwind.css if not
  await fs.ensureDir(`${SRC_DIR}/css`);
  const tailwindSrcPath = `${SRC_DIR}/css/input.css`;
  if (!(await fs.pathExists(tailwindSrcPath))) {
    await fs.writeFile(
      tailwindSrcPath,
      `@tailwind base;\n@tailwind components;\n@tailwind utilities;`
    );
    console.log('📝 Creating default src/css/input.css');
  }

  // Run Tailwind watch (output to src/css/tailwind-output.css)
  // We will change the reference in HTML from "css/tailwind.min.css" to "css/tailwind-output.css" for development
  // Or let HTML still refer to tailwind.min.css, but we create a temporary output.
  // To make it neater, we can temporarily change the HTML file in memory? No need, just create output to tailwind-output.css
  // And make sure in your login.html you use <link href="css/tailwind-output.css"> during development.
  // For convenience, we will use the same output file.
  await loadConfig();
  startTailwindWatch();
  startDevServer();
}

dev().catch(console.error);
