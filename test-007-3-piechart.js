#!/usr/bin/env node

/**
 * 007-3.htmlと同じ円グラフをCLIで生成するテスト（2つの円グラフを横並び）
 * SVGとPNGを生成してテスト出力ディレクトリに保存します。
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const TEST_OUTPUT_DIR = path.join(__dirname, 'test-output');
const CHART_CANVAS_PATH = path.join(__dirname, 'chartcanvas.js');
const TSV_FILE = path.join(__dirname, 'docs', 'sample', 'data-pie-large.tsv');

// テスト出力ディレクトリを作成
if (!fs.existsSync(TEST_OUTPUT_DIR)) {
    fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
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
        let width = 2000;
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
    console.log('=== 007-3.htmlと同じ円グラフをCLIで生成（2つの円グラフを横並び） ===');
    
    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        const chartCanvasCode = fs.readFileSync(CHART_CANVAS_PATH, 'utf-8');
        const tsvContent = fs.readFileSync(TSV_FILE, 'utf-8');
        
        // コンソールメッセージを監視
        page.on('console', msg => {
            const type = msg.type();
            const text = msg.text();
            if (type === 'error') {
                console.error(`[ブラウザコンソールエラー] ${text}`);
            } else {
                console.log(`[ブラウザコンソール] ${text}`);
            }
        });
        
        // ページエラーを監視
        page.on('pageerror', error => {
            console.error(`[ページエラー] ${error.message}`);
        });
        
        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script>
        // fetchをモックしてTSVファイルを読み込めるようにする
        const originalFetch = window.fetch;
        window.fetch = async function(url) {
            const urlMap = {
                './data-pie-large.tsv': ${JSON.stringify(tsvContent)},
                'data-pie-large.tsv': ${JSON.stringify(tsvContent)}
            };
            
            for (const [key, value] of Object.entries(urlMap)) {
                if (url.includes(key) || url.endsWith(key)) {
                    return {
                        ok: true,
                        text: async () => value
                    };
                }
            }
            return originalFetch.apply(this, arguments);
        };
    </script>
    <script>${chartCanvasCode}</script>
</head>
<body>
    <div id="chart_div"></div>
    <script>
        let chart = null;
        let pieChart1 = null;
        let pieChart2 = null;

        (async () => {
            try {
                const chart_div = document.getElementById('chart_div');
                chart = new ChartCanvas(chart_div);
                chart.size(2000, 600); // 横長のサイズ

                // 1つ目の円グラフ（値）
                pieChart1 = chart.addPieChart();
                pieChart1.setTitle('値');

                // 2つ目の円グラフ（数量）
                pieChart2 = chart.addPieChart();
                pieChart2.setTitle('数量');

                // TSVファイルを読み込む
                const response = await fetch('./data-pie-large.tsv');
                if (!response.ok) {
                    throw new Error('TSVファイルの読み込みに失敗しました');
                }
                
                const text = await response.text();
                const lines = text.split('\\n').map(line => line.trim()).filter(line => line.length > 0);
                
                if (lines.length === 0) {
                    throw new Error('TSVファイルが空です');
                }

                // ヘッダー行を解析
                const headers = lines[0].split('\\t');
                const categoryIndex = headers.indexOf('カテゴリ名');
                const valueIndex = headers.indexOf('値');
                const quantityIndex = headers.indexOf('数量');
                
                if (categoryIndex === -1 || valueIndex === -1 || quantityIndex === -1) {
                    throw new Error('必要な列が見つかりません');
                }

                // データを読み込む
                const valueData = [];
                const valueLabels = [];
                const quantityData = [];
                const quantityLabels = [];
                
                for (let i = 1; i < lines.length; i++) {
                    const columns = lines[i].split('\\t');
                    if (columns.length <= Math.max(categoryIndex, valueIndex, quantityIndex)) {
                        continue;
                    }
                    
                    const category = columns[categoryIndex]?.trim() || '';
                    const valueStr = columns[valueIndex].trim();
                    const quantityStr = columns[quantityIndex].trim();
                    const value = parseFloat(valueStr);
                    const quantity = parseFloat(quantityStr);
                    
                    if (!isNaN(value) && value >= 0 && category) {
                        valueData.push(value);
                        valueLabels.push(category);
                    }
                    
                    if (!isNaN(quantity) && quantity >= 0 && category) {
                        quantityData.push(quantity);
                        quantityLabels.push(category);
                    }
                }
                
                // データを設定
                pieChart1.setData(valueData, valueLabels);
                pieChart2.setData(quantityData, quantityLabels);
                
                // グラフを描画
                chart.render();
                
                // SVG文字列を取得
                const svgString = chart.getSVGString();
                window.testResult = { success: true, svgString: svgString };
            } catch (error) {
                console.error('エラー:', error);
                window.testResult = { success: false, error: error.message, stack: error.stack };
            }
        })();
    </script>
</body>
</html>`;
        
        await page.setContent(html, { waitUntil: 'networkidle0' });
        
        // testResultが設定されるまで待つ（最大20秒）
        await page.waitForFunction(() => window.testResult !== undefined, { timeout: 20000 });
        
        const result = await page.evaluate(() => window.testResult);
        if (!result.success) {
            throw new Error(result.error + '\\n' + (result.stack || ''));
        }
        
        // SVGファイルを保存
        const svgPath = path.join(TEST_OUTPUT_DIR, 'test-007-3-piechart.svg');
        fs.writeFileSync(svgPath, result.svgString, 'utf-8');
        console.log(`  SVGを保存: ${svgPath}`);
        
        // PNGに変換
        console.log('PNGに変換中...');
        const pngPath = path.join(TEST_OUTPUT_DIR, 'test-007-3-piechart.png');
        await convertSVGToPNG(result.svgString, pngPath);
        
        console.log('✓ テスト完了');
        
    } catch (error) {
        console.error('✗ エラー:', error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// 実行
if (require.main === module) {
    main();
}

module.exports = { main };

