#!/usr/bin/env node

/**
 * すべてのサンプルHTMLファイルをサーバー側で実行するテストスクリプト
 * 
 * 002.html, 003.html, 004.html, 005.html, 006.htmlをそれぞれ実行し、
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
 * 002.htmlのテスト: 売上・客数推移（複数データセット）
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
        const data1monthContent = fs.readFileSync(path.join(SAMPLE_DATA_DIR, 'data2.tsv'), 'utf-8');
        const data3monthsContent = fs.readFileSync(path.join(SAMPLE_DATA_DIR, 'data-3months.tsv'), 'utf-8');
        const data1yearContent = fs.readFileSync(path.join(SAMPLE_DATA_DIR, 'data-1year.tsv'), 'utf-8');
        
        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <script>
        // fetchをモックしてTSVファイルを読み込めるようにする
        const originalFetch = window.fetch;
        window.fetch = async function(url) {
            const urlMap = {
                './data-7days.tsv': ${JSON.stringify(data7daysContent)},
                './data2.tsv': ${JSON.stringify(data1monthContent)},
                './data-3months.tsv': ${JSON.stringify(data3monthsContent)},
                './data-1year.tsv': ${JSON.stringify(data1yearContent)}
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
        (async () => {
            try {
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

                // データファイルの定義
                const dataFiles = {
                    '7days': {
                        file: './data-7days.tsv',
                        subtitle: '7日分のデータ'
                    }
                };

                // データを読み込んでレンダリングする関数
                async function loadAndRender(dataKey) {
                    const dataConfig = dataFiles[dataKey];
                    if (!dataConfig) {
                        console.error('無効なデータキー:', dataKey);
                        return;
                    }

                    chart.subtitle = dataConfig.subtitle;

                    // TSVローダーに系列と列名を紐づける
                    const loader = dateChart.tsvLoader(dataConfig.file);
                    loader.dateTitle = '日付';
                    loader.commentTitle = 'コメント';
                    loader.addSeries(salesLine, '売上');
                    loader.addSeries(customerBar, '客数');

                    try {
                        await loader.load();
                        chart.render();
                    } catch (error) {
                        console.error('TSVファイルの読み込みエラー:', error);
                        chart.render();
                    }
                }

                // 初期データを読み込む
                await loadAndRender('7days');
                
                // SVG文字列を取得
                const svgString = chart.getSVGString();
                window.testResult = { success: true, svgString: svgString };
            } catch (error) {
                window.testResult = { success: false, error: error.message, stack: error.stack };
            }
        })();
    </script>
</body>
</html>`;
        
        await page.setContent(html, { waitUntil: 'networkidle0' });
        await page.waitForFunction(() => window.testResult !== undefined, { timeout: 15000 });
        
        const result = await page.evaluate(() => window.testResult);
        if (!result.success) {
            throw new Error(result.error + '\n' + (result.stack || ''));
        }
        
        const svgPath = path.join(TEST_OUTPUT_DIR, 'test-002.svg');
        fs.writeFileSync(svgPath, result.svgString, 'utf-8');
        console.log(`  SVGを保存: ${svgPath}`);
        
        const pngPath = path.join(TEST_OUTPUT_DIR, 'test-002.png');
        await convertSVGToPNG(result.svgString, pngPath);
        console.log(`  PNGを保存: ${pngPath}`);
        
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

/**
 * 003.htmlのテスト: 店舗別売上推移
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
        
        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <script>${chartCanvasCode}</script>
</head>
<body>
    <div id="chart_div"></div>
    <script>
        console.log('スクリプト読み込み開始');
        (async () => {
            try {
                console.log('非同期関数開始');
                const chart_div = document.getElementById('chart_div');
                console.log('chart_div取得:', chart_div ? '成功' : '失敗');
                if (!chart_div) {
                    throw new Error('chart_divが取得できませんでした');
                }
                const chart = new ChartCanvas(chart_div);
                console.log('ChartCanvas作成完了');
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
                const tsvData = ${JSON.stringify(tsvData)};
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
                            // 日付をYYYYMMDD形式に正規化（YYYY-MM-DD形式をサポート）
                            let dateFormatted = row['日付'];
                            if (dateFormatted.match(/^\d{4}-\d{2}-\d{2}$/)) {
                                dateFormatted = dateFormatted.replace(/-/g, '');
                            } else if (dateFormatted.match(/^\d{4}\/\d{2}\/\d{2}$/)) {
                                dateFormatted = dateFormatted.replace(/\//g, '');
                            }
                            // 正規化後の日付が8桁の数字であることを確認
                            if (!dateFormatted.match(/^\d{8}$/)) {
                                console.error('日付の正規化に失敗:', row['日付'], '->', dateFormatted);
                                return; // 不正な日付はスキップ
                            }
                            line.addData(dateFormatted, parseFloat(row['売上']), row['コメント'] || '');
                            dataCount++;
                        }
                    });
                    console.log('店舗', storeName, 'データ数:', dataCount);
                    colorIndex++;
                }

                console.log('render開始');
                try {
                    chart.render();
                    console.log('render完了');
                } catch (renderError) {
                    console.error('renderエラー:', renderError);
                    throw renderError;
                }
                console.log('getSVGString開始');
                try {
                    const svgString = chart.getSVGString();
                    console.log('SVG文字列取得完了, 長さ:', svgString.length);
                    window.testResult = { success: true, svgString: svgString };
                    console.log('testResult設定完了');
                } catch (svgError) {
                    console.error('getSVGStringエラー:', svgError);
                    throw svgError;
                }
            } catch (error) {
                console.error('エラー発生:', error);
                window.testResult = { success: false, error: error.message, stack: error.stack };
            }
        })();
    </script>
</body>
</html>`;
        
        // コンソールメッセージを監視（setContentの前に設定）
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
        
        await page.setContent(html, { waitUntil: 'networkidle0' });
        
        // エラーが発生している可能性があるので、少し待ってから結果を確認
        try {
            // まず、スクリプトが実行されるまで待つ（ChartCanvasが読み込まれるまで）
            await page.waitForFunction(() => typeof window.ChartCanvas !== 'undefined', { timeout: 5000 });
            
            // スクリプトが実行されるまで少し待つ（非同期関数が開始されるまで）
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // testResultが設定されるまで待つ（最大20秒）
            await page.waitForFunction(() => window.testResult !== undefined, { timeout: 20000 });
        } catch (error) {
            // タイムアウトした場合、エラーの詳細を確認
            const pageState = await page.evaluate(() => {
                return {
                    testResult: window.testResult,
                    hasError: window.testResult !== undefined && !window.testResult.success,
                    error: window.testResult ? window.testResult.error : null,
                    stack: window.testResult ? window.testResult.stack : null
                };
            });
            console.error('ページの状態:', JSON.stringify(pageState, null, 2));
            if (pageState.hasError) {
                throw new Error(pageState.error + '\n' + (pageState.stack || ''));
            }
            // スクリプトが実行されていない可能性がある
            const scriptState = await page.evaluate(() => {
                return {
                    chartCanvasLoaded: typeof window.ChartCanvas !== 'undefined',
                    testResult: window.testResult,
                    consoleLogs: window.consoleLogs || [],
                    error: window.error || null,
                    chartDivExists: document.getElementById('chart_div') !== null
                };
            });
            console.error('スクリプトの状態:', JSON.stringify(scriptState, null, 2));
            
            // エラーが発生している可能性があるので、エラーハンドラを確認
            const pageErrors = await page.evaluate(() => {
                return window.pageErrors || [];
            });
            if (pageErrors.length > 0) {
                console.error('ページエラー:', pageErrors);
            }
            
            if (!scriptState.chartCanvasLoaded) {
                throw new Error('ChartCanvasが読み込まれていません。スクリプトが実行されていない可能性があります。');
            }
            if (!scriptState.chartDivExists) {
                throw new Error('chart_divが存在しません。');
            }
            // スクリプトが実行されているが、testResultが設定されていない場合
            if (scriptState.testResult === undefined) {
                // スクリプトが実行されているか確認するため、少し待つ
                await new Promise(resolve => setTimeout(resolve, 2000));
                const finalState = await page.evaluate(() => window.testResult);
                if (finalState === undefined) {
                    throw new Error('スクリプトは実行されていますが、testResultが設定されていません。スクリプトが完了していない可能性があります。');
                }
            }
            throw error;
        }
        
        const result = await page.evaluate(() => window.testResult);
        if (!result.success) {
            throw new Error(result.error + '\n' + result.stack);
        }
        
        const svgPath = path.join(TEST_OUTPUT_DIR, 'test-003.svg');
        fs.writeFileSync(svgPath, result.svgString, 'utf-8');
        console.log(`  SVGを保存: ${svgPath}`);
        
        const pngPath = path.join(TEST_OUTPUT_DIR, 'test-003.png');
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
        
        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <script>${chartCanvasCode}</script>
</head>
<body>
    <div id="chart_div"></div>
    <script>
        (async () => {
            try {
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

                // TSVローダーを使用
                const loader = histogram.tsvLoader('data-histogram.tsv');
                loader.valueTitle = '値';

                // TSVデータを直接設定
                const tsvData = ${JSON.stringify(tsvData)};
                
                // ローダーにデータを設定（内部処理をシミュレート）
                const values = tsvData.rows
                    .map(row => parseFloat(row['値']))
                    .filter(v => !isNaN(v));
                
                // ヒストグラムに直接データを追加（内部APIを使用）
                // 実際の実装では、loader.load()がこれを行う
                values.forEach(value => {
                    if (!histogram.data) histogram.data = [];
                    histogram.data.push(value);
                });

                chart.render();
                window.testResult = { success: true, svgString: chart.getSVGString() };
            } catch (error) {
                window.testResult = { success: false, error: error.message, stack: error.stack };
            }
        })();
    </script>
</body>
</html>`;
        
        await page.setContent(html, { waitUntil: 'networkidle0' });
        await page.waitForFunction(() => window.testResult !== undefined, { timeout: 10000 });
        
        const result = await page.evaluate(() => window.testResult);
        if (!result.success) {
            throw new Error(result.error + '\n' + result.stack);
        }
        
        const svgPath = path.join(TEST_OUTPUT_DIR, 'test-004.svg');
        fs.writeFileSync(svgPath, result.svgString, 'utf-8');
        console.log(`  SVGを保存: ${svgPath}`);
        
        const pngPath = path.join(TEST_OUTPUT_DIR, 'test-004.png');
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
        
        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <script>${chartCanvasCode}</script>
</head>
<body>
    <div id="chart_div"></div>
    <script>
        (async () => {
            try {
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

                // TSVローダーを使用
                const loader = histogram.tsvLoader('data-histogram.tsv');
                loader.valueTitle = '値';

                const tsvData = ${JSON.stringify(tsvData)};
                const values = tsvData.rows
                    .map(row => parseFloat(row['値']))
                    .filter(v => !isNaN(v));
                
                // ヒストグラムに直接データを追加（内部APIを使用）
                if (!histogram.data) histogram.data = [];
                values.forEach(value => {
                    histogram.data.push(value);
                });

                chart.render();
                window.testResult = { success: true, svgString: chart.getSVGString() };
            } catch (error) {
                window.testResult = { success: false, error: error.message, stack: error.stack };
            }
        })();
    </script>
</body>
</html>`;
        
        await page.setContent(html, { waitUntil: 'networkidle0' });
        await page.waitForFunction(() => window.testResult !== undefined, { timeout: 10000 });
        
        const result = await page.evaluate(() => window.testResult);
        if (!result.success) {
            throw new Error(result.error + '\n' + result.stack);
        }
        
        const svgPath = path.join(TEST_OUTPUT_DIR, 'test-005.svg');
        fs.writeFileSync(svgPath, result.svgString, 'utf-8');
        console.log(`  SVGを保存: ${svgPath}`);
        
        const pngPath = path.join(TEST_OUTPUT_DIR, 'test-005.png');
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
        
        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <script>${chartCanvasCode}</script>
</head>
<body>
    <div id="chart_div"></div>
    <script>
        (async () => {
            try {
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

                const tsvData = ${JSON.stringify(tsvData)};
                
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
                window.testResult = { success: true, svgString: chart.getSVGString() };
            } catch (error) {
                window.testResult = { success: false, error: error.message, stack: error.stack };
            }
        })();
    </script>
</body>
</html>`;
        
        await page.setContent(html, { waitUntil: 'networkidle0' });
        await page.waitForFunction(() => window.testResult !== undefined, { timeout: 10000 });
        
        const result = await page.evaluate(() => window.testResult);
        if (!result.success) {
            throw new Error(result.error + '\n' + result.stack);
        }
        
        const svgPath = path.join(TEST_OUTPUT_DIR, 'test-006.svg');
        fs.writeFileSync(svgPath, result.svgString, 'utf-8');
        console.log(`  SVGを保存: ${svgPath}`);
        
        const pngPath = path.join(TEST_OUTPUT_DIR, 'test-006.png');
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
    console.log('すべてのサンプルHTMLファイルのテストを開始します...');
    console.log(`テスト出力ディレクトリ: ${TEST_OUTPUT_DIR}`);
    
    const results = [];
    
    // 各テストを実行
    results.push(await runTest('002.html: 売上・客数推移', test002));
    results.push(await runTest('003.html: 店舗別売上推移', test003));
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

