#!/usr/bin/env node

/**
 * サーバー側でのChartCanvasのテストスクリプト
 * 
 * このスクリプトは、サーバー側でChartCanvasを使用してSVGを生成し、
 * PNGに変換してテスト出力ディレクトリに保存します。
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const TEST_OUTPUT_DIR = path.join(__dirname, 'test-output');
const CHART_CANVAS_PATH = path.join(__dirname, 'chartcanvas.js');
const SAMPLE_DATA_DIR = path.join(__dirname, 'docs', 'sample');

// テスト出力ディレクトリが存在しない場合は作成
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
        
        // SVGのサイズを取得
        const svgMatch = svgContent.match(/<svg[^>]*>/);
        let width = 1024;
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
 * TSVファイルを読み込んでデータを返す
 */
function readTSVFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    
    if (lines.length === 0) {
        return { headers: [], rows: [] };
    }
    
    const headers = lines[0].split('\t');
    const rows = lines.slice(1).map(line => {
        const values = line.split('\t');
        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });
        return row;
    });
    
    return { headers, rows };
}

/**
 * テストケースを実行
 */
async function runTest(testName, testFunction) {
    console.log(`\n[テスト開始] ${testName}`);
    try {
        await testFunction();
        console.log(`[✓ 成功] ${testName}`);
        return true;
    } catch (error) {
        console.error(`[✗ 失敗] ${testName}:`, error.message);
        console.error(error.stack);
        return false;
    }
}

/**
 * テスト1: サーバー側でChartCanvasを使用してSVGを生成（002.htmlのテストケース）
 */
