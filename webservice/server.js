const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const SAMPLE_DIR = path.join(__dirname, '..', 'docs', 'sample');
const SRC_DIR = path.join(__dirname, '..', 'src');
const ENTRY_POINT = 'main.js';

// MIMEタイプのマッピング
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.tsv': 'text/tab-separated-values',
    '.csv': 'text/csv',
    '.txt': 'text/plain'
};

/**
 * ディレクトリ内のすべてのJavaScriptファイルを再帰的に取得
 */
function getAllJsFiles(dir, fileList = []) {
    if (!fs.existsSync(dir)) {
        return fileList;
    }
    
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            getAllJsFiles(filePath, fileList);
        } else if (file.endsWith('.js')) {
            fileList.push(filePath);
        }
    });
    
    return fileList;
}

/**
 * ファイルの依存関係を解析（import文を抽出）
 */
function parseImports(content, filePath) {
    const imports = [];
    const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))?|\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;
    
    let match;
    while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1];
        const resolvedPath = resolveImportPath(importPath, filePath);
        if (resolvedPath) {
            imports.push(resolvedPath);
        }
    }
    
    return imports;
}

/**
 * importパスを解決（相対パスを絶対パスに変換）
 */
function resolveImportPath(importPath, fromFile) {
    // 外部モジュール（node_modulesなど）はスキップ
    if (!importPath.startsWith('.')) {
        return null;
    }
    
    const dir = path.dirname(fromFile);
    let resolved = path.resolve(dir, importPath);
    
    // .js拡張子がない場合は追加
    if (!resolved.endsWith('.js')) {
        resolved += '.js';
    }
    
    // ファイルが存在するか確認
    if (fs.existsSync(resolved)) {
        return resolved;
    }
    
    return null;
}

/**
 * トポロジカルソートで依存関係順にファイルを並べる
 */
function topologicalSort(files, fileContents) {
    const visited = new Set();
    const sorted = [];
    const visiting = new Set();
    
    function visit(file) {
        if (visiting.has(file)) {
            console.warn(`Circular dependency detected: ${file}`);
            return;
        }
        if (visited.has(file)) {
            return;
        }
        
        visiting.add(file);
        
        const imports = parseImports(fileContents[file], file);
        imports.forEach(imp => {
            if (files.includes(imp)) {
                visit(imp);
            }
        });
        
        visiting.delete(file);
        visited.add(file);
        sorted.push(file);
    }
    
    files.forEach(file => {
        if (!visited.has(file)) {
            visit(file);
        }
    });
    
    return sorted;
}

/**
 * ES Modulesのimport/exportをIIFE形式に変換
 */
function convertToIIFE(content, filePath) {
    // export文を処理
    content = content.replace(/export\s+default\s+/g, '');
    content = content.replace(/export\s+const\s+/g, 'const ');
    content = content.replace(/export\s+function\s+/g, 'function ');
    content = content.replace(/export\s+class\s+/g, 'class ');
    content = content.replace(/export\s+\{([^}]+)\}/g, (match, exports) => {
        // 名前付きエクスポートを処理
        return exports.split(',').map(e => e.trim()).join(',');
    });
    
    // import文を処理（簡易版）
    content = content.replace(/import\s+.*?from\s+['"][^'"]+['"];?\s*/g, '');
    
    return content;
}

/**
 * srcディレクトリのJavaScriptファイルをバンドル
 */
function bundleJavaScript() {
    // srcディレクトリが存在しない場合は空のバンドルを返す
    if (!fs.existsSync(SRC_DIR)) {
        return `// ChartCanvas Library - Bundled
// Generated: ${new Date().toISOString()}
// No source files found

(function() {
'use strict';
})();
`;
    }
    
    // すべてのJavaScriptファイルを取得
    const allFiles = getAllJsFiles(SRC_DIR);
    
    if (allFiles.length === 0) {
        return `// ChartCanvas Library - Bundled
// Generated: ${new Date().toISOString()}
// No source files found

(function() {
'use strict';
})();
`;
    }
    
    // ファイルの内容を読み込む
    const fileContents = {};
    allFiles.forEach(file => {
        fileContents[file] = fs.readFileSync(file, 'utf-8');
    });
    
    // エントリーポイントを最初に配置
    const entryPoint = allFiles.find(f => f.endsWith(ENTRY_POINT));
    let sortedFiles;
    
    if (entryPoint) {
        // 依存関係を考慮してソート
        sortedFiles = topologicalSort(allFiles, fileContents);
        // エントリーポイントを最初に移動
        const entryIndex = sortedFiles.indexOf(entryPoint);
        if (entryIndex > 0) {
            sortedFiles.splice(entryIndex, 1);
            sortedFiles.unshift(entryPoint);
        }
    } else {
        // エントリーポイントがない場合は、アルファベット順
        sortedFiles = allFiles.sort();
    }
    
    // バンドルを作成
    let bundle = `// ChartCanvas Library - Bundled
// Generated: ${new Date().toISOString()}

(function() {
'use strict';

`;
    
    sortedFiles.forEach(file => {
        const relativePath = path.relative(SRC_DIR, file);
        bundle += `// ============================================\n`;
        bundle += `// ${relativePath}\n`;
        bundle += `// ============================================\n\n`;
        
        let content = fileContents[file];
        content = convertToIIFE(content, file);
        
        bundle += content;
        bundle += '\n\n';
    });
    
    bundle += `})();\n`;
    
    return bundle;
}

/**
 * sampleディレクトリ内のファイル一覧を取得してHTMLを生成
 */
