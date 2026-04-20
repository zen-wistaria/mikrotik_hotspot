const fs = require('fs');
const path = require('path');
const { minify } = require('html-minifier-terser');

const srcDir = path.join(__dirname, 'src');
const outDir = path.join(__dirname, 'results');

const items = [
  'css',
  'img',
  'js',
  'xml',
  'alogin.html',
  'api.json',
  'error.html',
  'errors.txt',
  'favicon.ico',
  'flogin.html',
  'flogout.html',
  'fstatus.html',
  'login.html',
  'logout.html',
  'md5.js',
  'radvert.html',
  'redirect.html',
  'rlogin.html',
  'rstatus.html',
  'status.html',
  'trials.html',
  '!css/input.css',
  '!js/dev-only.js'
];

const includeItems = items.filter(i => !i.startsWith('!'));
const excludeItems = items
  .filter(i => i.startsWith('!'))
  .map(i => i.slice(1));

const excludePaths = excludeItems.map(p =>
  path.join(srcDir, p)
);

if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true });
}

fs.mkdirSync(outDir, { recursive: true });

function isExcluded(srcPath) {
  return excludePaths.some(ex =>
    srcPath.startsWith(ex)
  );
}

async function copyRecursive(src, dest) {
  if (isExcluded(src)) {
    console.log(`skipped: ${path.relative(srcDir, src)}`);
    return;
  }

  const stat = fs.statSync(src);

  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });

    for (const file of fs.readdirSync(src)) {
      await copyRecursive(
        path.join(src, file),
        path.join(dest, file)
      );
    }
  } else {
    // Minify HTML Only
    if (src.endsWith('.html')) {
      let content = fs.readFileSync(src, 'utf-8');

      const minified = await minify(content, {
        collapseWhitespace: true,
        removeComments: true,

        // for Mikrotik
        removeAttributeQuotes: false,
        minifyJS: true,
        minifyCSS: true,
        ignoreCustomFragments: [/\$\([^\)]+\)/] // ignore $(...)
      });

      fs.writeFileSync(dest, minified);
    } else {
      fs.copyFileSync(src, dest);
    }
  }
}

(async () => {
  for (const item of includeItems) {
    const srcPath = path.join(srcDir, item);
    const destPath = path.join(outDir, item);

    if (fs.existsSync(srcPath)) {
      await copyRecursive(srcPath, destPath);
      console.log(`✔ copied: ${item}`);
    } else {
      console.warn(`⚠ not found: ${item}`);
    }
  }

  console.log('\nBuild done → folder "results" ready 🚀');
})();