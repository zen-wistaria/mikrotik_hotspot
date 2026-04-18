const fs = require('fs');
const path = require('path');

const root = __dirname;
const outDir = path.join(root, 'results');

// file & folder to copy
const items = [
  'trials.html',
  'alogin.html',
  'api.json',
  'css',
  'error.html',
  'errors.txt',
  'favicon.ico',
  'img',
  'js',
  'login.html',
  'logout.html',
  'md5.js',
  'radvert.html',
  'redirect.html',
  'rlogin.html',
  'status.html',
  'xml',
];

// remove old results folder
if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true });
}

// create new results folder
fs.mkdirSync(outDir, { recursive: true });

// helper copy
function copyRecursive(src, dest) {
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
items.forEach(item => {
  const srcPath = path.join(root, item);
  const destPath = path.join(outDir, item);

  if (fs.existsSync(srcPath)) {
    copyRecursive(srcPath, destPath);
    console.log(`✔ copied: ${item}`);
  } else {
    console.warn(`⚠ not found: ${item}`);
  }
});

console.log('\nBuild done → folder "results" ready 🚀');