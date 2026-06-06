const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('./src', function(filePath) {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts') || filePath.endsWith('.css')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    content = content.replace(/text-slate-900/g, 'text-pink-600');
    content = content.replace(/bg-slate-900/g, 'bg-pink-500');
    content = content.replace(/border-slate-900/g, 'border-pink-500');
    content = content.replace(/ring-slate-900/g, 'ring-pink-500');

    content = content.replace(/text-slate-800/g, 'text-pink-600');
    content = content.replace(/bg-slate-800/g, 'bg-pink-600');
    content = content.replace(/border-slate-800/g, 'border-pink-600');

    content = content.replace(/text-slate-700/g, 'text-pink-500');
    content = content.replace(/text-slate-600/g, 'text-pink-500');
    content = content.replace(/text-slate-500/g, 'text-gray-500');

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Updated', filePath);
    }
  }
});
