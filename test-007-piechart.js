#!/usr/bin/env node

/**
 * 007.htmlと同じ円グラフをCLIで生成するテスト
 * SVGとPNGを生成してテスト出力ディレクトリに保存します。
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer');

const TEST_OUTPUT_DIR = path.join(__dirname, 'test-output');
const CONFIG_FILE = path.join(__dirname, 'test-cli-configs', 'test-piechart.json');
const TSV_FILE = path.join(__dirname, 'docs', 'sample', 'data-pie.tsv');

// テスト出力ディレクトリを作成
if (!fs.existsSync(TEST_OUTPUT_DIR)) {
    fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
}

/**
 * CLIを実行してSVGを生成
 */
function runCLI(configFile, tsvFile) {
    return new Promise((resolve, reject) => {
        const tsvContent = fs.readFileSync(tsvFile, 'utf-8');
        const cliProcess = spawn('node', ['cli.js', '-c', configFile], {
            cwd: __dirname,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let svgOutput = '';
        let errorOutput = '';
        
        cliProcess.stdout.on('data', (data) => {
            svgOutput += data.toString();
        });
        
        cliProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });
        
        cliProcess.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`CLI exited with code ${code}: ${errorOutput}`));
            } else {
                resolve(svgOutput);
            }
        });
        
        cliProcess.stdin.write(tsvContent);
        cliProcess.stdin.end();
    });
}

/**
 * SVGをPNGに変換
 */
async function convertSVGToPNG(svgContent, outputPath) {
    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        const svgMatch = svgContent.match(/<svg[^>]*>/);
        let width = 800;
        let height = 600;
        
        if (svgMatch) {
            const svgTag = svgMatch[0];
            const widthMatch = svgTag.match(/width="(\d+)"/);
            const heightMatch = svgTag.match(/height="(\d+)"/);
            if (widthMatch) width = parseInt(widthMatch[1], 10);
            if (heightMatch) height = parseInt(heightMatch[1], 10);
        }
        
        await page.setViewport({ width: width, height: height });
        
        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            margin: 0;
            padding: 0;
        }
        svg {
            display: block;
        }
    </style>
</head>
<body>
${svgContent}
</body>
</html>`;
        
        await page.setContent(html, { waitUntil: 'networkidle0' });
        
        await page.screenshot({
            path: outputPath,
            type: 'png',
            fullPage: false,
            clip: {
                x: 0,
                y: 0,
                width: width,
                height: height
            }
        });
        
        console.log(`  PNGを保存: ${outputPath}`);
    } catch (error) {
        console.error('PNG変換エラー:', error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

/**
 * メイン処理
 */
async function main() {
    console.log('=== 007.htmlと同じ円グラフをCLIで生成 ===');
    
    try {
        // CLIでSVGを生成
        console.log('CLIでSVGを生成中...');
        const svgString = await runCLI(CONFIG_FILE, TSV_FILE);
        
        // SVGファイルを保存
        const svgPath = path.join(TEST_OUTPUT_DIR, 'test-007-piechart.svg');
        fs.writeFileSync(svgPath, svgString, 'utf-8');
        console.log(`  SVGを保存: ${svgPath}`);
        
        // PNGに変換
        console.log('PNGに変換中...');
        const pngPath = path.join(TEST_OUTPUT_DIR, 'test-007-piechart.png');
        await convertSVGToPNG(svgString, pngPath);
        
        console.log('✓ テスト完了');
        
    } catch (error) {
        console.error('✗ エラー:', error.message);
        process.exit(1);
    }
}

// 実行
if (require.main === module) {
    main();
}

module.exports = { main };