async function test002ServerSide() {
    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // chartcanvas.jsを読み込む
        const chartCanvasCode = fs.readFileSync(CHART_CANVAS_PATH, 'utf-8');
        
        // TSVデータを事前に読み込む
        const tsvData = readTSVFile(path.join(SAMPLE_DATA_DIR, 'data-7days.tsv'));
        
        // テスト用のHTMLを作成
        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <script>
        ${chartCanvasCode}
    </script>
</head>
<body>
    <div id="chart_div"></div>
    <script>
        (async () => {
            try {
                // DOM要素なしでChartCanvasを作成（サーバー側のテスト）
                const chart = new ChartCanvas(null);
                chart.size(1024, 600);
                chart.title = '売上・客数推移';
                chart.subtitle = '7日分のデータ';

                const dateChart = chart.addDateChart();
                dateChart.xAxisTitle = '日付';
                dateChart.yAxisTitle = '売上';
                dateChart.yAxisScale = '円';
                dateChart.yAxisFormat = '#,##0';
                dateChart.secondAxis = true;
                dateChart.secondAxisTitle = '客数';
                dateChart.secondAxisScale = '人';
                dateChart.secondAxisFormat = '#,##0';
                dateChart.dateFormat = 'auto';

                // 系列を追加
                const salesLine = dateChart.addLine({
                    title: '売上',
                    color: 'red',
                    lineWidth: 2,
                    lineType: 'solid',
                    secondAxis: false,
                    showMarkers: true
                });
                const customerBar = dateChart.addBar({
                    title: '客数',
                    color: 'blue',
                    secondAxis: true
                });

                // TSVデータを追加（事前に読み込んだデータを使用）
                const tsvData = ${JSON.stringify(tsvData)};
                tsvData.rows.forEach(row => {
                    if (row['日付'] && row['売上']) {
                        salesLine.addData(row['日付'], parseFloat(row['売上']), row['コメント'] || '');
                    }
                    if (row['日付'] && row['客数']) {
                        customerBar.addData(row['日付'], parseFloat(row['客数']));
                    }
                });

                // レンダリング
                chart.render();
                
                // SVG文字列を取得
                const svgString = chart.getSVGString();
                
                // 結果をwindowオブジェクトに保存
                window.testResult = {
                    success: true,
                    svgString: svgString
                };
            } catch (error) {
                window.testResult = {
                    success: false,
                    error: error.message,
                    stack: error.stack
                };
            }
        })();
    </script>
</body>
</html>`;
        
        await page.setContent(html, { waitUntil: 'networkidle0' });
        
        // 結果を待つ
        await page.waitForFunction(() => window.testResult !== undefined, { timeout: 10000 });
        
        const result = await page.evaluate(() => window.testResult);
        
        if (!result.success) {
            throw new Error(result.error + '\n' + result.stack);
        }
        
        // SVGを保存
        const svgPath = path.join(TEST_OUTPUT_DIR, `test-002-server-side.svg`);
        fs.writeFileSync(svgPath, result.svgString, 'utf-8');
        console.log(`  SVGを保存: ${svgPath}`);
        
        // PNGに変換
        const pngPath = path.join(TEST_OUTPUT_DIR, `test-002-server-side.png`);
        await convertSVGToPNG(result.svgString, pngPath);
        console.log(`  PNGを保存: ${pngPath}`);
        
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

/**
 * テスト2: TSVファイルを直接読み込んでサーバー側で処理
 */
async function test002WithTSVFile() {
    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // chartcanvas.jsを読み込む
        const chartCanvasCode = fs.readFileSync(CHART_CANVAS_PATH, 'utf-8');
        
        // TSVファイルを読み込む
        const tsvData = readTSVFile(path.join(SAMPLE_DATA_DIR, 'data-7days.tsv'));
        
        // テスト用のHTMLを作成
        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <script>
        ${chartCanvasCode}
    </script>
</head>
<body>
    <div id="chart_div"></div>
    <script>
        (async () => {
            try {
                // DOM要素なしでChartCanvasを作成（サーバー側のテスト）
                const chart = new ChartCanvas(null);
                chart.size(1024, 600);
                chart.title = '売上・客数推移';
                chart.subtitle = '7日分のデータ（TSVファイルから直接読み込み）';

                const dateChart = chart.addDateChart();
                dateChart.xAxisTitle = '日付';
                dateChart.yAxisTitle = '売上';
                dateChart.yAxisScale = '円';
                dateChart.yAxisFormat = '#,##0';
                dateChart.secondAxis = true;
                dateChart.secondAxisTitle = '客数';
                dateChart.secondAxisScale = '人';
                dateChart.secondAxisFormat = '#,##0';
                dateChart.dateFormat = 'auto';

                // 系列を追加
                const salesLine = dateChart.addLine({
                    title: '売上',
                    color: 'red',
                    lineWidth: 2,
                    lineType: 'solid',
                    secondAxis: false,
                    showMarkers: true
                });
                const customerBar = dateChart.addBar({
                    title: '客数',
                    color: 'blue',
                    secondAxis: true
                });

                // TSVデータを追加
                const tsvData = ${JSON.stringify(tsvData)};
                tsvData.rows.forEach(row => {
                    if (row['日付'] && row['売上']) {
                        salesLine.addData(row['日付'], parseFloat(row['売上']), row['コメント'] || '');
                    }
                    if (row['日付'] && row['客数']) {
                        customerBar.addData(row['日付'], parseFloat(row['客数']));
                    }
                });

                // レンダリング
                chart.render();
                
                // SVG文字列を取得
                const svgString = chart.getSVGString();
                
                // 結果をwindowオブジェクトに保存
                window.testResult = {
                    success: true,
                    svgString: svgString
                };
            } catch (error) {
                window.testResult = {
                    success: false,
                    error: error.message,
                    stack: error.stack
                };
            }
        })();
    </script>
</body>
</html>`;
        
        await page.setContent(html, { waitUntil: 'networkidle0' });
        
        // 結果を待つ
        await page.waitForFunction(() => window.testResult !== undefined, { timeout: 10000 });
        
        const result = await page.evaluate(() => window.testResult);
        
        if (!result.success) {
            throw new Error(result.error + '\n' + result.stack);
        }
        
        // SVGを保存
        const svgPath = path.join(TEST_OUTPUT_DIR, `test-002-with-tsv.svg`);
        fs.writeFileSync(svgPath, result.svgString, 'utf-8');
        console.log(`  SVGを保存: ${svgPath}`);
        
        // PNGに変換
        const pngPath = path.join(TEST_OUTPUT_DIR, `test-002-with-tsv.png`);
        await convertSVGToPNG(result.svgString, pngPath);
        console.log(`  PNGを保存: ${pngPath}`);
        
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
    console.log('サーバー側ChartCanvasテストを開始します...');
    console.log(`テスト出力ディレクトリ: ${TEST_OUTPUT_DIR}`);
    
    const results = [];
    
    // テストを実行
    results.push(await runTest('テスト1: サーバー側でChartCanvasを使用（DOM要素なし）', test002ServerSide));
    results.push(await runTest('テスト2: TSVファイルを直接読み込んで処理', test002WithTSVFile));
    
    // 結果を表示
    console.log('\n=== テスト結果 ===');
    const successCount = results.filter(r => r).length;
    const totalCount = results.length;
    console.log(`成功: ${successCount}/${totalCount}`);
    
    if (successCount === totalCount) {
        console.log('\nすべてのテストが成功しました！');
        process.exit(0);
    } else {
        console.log('\n一部のテストが失敗しました。');
        process.exit(1);
    }
}

// スクリプトを実行
main().catch(error => {
    console.error('致命的なエラー:', error);
    process.exit(1);
});

