const fs = require('fs');
const path = require('path');

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
  // exclude
  '!css/input.css',
  '!js/dev-only.js'
];

const includeItems = items.filter(i => !i.startsWith('!'));
const excludeItems = items
  .filter(i => i.startsWith('!'))
  .map(i => i.slice(1));

// normalize to absolute path
const excludePaths = excludeItems.map(p =>
  path.join(srcDir, p)
);

// remove old results folder
if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true });
}

// create new results folder
fs.mkdirSync(outDir, { recursive: true });

// cek apakah file harus di-exclude
function isExcluded(srcPath) {
  return excludePaths.some(ex =>
    srcPath.startsWith(ex)
  );
}

// helper copy recursive
function copyRecursive(src, dest) {
  if (isExcluded(src)) {
    console.log(`skipped: ${path.relative(srcDir, src)}`);
    return;
  }

  const stat = fs.statSync(src);

  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });

    fs.readdirSync(src).forEach(file => {
      copyRecursive(
        path.join(src, file),
        path.join(dest, file)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

// proses copy
includeItems.forEach(item => {
  const srcPath = path.join(srcDir, item);
  const destPath = path.join(outDir, item);

  if (fs.existsSync(srcPath)) {
    copyRecursive(srcPath, destPath);
    console.log(`✔ copied: ${item}`);
  } else {
    console.warn(`⚠ not found: ${item}`);
  }
});

console.log('\nBuild done → folder "results" ready 🚀');