#!/usr/bin/env node

/**
 * test-003を単体で実行し、タイムアウトが発生している箇所を特定するスクリプト
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
 * タイムスタンプ付きログ
 */
function log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
}

/**
 * test-003のテストを実行（タイムアウト箇所を特定）
 */
async function test003Standalone() {
    let browser = null;
    const timings = {};
    
    try {
        log('ブラウザ起動開始');
        const browserStartTime = Date.now();
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        timings.browserLaunch = Date.now() - browserStartTime;
        log(`ブラウザ起動完了: ${timings.browserLaunch}ms`);
        
        const page = await browser.newPage();
        
        // コンソールメッセージを監視（すべてのメッセージを保存）
        const consoleMessages = [];
        page.on('console', msg => {
            const type = msg.type();
            const text = msg.text();
            const message = `[ブラウザコンソール ${type}] ${text}`;
            log(message);
            consoleMessages.push({ type, text, timestamp: Date.now() });
        });
        
        // ページエラーを監視
        const pageErrors = [];
        page.on('pageerror', error => {
            const errorMessage = `[ページエラー] ${error.message}`;
            log(errorMessage);
            pageErrors.push({ message: error.message, stack: error.stack, timestamp: Date.now() });
        });
        
        // ネットワークリクエストを監視
        const networkRequests = [];
        page.on('request', request => {
            const url = request.url();
            log(`[ネットワークリクエスト] ${request.method()} ${url}`);
            networkRequests.push({
                url: url,
                method: request.method(),
                timestamp: Date.now()
            });
        });
        
        page.on('response', response => {
            const url = response.url();
            log(`[ネットワークレスポンス] ${response.status()} ${url}`);
        });
        
        log('chartcanvas.js読み込み開始');
        const chartCanvasStartTime = Date.now();
        const chartCanvasCode = fs.readFileSync(CHART_CANVAS_PATH, 'utf-8');
        timings.chartCanvasRead = Date.now() - chartCanvasStartTime;
        log(`chartcanvas.js読み込み完了: ${timings.chartCanvasRead}ms (サイズ: ${chartCanvasCode.length}文字)`);
        
        log('TSVデータ読み込み開始');
        const tsvStartTime = Date.now();
        const tsvData = readTSVFile(path.join(SAMPLE_DATA_DIR, 'data.tsv'));
        timings.tsvRead = Date.now() - tsvStartTime;
        log(`TSVデータ読み込み完了: ${timings.tsvRead}ms (行数: ${tsvData.rows.length})`);
        
        log('最小限のHTMLページを作成');
        const minimalHTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><div id="chart_div"></div></body></html>`;
        await page.setContent(minimalHTML, { waitUntil: 'domcontentloaded' });
        
        log('ChartCanvasコードを実行開始');
        const evaluateStartTime = Date.now();
        try {
            const result = await page.evaluate(async (chartCanvasCode, tsvData) => {
                // ChartCanvasコードを実行
                eval(chartCanvasCode);
                
                console.log('ChartCanvas読み込み完了');
                
                // DOM要素を取得してChartCanvasを作成
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
                chart.render();
                console.log('render完了');
                
                console.log('getSVGString開始');
                const svgString = chart.getSVGString();
                console.log('SVG文字列取得完了, 長さ:', svgString.length);
                
                return {
                    success: true,
                    svgString: svgString
                };
            }, chartCanvasCode, tsvData);
            
            timings.evaluate = Date.now() - evaluateStartTime;
            log(`ChartCanvasコード実行完了: ${timings.evaluate}ms`);
            
            if (!result.success) {
                throw new Error(result.error + '\n' + (result.stack || ''));
            }
            
            log('SVG保存開始');
            const svgPath = path.join(TEST_OUTPUT_DIR, 'test-003-standalone.svg');
            fs.writeFileSync(svgPath, result.svgString, 'utf-8');
            log(`SVGを保存: ${svgPath}`);
            
            log('\n=== タイミング情報 ===');
            Object.entries(timings).forEach(([key, value]) => {
                log(`${key}: ${value}ms`);
            });
            
            log('\nテスト成功');
            return;
            
        } catch (error) {
            timings.evaluate = Date.now() - evaluateStartTime;
            log(`ChartCanvasコード実行エラー (${timings.evaluate}ms経過): ${error.message}`);
            throw error;
        }
        
        
    } catch (error) {
        log(`\n=== エラー発生 ===`);
        log(`エラーメッセージ: ${error.message}`);
        log(`エラースタック: ${error.stack}`);
        log('\n=== タイミング情報 ===');
        Object.entries(timings).forEach(([key, value]) => {
            log(`${key}: ${value}ms`);
        });
        throw error;
    } finally {
        if (browser) {
            log('ブラウザ終了');
            await browser.close();
        }
    }
}

// スクリプトを実行
test003Standalone().catch(error => {
    console.error('致命的なエラー:', error);
    process.exit(1);
});

