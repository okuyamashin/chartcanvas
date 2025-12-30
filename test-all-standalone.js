#!/usr/bin/env node

/**
 * すべてのサンプルをstandalone形式（HTMLを使わない）でテストするスクリプト
 * 
 * 001.html, 002.html, 003.html, 004.html, 005.html, 006.htmlをそれぞれ実行し、
 * SVGとPNGを生成してテスト出力ディレクトリに保存します。
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
 * 001.htmlのテスト: 基本的な日付チャート、売上と売上構成比（第二軸）
 */
async function test001() {
    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        const chartCanvasCode = fs.readFileSync(CHART_CANVAS_PATH, 'utf-8');
        
        const minimalHTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><div id="chart_div"></div></body></html>`;
        await page.setContent(minimalHTML, { waitUntil: 'domcontentloaded' });
        
        const result = await page.evaluate(async (chartCanvasCode) => {
            // ChartCanvasコードを実行
            eval(chartCanvasCode);
            
            const chart_div = document.getElementById('chart_div');
            const chart = new ChartCanvas(chart_div);
            chart.size(1024, 600);
            
            const dateChart = chart.addDateChart();
            dateChart.xAxisTitle = '日付';
            dateChart.yAxisTitle = '売上';
            dateChart.yAxisScale = '万円';
            dateChart.yAxisFormat = '#,##0';
            dateChart.title = '売上推移';
            dateChart.subtitle = '2025/01/01 - 2025/01/09';
            dateChart.secondAxis = true;
            dateChart.secondAxisTitle = '売上構成比';
            dateChart.secondAxisScale = '%';
            dateChart.secondAxisFormat = '#,##0%';

            const firstLine = dateChart.addLine({
                title: '売上',
                color: 'red',
                lineWidth: 2,
                lineType: 'solid'
            });
            firstLine.addData('20250101', 20000);
            firstLine.addData('20250102', 21000);
            firstLine.addData('20250103', 22000);
            firstLine.addData('20250104', 23000);
            firstLine.addData('20250105', 24000);
            firstLine.addData('20250106', 25000);
            firstLine.addData('20250107', 26000);
            firstLine.addData('20250108', 27000, 'This day is holiday');
            firstLine.addData('20250109', 24000);
            
            const secondLine = dateChart.addBar({
                title: '売上構成比',
                color: 'blue',
                secondAxis: true
            });
            secondLine.addRatioData('20250101', 20000, 500000);
            secondLine.addRatioData('20250102', 21000, 510000);
            secondLine.addRatioData('20250103', 22000, 520000);
            secondLine.addRatioData('20250104', 23000, 530000);
            secondLine.addRatioData('20250105', 24000, 540000, 'tool tip text');
            secondLine.addRatioData('20250106', 25000, 550000);
            secondLine.addRatioData('20250107', 26000, 560000);
            secondLine.addRatioData('20250108', 27000, 570000);
            secondLine.addRatioData('20250109', 28000, 580000);

            chart.render();
            
            return {
                success: true,
                svgString: chart.getSVGString()
            };
        }, chartCanvasCode);
        
        if (!result.success) {
            throw new Error(result.error + '\n' + (result.stack || ''));
        }
        
        const svgPath = path.join(TEST_OUTPUT_DIR, 'test-001-standalone.svg');
        fs.writeFileSync(svgPath, result.svgString, 'utf-8');
        console.log(`  SVGを保存: ${svgPath}`);
        
        const pngPath = path.join(TEST_OUTPUT_DIR, 'test-001-standalone.png');
        await convertSVGToPNG(result.svgString, pngPath);
        console.log(`  PNGを保存: ${pngPath}`);
        
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

/**
 * 002.htmlのテスト: 売上・客数推移（TSVローダー使用）
 */
async function test002() {
    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        const chartCanvasCode = fs.readFileSync(CHART_CANVAS_PATH, 'utf-8');
        
        // TSVファイルの内容を読み込む
        const data7daysContent = fs.readFileSync(path.join(SAMPLE_DATA_DIR, 'data-7days.tsv'), 'utf-8');
        
        const minimalHTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><div id="chart_div"></div></body></html>`;
        await page.setContent(minimalHTML, { waitUntil: 'domcontentloaded' });
        
        const result = await page.evaluate(async (chartCanvasCode, data7daysContent) => {
            // fetchをモックしてTSVファイルを読み込めるようにする
            const originalFetch = window.fetch;
            window.fetch = async function(url) {
                if (url.includes('data-7days.tsv') || url.endsWith('data-7days.tsv')) {
                    return {
                        ok: true,
                        text: async () => data7daysContent
                    };
                }
                return originalFetch.apply(this, arguments);
            };
            
            // ChartCanvasコードを実行
            eval(chartCanvasCode);
            
            const chart_div = document.getElementById('chart_div');
            const chart = new ChartCanvas(chart_div);
            chart.size(1024, 600);
            chart.title = '売上・客数推移';

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

            // TSVローダーに系列と列名を紐づける
            const loader = dateChart.tsvLoader('./data-7days.tsv');
            loader.dateTitle = '日付';
            loader.commentTitle = 'コメント';
            loader.addSeries(salesLine, '売上');
            loader.addSeries(customerBar, '客数');

            chart.subtitle = '7日分のデータ';

            await loader.load();
            chart.render();
            
            return {
                success: true,
                svgString: chart.getSVGString()
            };
        }, chartCanvasCode, data7daysContent);
        
        if (!result.success) {
            throw new Error(result.error + '\n' + (result.stack || ''));
        }
        
        const svgPath = path.join(TEST_OUTPUT_DIR, 'test-002-standalone.svg');
        fs.writeFileSync(svgPath, result.svgString, 'utf-8');
        console.log(`  SVGを保存: ${svgPath}`);
        
        const pngPath = path.join(TEST_OUTPUT_DIR, 'test-002-standalone.png');
        await convertSVGToPNG(result.svgString, pngPath);
        console.log(`  PNGを保存: ${pngPath}`);
        
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

/**
 * 003.htmlのテスト: 店舗別売上推移（TSVローダー使用、グループ化）
 */
async function test003() {
    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        const chartCanvasCode = fs.readFileSync(CHART_CANVAS_PATH, 'utf-8');
        const tsvData = readTSVFile(path.join(SAMPLE_DATA_DIR, 'data.tsv'));
        
        const minimalHTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><div id="chart_div"></div></body></html>`;
        await page.setContent(minimalHTML, { waitUntil: 'domcontentloaded' });
        
        const result = await page.evaluate(async (chartCanvasCode, tsvData) => {
            // ChartCanvasコードを実行
            eval(chartCanvasCode);
            
            const chart_div = document.getElementById('chart_div');
            const chart = new ChartCanvas(chart_div);
            chart.size(1024, 600);
            chart.title = '店舗別売上推移';

            const dateChart = chart.addDateChart();
            dateChart.xAxisTitle = '日付';
            dateChart.yAxisTitle = '売上';
            dateChart.yAxisScale = '円';
            dateChart.yAxisFormat = '#,##0';
            dateChart.dateFormat = 'auto';
            dateChart.xGrid = true;
            dateChart.yGrid = true;

            // TSVデータを直接設定
            console.log('TSVデータ読み込み完了:', tsvData.rows.length, '行');
            
            // 店舗名ごとにグループ化
            const stores = {};
            tsvData.rows.forEach(row => {
                const storeName = row['店舗名'] || '未分類';
                if (!stores[storeName]) {
                    stores[storeName] = [];
                }
                stores[storeName].push(row);
            });
            console.log('店舗数:', Object.keys(stores).length);

            // 各店舗の系列を作成
            const colors = ['red', 'blue', 'green', 'orange', 'purple', 'brown'];
            let colorIndex = 0;
            for (const [storeName, rows] of Object.entries(stores)) {
                const line = dateChart.addLine({
                    title: storeName,
                    color: colors[colorIndex % colors.length],
                    lineWidth: 2,
                    lineType: 'solid',
                    showMarkers: true
                });
                
                let dataCount = 0;
                rows.forEach(row => {
                    if (row['日付'] && row['売上']) {
                        // 日付をYYYYMMDD形式に正規化
                        let dateFormatted = row['日付'];
                        if (dateFormatted.match(/^\d{4}-\d{2}-\d{2}$/)) {
                            dateFormatted = dateFormatted.replace(/-/g, '');
                        } else if (dateFormatted.match(/^\d{4}\/\d{2}\/\d{2}$/)) {
                            dateFormatted = dateFormatted.replace(/\//g, '');
                        }
                        if (dateFormatted.match(/^\d{8}$/)) {
                            line.addData(dateFormatted, parseFloat(row['売上']), row['コメント'] || '');
                            dataCount++;
                        }
                    }
                });
                console.log('店舗', storeName, 'データ数:', dataCount);
                colorIndex++;
            }

            chart.render();
            
            return {
                success: true,
                svgString: chart.getSVGString()
            };
        }, chartCanvasCode, tsvData);
        
        if (!result.success) {
            throw new Error(result.error + '\n' + (result.stack || ''));
        }
        
        const svgPath = path.join(TEST_OUTPUT_DIR, 'test-003-standalone.svg');
        fs.writeFileSync(svgPath, result.svgString, 'utf-8');
        console.log(`  SVGを保存: ${svgPath}`);
        
        const pngPath = path.join(TEST_OUTPUT_DIR, 'test-003-standalone.png');
        await convertSVGToPNG(result.svgString, pngPath);
        console.log(`  PNGを保存: ${pngPath}`);
        
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

/**
 * 004.htmlのテスト: ヒストグラム（生データ形式）
 */
async function test004() {
    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        const chartCanvasCode = fs.readFileSync(CHART_CANVAS_PATH, 'utf-8');
        const tsvData = readTSVFile(path.join(SAMPLE_DATA_DIR, 'data-histogram.tsv'));
        
        const minimalHTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><div id="chart_div"></div></body></html>`;
        await page.setContent(minimalHTML, { waitUntil: 'domcontentloaded' });
        
        const result = await page.evaluate(async (chartCanvasCode, tsvData) => {
            // ChartCanvasコードを実行
            eval(chartCanvasCode);
            
            const chart = new ChartCanvas(null);
            chart.size(1024, 600);
            chart.title = '売上の分布';
            chart.subtitle = '全店舗の売上データ';

            const histogram = chart.addHistogram();
            histogram.xAxisTitle = '売上';
            histogram.yAxisTitle = '頻度';
            histogram.xAxisFormat = '#,##0';
            histogram.yAxisFormat = '#,##0';
            histogram.title = '売上の分布';
            histogram.subtitle = '全店舗の売上データ';

            // TSVデータから値を抽出
            const values = tsvData.rows
                .map(row => parseFloat(row['値']))
                .filter(v => !isNaN(v));
            
            // ヒストグラム系列を作成してデータを追加
            const series = histogram.addSeries({
                title: '売上の分布',
                color: 'blue'
            });
            
            values.forEach(value => {
                series.addData(value);
            });

            chart.render();
            
            return {
                success: true,
                svgString: chart.getSVGString()
            };
        }, chartCanvasCode, tsvData);
        
        if (!result.success) {
            throw new Error(result.error + '\n' + (result.stack || ''));
        }
        
        const svgPath = path.join(TEST_OUTPUT_DIR, 'test-004-standalone.svg');
        fs.writeFileSync(svgPath, result.svgString, 'utf-8');
        console.log(`  SVGを保存: ${svgPath}`);
        
        const pngPath = path.join(TEST_OUTPUT_DIR, 'test-004-standalone.png');
        await convertSVGToPNG(result.svgString, pngPath);
        console.log(`  PNGを保存: ${pngPath}`);
        
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

/**
 * 005.htmlのテスト: ヒストグラム（ベジェ曲線モード）
 */
async function test005() {
    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        const chartCanvasCode = fs.readFileSync(CHART_CANVAS_PATH, 'utf-8');
        const tsvData = readTSVFile(path.join(SAMPLE_DATA_DIR, 'data-histogram.tsv'));
        
        const minimalHTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><div id="chart_div"></div></body></html>`;
        await page.setContent(minimalHTML, { waitUntil: 'domcontentloaded' });
        
        const result = await page.evaluate(async (chartCanvasCode, tsvData) => {
            // ChartCanvasコードを実行
            eval(chartCanvasCode);
            
            const chart = new ChartCanvas(null);
            chart.size(1024, 600);
            chart.title = '売上の分布（ベジェ曲線）';
            chart.subtitle = '全店舗の売上データ';

            const histogram = chart.addHistogram();
            histogram.xAxisTitle = '売上';
            histogram.yAxisTitle = '頻度';
            histogram.xAxisFormat = '#,##0';
            histogram.yAxisFormat = '#,##0';
            histogram.title = '売上の分布（ベジェ曲線）';
            histogram.subtitle = '全店舗の売上データ';
            histogram.curveMode = true;

            // TSVデータから値を抽出
            const values = tsvData.rows
                .map(row => parseFloat(row['値']))
                .filter(v => !isNaN(v));
            
            // ヒストグラム系列を作成してデータを追加
            const series = histogram.addSeries({
                title: '売上の分布',
                color: 'blue'
            });
            
            values.forEach(value => {
                series.addData(value);
            });

            chart.render();
            
            return {
                success: true,
                svgString: chart.getSVGString()
            };
        }, chartCanvasCode, tsvData);
        
        if (!result.success) {
            throw new Error(result.error + '\n' + (result.stack || ''));
        }
        
        const svgPath = path.join(TEST_OUTPUT_DIR, 'test-005-standalone.svg');
        fs.writeFileSync(svgPath, result.svgString, 'utf-8');
        console.log(`  SVGを保存: ${svgPath}`);
        
        const pngPath = path.join(TEST_OUTPUT_DIR, 'test-005-standalone.png');
        await convertSVGToPNG(result.svgString, pngPath);
        console.log(`  PNGを保存: ${pngPath}`);
        
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

/**
 * 006.htmlのテスト: ヒストグラム（複数店舗）
 */
async function test006() {
    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        const chartCanvasCode = fs.readFileSync(CHART_CANVAS_PATH, 'utf-8');
        const tsvData = readTSVFile(path.join(SAMPLE_DATA_DIR, 'data-histogram-multi-store.tsv'));
        
        const minimalHTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><div id="chart_div"></div></body></html>`;
        await page.setContent(minimalHTML, { waitUntil: 'domcontentloaded' });
        
        const result = await page.evaluate(async (chartCanvasCode, tsvData) => {
            // ChartCanvasコードを実行
            eval(chartCanvasCode);
            
            const chart = new ChartCanvas(null);
            chart.size(1024, 600);
            chart.title = '売上の分布（店舗別）';
            chart.subtitle = '各店舗の売上データの分布を比較';

            const histogram = chart.addHistogram();
            histogram.xAxisTitle = '売上';
            histogram.yAxisTitle = '頻度';
            histogram.xAxisFormat = '#,##0';
            histogram.yAxisFormat = '#,##0';
            histogram.title = '売上の分布（店舗別）';
            histogram.subtitle = '各店舗の売上データの分布を比較';
            histogram.curveMode = true;
            histogram.xGrid = true;
            histogram.yGrid = true;

            // 店舗名ごとにグループ化
            const stores = {};
            tsvData.rows.forEach(row => {
                const storeName = row['店舗名'] || '未分類';
                if (!stores[storeName]) {
                    stores[storeName] = [];
                }
                if (row['値']) {
                    stores[storeName].push(parseFloat(row['値']));
                }
            });

            // 各店舗のヒストグラム系列を作成
            const colors = ['red', 'blue', 'green', 'orange', 'purple', 'brown'];
            let colorIndex = 0;
            for (const [storeName, values] of Object.entries(stores)) {
                const series = histogram.addSeries({
                    title: storeName,
                    color: colors[colorIndex % colors.length]
                });
                
                values.forEach(value => {
                    if (!isNaN(value)) {
                        series.addData(value);
                    }
                });
                colorIndex++;
            }

            chart.render();
            
            return {
                success: true,
                svgString: chart.getSVGString()
            };
        }, chartCanvasCode, tsvData);
        
        if (!result.success) {
            throw new Error(result.error + '\n' + (result.stack || ''));
        }
        
        const svgPath = path.join(TEST_OUTPUT_DIR, 'test-006-standalone.svg');
        fs.writeFileSync(svgPath, result.svgString, 'utf-8');
        console.log(`  SVGを保存: ${svgPath}`);
        
        const pngPath = path.join(TEST_OUTPUT_DIR, 'test-006-standalone.png');
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
    console.log('すべてのサンプルのstandaloneテストを開始します...');
    console.log(`テスト出力ディレクトリ: ${TEST_OUTPUT_DIR}`);
    
    const results = [];
    
    // 各テストを実行
    results.push(await runTest('001.html: 基本的な日付チャート、売上と売上構成比', test001));
    results.push(await runTest('002.html: 売上・客数推移（TSVローダー使用）', test002));
    results.push(await runTest('003.html: 店舗別売上推移（TSVローダー使用、グループ化）', test003));
    results.push(await runTest('004.html: ヒストグラム（生データ形式）', test004));
    results.push(await runTest('005.html: ヒストグラム（ベジェ曲線モード）', test005));
    results.push(await runTest('006.html: ヒストグラム（複数店舗）', test006));
    
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

