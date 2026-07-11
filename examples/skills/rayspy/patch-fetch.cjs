const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

walkDir(path.join(__dirname, 'src'), function(filePath) {
    if (filePath.endsWith('.js') || filePath.endsWith('.jsx') || filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = content
            .replace(/fetch\(['"]\/([a-zA-Z0-9_-]+)/g, 'fetch(\'http://localhost:5176/$1')
            .replace(/fetch\(\`\/([a-zA-Z0-9_-]+)/g, 'fetch(`http://localhost:5176/$1');
        
        if (modified !== content) {
            fs.writeFileSync(filePath, modified, 'utf8');
            console.log('Patched', filePath);
        }
    }
});