function generateIndexHTML() {
    if (!fs.existsSync(SAMPLE_DIR)) {
        return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chart Samples</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
        }
        h1 {
            color: #333;
        }
        ul {
            list-style-type: none;
            padding: 0;
        }
        li {
            margin: 10px 0;
        }
        a {
            color: #0066cc;
            text-decoration: none;
            font-size: 16px;
        }
        a:hover {
            text-decoration: underline;
        }
        .file-type {
            color: #666;
            font-size: 14px;
            margin-left: 10px;
        }
    </style>
</head>
<body>
    <h1>Chart Samples</h1>
    <p>Sample directory not found.</p>
</body>
</html>
        `;
    }
    
    const files = fs.readdirSync(SAMPLE_DIR).filter(file => {
        const filePath = path.join(SAMPLE_DIR, file);
        return fs.statSync(filePath).isFile();
    }).sort();
    
    let html = `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chart Samples</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        h1 {
            color: #333;
            border-bottom: 2px solid #0066cc;
            padding-bottom: 10px;
        }
        ul {
            list-style-type: none;
            padding: 0;
            background-color: white;
            border-radius: 5px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            padding: 20px;
        }
        li {
            margin: 15px 0;
            padding: 10px;
            border-left: 3px solid #0066cc;
            background-color: #f9f9f9;
        }
        a {
            color: #0066cc;
            text-decoration: none;
            font-size: 16px;
            font-weight: bold;
        }
        a:hover {
            text-decoration: underline;
        }
        .file-type {
            color: #666;
            font-size: 14px;
            margin-left: 10px;
        }
        .special {
            background-color: #e8f4f8;
            border-left-color: #00aaff;
        }
    </style>
</head>
<body>
    <h1>Chart Samples</h1>
    <ul>
`;
    
    files.forEach(file => {
        const ext = path.extname(file).toLowerCase();
        const fileType = ext === '.html' ? 'HTML' : 
                        ext === '.js' ? 'JavaScript' :
                        ext === '.tsv' ? 'TSV' :
                        ext === '.csv' ? 'CSV' : ext.substring(1).toUpperCase();
        
        const isSpecial = file === 'chartcanvas.js' || file.endsWith('.html');
        const className = isSpecial ? 'special' : '';
        
        html += `        <li class="${className}"><a href="/${file}">${file}</a><span class="file-type">(${fileType})</span></li>\n`;
    });
    
    // chartcanvas.jsを特別に追加（動的バンドル）
    html += `        <li class="special"><a href="/chartcanvas.js">chartcanvas.js</a><span class="file-type">(JavaScript - Dynamic Bundle)</span></li>\n`;
    
    html += `    </ul>
</body>
</html>
    `;
    
    return html;
}

const server = http.createServer((req, res) => {
    // URLのパスを取得
    let filePath = req.url === '/' ? '/index.html' : req.url;
    
    // クエリパラメータを除去
    filePath = filePath.split('?')[0];
    
    // ルートアクセスの場合はインデックスページを返す
    if (filePath === '/' || filePath === '/index.html') {
        const indexHTML = generateIndexHTML();
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(indexHTML, 'utf-8');
        return;
    }
    
    // /stopエンドポイントでサーバーを停止
    if (filePath === '/stop') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
            <html>
                <head><title>Server Stopped</title></head>
                <body>
                    <h1>Server Stopped</h1>
                    <p>The server is shutting down...</p>
                </body>
            </html>
        `, 'utf-8');
        console.log('\nServer shutdown requested via /stop endpoint');
        setTimeout(() => {
            server.close(() => {
                console.log('Server closed');
                process.exit(0);
            });
        }, 100);
        return;
    }
    
    // chartcanvas.jsの場合は動的にバンドルを生成
    if (filePath === '/chartcanvas.js') {
        try {
            const bundle = bundleJavaScript();
            res.writeHead(200, { 
                'Content-Type': 'text/javascript',
                'Cache-Control': 'no-cache'
            });
            res.end(bundle, 'utf-8');
            return;
        } catch (error) {
            console.error('Error bundling JavaScript:', error);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end(`Error bundling JavaScript: ${error.message}`);
            return;
        }
    }
    
    // ファイルパスを構築
    const fullPath = path.join(SAMPLE_DIR, filePath);
    
    // ディレクトリトラバーサル攻撃を防ぐ
    if (!fullPath.startsWith(SAMPLE_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
    }
    
    // ファイルの拡張子を取得
    const extname = String(path.extname(fullPath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';
    
    // ファイルを読み込む
    fs.readFile(fullPath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // ファイルが見つからない場合
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end(`
                    <html>
                        <head><title>404 Not Found</title></head>
                        <body>
                            <h1>404 Not Found</h1>
                            <p>The file ${filePath} was not found.</p>
                        </body>
                    </html>
                `);
            } else {
                // サーバーエラー
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end(`
                    <html>
                        <head><title>500 Internal Server Error</title></head>
                        <body>
                            <h1>500 Internal Server Error</h1>
                            <p>Server error: ${error.code}</p>
                        </body>
                    </html>
                `);
            }
        } else {
            // ファイルが見つかった場合
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    console.log(`Serving files from: ${SAMPLE_DIR}`);
    console.log(`Source files from: ${SRC_DIR}`);
    console.log(`\nAvailable files:`);
    console.log(`  - http://localhost:${PORT}/001.html`);
    console.log(`  - http://localhost:${PORT}/002.html`);
    console.log(`  - http://localhost:${PORT}/data.tsv`);
    console.log(`  - http://localhost:${PORT}/chartcanvas.js (bundled from src/)`);
    console.log(`  - http://localhost:${PORT}/stop (stop server)`);
});

