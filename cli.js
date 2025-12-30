#!/usr/bin/env node

/**
 * ChartCanvas CLI Tool
 * 
 * コマンドラインからChartCanvasを使用してSVGを生成するツール
 * 
 * 使用方法:
 *   node cli.js [OPTIONS] [CONFIG]
 * 
 * オプション:
 *   -c, --config <file>    設定ファイル（JSON）のパスを指定
 *   -j, --json <json>      設定を直接JSON文字列で指定
 *   -h, --help             ヘルプを表示
 *   -v, --version          バージョンを表示
 * 
 * 設定の指定方法:
 *   1. JSONファイルから読み込む: -c config.json
 *   2. 直接JSON文字列で指定: -j '{"title":"..."}'
 *   3. 引数として直接指定: node cli.js '{"title":"..."}'
 * 
 * 入力:
 *   TSVデータは標準入力から読み込まれます
 * 
 * 出力:
 *   SVGは標準出力に出力されます
 */

const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const puppeteer = require('puppeteer');

// バージョン情報
const VERSION = require('./package.json').version;

// ChartCanvasのパス
const CHART_CANVAS_PATH = path.join(__dirname, 'chartcanvas.js');

/**
 * ヘルプを表示
 */
function showHelp() {
    console.log(`
ChartCanvas CLI Tool v${VERSION}

使用方法:
  node cli.js [OPTIONS] [CONFIG]

オプション:
  -c, --config <file>    設定ファイル（JSON）のパスを指定
  -j, --json <json>      設定を直接JSON文字列で指定
  -h, --help             ヘルプを表示
  -v, --version          バージョンを表示

設定の指定方法:
  1. JSONファイルから読み込む:
     cat data.tsv | node cli.js -c config.json > output.svg
  
  2. 直接JSON文字列で指定:
     cat data.tsv | node cli.js -j '{"chart":{"title":"売上推移"}}' > output.svg
  
  3. 引数として直接指定:
     cat data.tsv | node cli.js '{"chart":{"title":"売上推移"}}' > output.svg

入力:
  TSVデータは標準入力から読み込まれます

出力:
  SVGは標準出力に出力されます

エラー:
  エラーメッセージは標準エラー出力に出力されます
`);
}

/**
 * コマンドライン引数を解析
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        configFile: null,
        jsonConfig: null,
        help: false,
        version: false
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        if (arg === '-h' || arg === '--help') {
            options.help = true;
        } else if (arg === '-v' || arg === '--version') {
            options.version = true;
        } else if (arg === '-c' || arg === '--config') {
            if (i + 1 < args.length) {
                options.configFile = args[++i];
            } else {
                throw new Error('Error: -c/--config requires a file path');
            }
        } else if (arg === '-j' || arg === '--json') {
            if (i + 1 < args.length) {
                options.jsonConfig = args[++i];
            } else {
                throw new Error('Error: -j/--json requires a JSON string');
            }
        } else if (!arg.startsWith('-')) {
            // 位置引数として設定JSONを指定
            if (!options.jsonConfig && !options.configFile) {
                options.jsonConfig = arg;
            }
        }
    }

    return options;
}

/**
 * 設定を読み込む
 */
function loadConfig(options) {
    if (options.configFile) {
        // ファイルから読み込む
        if (!fs.existsSync(options.configFile)) {
            throw new Error(`Error: Config file not found: ${options.configFile}`);
        }
        const configContent = fs.readFileSync(options.configFile, 'utf-8');
        try {
            return JSON.parse(configContent);
        } catch (error) {
            throw new Error(`Error: Invalid JSON in config file: ${error.message}`);
        }
    } else if (options.jsonConfig) {
        // JSON文字列から読み込む
        try {
            return JSON.parse(options.jsonConfig);
        } catch (error) {
            throw new Error(`Error: Invalid JSON string: ${error.message}`);
        }
    } else {
        throw new Error('Error: No configuration specified. Use -c/--config, -j/--json, or provide config as argument');
    }
}

/**
 * 設定を検証
 */
function validateConfig(config) {
    if (!config.chartType) {
        throw new Error('Error: Required field missing: chartType');
    }

    const chartType = config.chartType;
    
    if (!['dateChart', 'groupDateChart', 'histogram'].includes(chartType)) {
        throw new Error(`Error: Invalid chartType: ${chartType}. Must be one of: dateChart, groupDateChart, histogram`);
    }

    if (!config.tsv) {
        throw new Error('Error: Required field missing: tsv');
    }

    // チャートタイプごとの必須項目をチェック
    if (chartType === 'dateChart' || chartType === 'groupDateChart') {
        if (!config.tsv.dateTitle) {
            throw new Error('Error: Required field missing: tsv.dateTitle');
        }
    }

    if (chartType === 'dateChart') {
        if (!config.tsv.series || !Array.isArray(config.tsv.series) || config.tsv.series.length === 0) {
            throw new Error('Error: Required field missing: tsv.series (must be a non-empty array)');
        }
    }

    if (chartType === 'groupDateChart') {
        if (!config.tsv.valueTitle) {
            throw new Error('Error: Required field missing: tsv.valueTitle');
        }
        if (!config.tsv.groupTitle) {
            throw new Error('Error: Required field missing: tsv.groupTitle');
        }
    }

    if (chartType === 'histogram') {
        if (!config.tsv.valueTitle) {
            throw new Error('Error: Required field missing: tsv.valueTitle');
        }
    }
}

/**
 * 標準入力からTSVデータを読み込む
 * @returns {Promise<string>} TSVデータの文字列
 */
function readTSVFromStdin() {
    return new Promise((resolve, reject) => {
        let data = '';
        
        // 標準入力がTTYでない場合のみ読み込む
        if (process.stdin.isTTY) {
            reject(new Error('Error: TSV data must be provided via stdin (use pipe or redirect)'));
            return;
        }

        process.stdin.setEncoding('utf8');
        
        process.stdin.on('data', (chunk) => {
            data += chunk;
        });
        
        process.stdin.on('end', () => {
            if (!data.trim()) {
                reject(new Error('Error: No TSV data provided via stdin'));
                return;
            }
            resolve(data);
        });
        
        process.stdin.on('error', (error) => {
            reject(new Error(`Error: Failed to read from stdin: ${error.message}`));
        });
    });
}

/**
 * TSVデータをパースする
 * @param {string} tsvData - TSVデータの文字列
 * @returns {Object} {headers: string[], rows: Object[]}
 */
function parseTSV(tsvData) {
    const lines = tsvData.split('\n').filter(line => line.trim() !== '');
    
    if (lines.length === 0) {
        throw new Error('Error: TSV data is empty');
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
 * Puppeteerを使ってChartCanvasを実行し、SVGを生成する
 * @param {Object} config - 設定オブジェクト
 * @param {string} tsvData - TSVデータの文字列
 * @returns {Promise<string>} SVG文字列
 */
async function generateSVG(config, tsvData) {
    let browser = null;
    try {
        // TSVデータをパース
        const parsedTSV = parseTSV(tsvData);
        
        // ChartCanvasのコードを読み込む
        const chartCanvasCode = fs.readFileSync(CHART_CANVAS_PATH, 'utf-8');

        // Puppeteerでブラウザを起動
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        // HTMLページを作成してChartCanvasを実行
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
                // ChartCanvasを作成（DOM要素なしでも動作するようにnullを許可）
                const chart = new ChartCanvas(null);
                
                // 設定とTSVデータを取得
                const config = ${JSON.stringify(config)};
                const parsedTSV = ${JSON.stringify(parsedTSV)};
                
                // グラフのサイズを設定
                const width = config.chart?.width || 1024;
                const height = config.chart?.height || 600;
                chart.size(width, height);
                
                if (config.chart?.title) {
                    chart.title = config.chart.title;
                }
                if (config.chart?.subtitle) {
                    chart.subtitle = config.chart.subtitle;
                }
                
                // チャートタイプに応じて処理
                if (config.chartType === 'dateChart') {
                    // dateChartタイプの実装
                    const dateChart = chart.addDateChart();
                    
                    // dateChartの設定を適用
                    if (config.dateChart) {
                        if (config.dateChart.xAxisTitle) dateChart.xAxisTitle = config.dateChart.xAxisTitle;
                        if (config.dateChart.yAxisTitle) dateChart.yAxisTitle = config.dateChart.yAxisTitle;
                        if (config.dateChart.yAxisScale) dateChart.yAxisScale = config.dateChart.yAxisScale;
                        if (config.dateChart.yAxisFormat) dateChart.yAxisFormat = config.dateChart.yAxisFormat;
                        if (config.dateChart.secondAxis !== undefined) dateChart.secondAxis = config.dateChart.secondAxis;
                        if (config.dateChart.secondAxisTitle) dateChart.secondAxisTitle = config.dateChart.secondAxisTitle;
                        if (config.dateChart.secondAxisScale) dateChart.secondAxisScale = config.dateChart.secondAxisScale;
                        if (config.dateChart.secondAxisFormat) dateChart.secondAxisFormat = config.dateChart.secondAxisFormat;
                        if (config.dateChart.dateFormat) dateChart.dateFormat = config.dateChart.dateFormat;
                        if (config.dateChart.xGrid !== undefined) dateChart.xGrid = config.dateChart.xGrid;
                        if (config.dateChart.yGrid !== undefined) dateChart.yGrid = config.dateChart.yGrid;
                    }
                    
                    // 系列を作成
                    const seriesMap = new Map();
                    for (const seriesConfig of config.tsv.series) {
                        let series;
                        if (seriesConfig.type === 'line') {
                            series = dateChart.addLine({
                                title: seriesConfig.title,
                                color: seriesConfig.color || 'black',
                                lineWidth: seriesConfig.lineWidth || 2,
                                lineType: seriesConfig.lineType || 'solid',
                                secondAxis: seriesConfig.secondAxis || false,
                                showMarkers: seriesConfig.showMarkers || false
                            });
                        } else if (seriesConfig.type === 'bar') {
                            series = dateChart.addBar({
                                title: seriesConfig.title,
                                color: seriesConfig.color || 'blue',
                                secondAxis: seriesConfig.secondAxis || false
                            });
                        } else {
                            throw new Error('Error: Invalid series type: ' + seriesConfig.type);
                        }
                        seriesMap.set(seriesConfig.column, series);
                    }
                    
                    // TSVデータを系列に追加
                    const dateTitle = config.tsv.dateTitle;
                    const commentTitle = config.tsv.commentTitle || '';
                    
                    for (const row of parsedTSV.rows) {
                        const date = row[dateTitle];
                        if (!date) continue;
                        
                        // 日付を正規化
                        const dateFormat = config.dateChart?.dateFormat || 'auto';
                        let normalizedDate = date;
                        if (date.match(/^\\d{4}-\\d{2}-\\d{2}$/)) {
                            normalizedDate = date.replace(/-/g, '');
                        } else if (date.match(/^\\d{4}\\/\\d{2}\\/\\d{2}$/)) {
                            normalizedDate = date.replace(/\\//g, '');
                        }
                        
                        // 各系列にデータを追加
                        for (const [column, series] of seriesMap.entries()) {
                            const valueStr = row[column];
                            if (!valueStr) continue;
                            
                            const value = parseFloat(valueStr);
                            if (isNaN(value)) continue;
                            
                            const comment = commentTitle ? (row[commentTitle] || '') : '';
                            series.addData(normalizedDate, value, comment);
                        }
                    }
                    
                    // レンダリング
                    chart.render();
                    
                } else if (config.chartType === 'groupDateChart') {
                    // groupDateChartタイプの実装
                    const dateChart = chart.addDateChart();
                    
                    // dateChartの設定を適用
                    if (config.dateChart) {
                        if (config.dateChart.xAxisTitle) dateChart.xAxisTitle = config.dateChart.xAxisTitle;
                        if (config.dateChart.yAxisTitle) dateChart.yAxisTitle = config.dateChart.yAxisTitle;
                        if (config.dateChart.yAxisScale) dateChart.yAxisScale = config.dateChart.yAxisScale;
                        if (config.dateChart.yAxisFormat) dateChart.yAxisFormat = config.dateChart.yAxisFormat;
                        if (config.dateChart.dateFormat) dateChart.dateFormat = config.dateChart.dateFormat;
                        if (config.dateChart.xGrid !== undefined) dateChart.xGrid = config.dateChart.xGrid;
                        if (config.dateChart.yGrid !== undefined) dateChart.yGrid = config.dateChart.yGrid;
                    }
                    
                    // グループごとのデータを収集
                    const dateTitle = config.tsv.dateTitle;
                    const valueTitle = config.tsv.valueTitle;
                    const groupTitle = config.tsv.groupTitle;
                    const commentTitle = config.tsv.commentTitle || '';
                    const seriesType = config.tsv.seriesType || 'line';
                    const seriesOptions = config.tsv.seriesOptions || {};
                    const seriesColors = config.tsv.seriesColors || ['red', 'blue', 'green', 'orange', 'purple', 'brown', 'pink', 'gray'];
                    
                    const dataByGroup = new Map();
                    
                    for (const row of parsedTSV.rows) {
                        const date = row[dateTitle];
                        const groupName = row[groupTitle];
                        const valueStr = row[valueTitle];
                        
                        if (!date || !groupName || !valueStr) continue;
                        
                        const value = parseFloat(valueStr);
                        if (isNaN(value)) continue;
                        
                        // 日付を正規化
                        const dateFormat = config.dateChart?.dateFormat || 'auto';
                        let normalizedDate = date;
                        if (date.match(/^\\d{4}-\\d{2}-\\d{2}$/)) {
                            normalizedDate = date.replace(/-/g, '');
                        } else if (date.match(/^\\d{4}\\/\\d{2}\\/\\d{2}$/)) {
                            normalizedDate = date.replace(/\\//g, '');
                        }
                        
                        // normalizeDate関数を使用（ChartCanvasの関数）
                        normalizedDate = normalizeDate(normalizedDate, dateFormat);
                        
                        const comment = commentTitle ? (row[commentTitle] || '') : '';
                        
                        if (!dataByGroup.has(groupName)) {
                            dataByGroup.set(groupName, []);
                        }
                        dataByGroup.get(groupName).push({
                            date: normalizedDate,
                            value: value,
                            comment: comment
                        });
                    }
                    
                    // グループごとに系列を作成
                    const sortedGroupNames = Array.from(dataByGroup.keys()).sort();
                    let colorIndex = 0;
                    
                    for (const groupName of sortedGroupNames) {
                        const data = dataByGroup.get(groupName);
                        
                        // 系列を作成
                        const seriesConfig = {
                            title: groupName,
                            color: seriesColors[colorIndex % seriesColors.length],
                            ...seriesOptions
                        };
                        
                        let series;
                        if (seriesType === 'line') {
                            series = dateChart.addLine(seriesConfig);
                        } else if (seriesType === 'bar') {
                            series = dateChart.addBar(seriesConfig);
                        } else {
                            throw new Error('Error: Invalid seriesType: ' + seriesType);
                        }
                        
                        // データを日付でソート
                        data.sort((a, b) => a.date.localeCompare(b.date));
                        
                        // データを追加
                        for (const item of data) {
                            series.addData(item.date, item.value, item.comment);
                        }
                        
                        colorIndex++;
                    }
                    
                    // レンダリング
                    chart.render();
                    
                } else if (config.chartType === 'histogram') {
                    // histogramタイプの実装
                    const histogram = chart.addHistogram();
                    
                    // histogramの設定を適用
                    if (config.histogram) {
                        if (config.histogram.xAxisTitle) histogram.xAxisTitle = config.histogram.xAxisTitle;
                        if (config.histogram.yAxisTitle) histogram.yAxisTitle = config.histogram.yAxisTitle;
                        if (config.histogram.xAxisFormat) histogram.xAxisFormat = config.histogram.xAxisFormat;
                        if (config.histogram.yAxisFormat) histogram.yAxisFormat = config.histogram.yAxisFormat;
                        if (config.histogram.binCount !== undefined && config.histogram.binCount !== null) histogram.binCount = config.histogram.binCount;
                        if (config.histogram.binWidth !== undefined && config.histogram.binWidth !== null) histogram.binWidth = config.histogram.binWidth;
                        if (config.histogram.binAlignment) histogram.binAlignment = config.histogram.binAlignment;
                        if (config.histogram.curveMode !== undefined) histogram.curveMode = config.histogram.curveMode;
                        if (config.histogram.xGrid !== undefined) histogram.xGrid = config.histogram.xGrid;
                        if (config.histogram.yGrid !== undefined) histogram.yGrid = config.histogram.yGrid;
                    }
                    
                    const valueTitle = config.tsv.valueTitle;
                    const groupTitle = config.tsv.groupTitle;
                    const seriesColors = config.tsv.seriesColors || ['blue', 'red', 'green', 'orange', 'purple', 'brown', 'pink', 'gray'];
                    
                    if (groupTitle) {
                        // グループ別ヒストグラム
                        const dataByGroup = new Map();
                        
                        for (const row of parsedTSV.rows) {
                            const groupName = row[groupTitle];
                            const valueStr = row[valueTitle];
                            
                            if (!groupName || !valueStr) continue;
                            
                            const value = parseFloat(valueStr);
                            if (isNaN(value)) continue;
                            
                            if (!dataByGroup.has(groupName)) {
                                dataByGroup.set(groupName, []);
                            }
                            dataByGroup.get(groupName).push(value);
                        }
                        
                        // グループごとに系列を作成
                        const sortedGroupNames = Array.from(dataByGroup.keys()).sort();
                        let colorIndex = 0;
                        
                        for (const groupName of sortedGroupNames) {
                            const values = dataByGroup.get(groupName);
                            
                            const series = histogram.addSeries({
                                title: groupName,
                                color: seriesColors[colorIndex % seriesColors.length],
                                opacity: 0.7
                            });
                            
                            for (const value of values) {
                                series.addData(value);
                            }
                            
                            colorIndex++;
                        }
                    } else {
                        // 単一のヒストグラム系列
                        const values = [];
                        
                        for (const row of parsedTSV.rows) {
                            const valueStr = row[valueTitle];
                            if (!valueStr) continue;
                            
                            const value = parseFloat(valueStr);
                            if (isNaN(value)) continue;
                            
                            values.push(value);
                        }
                        
                        const series = histogram.addSeries({
                            title: config.chart?.title || 'データ',
                            color: seriesColors[0],
                            opacity: 0.7
                        });
                        
                        for (const value of values) {
                            series.addData(value);
                        }
                    }
                    
                    // レンダリング
                    chart.render();
                    
                } else {
                    // 他のチャートタイプは未実装
                    throw new Error('Error: Chart type not yet implemented: ' + config.chartType);
                }
                
                // SVG文字列を取得
                const svgString = chart.getSVGString();
                
                // 結果をwindowオブジェクトに保存
                window.cliResult = {
                    success: true,
                    svgString: svgString
                };
                
            } catch (error) {
                window.cliResult = {
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
        await page.waitForFunction(() => window.cliResult !== undefined, { timeout: 30000 });
        
        const result = await page.evaluate(() => window.cliResult);
        
        if (!result.success) {
            throw new Error(result.error + (result.stack ? '\n' + result.stack : ''));
        }
        
        return result.svgString;
        
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
    try {
        const options = parseArgs();

        // ヘルプを表示
        if (options.help) {
            showHelp();
            process.exit(0);
        }

        // バージョンを表示
        if (options.version) {
            console.log(`ChartCanvas CLI Tool v${VERSION}`);
            process.exit(0);
        }

        // 設定を読み込む
        const config = loadConfig(options);

        // 設定を検証
        validateConfig(config);

        // 標準入力からTSVデータを読み込む
        const tsvData = await readTSVFromStdin();

        // 設定に基づいてChartCanvasを使用してSVGを生成
        const svgString = await generateSVG(config, tsvData);

        // 標準出力にSVGを出力
        process.stdout.write(svgString);

    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}

// スクリプトを実行
if (require.main === module) {
    main();
}

module.exports = { main, parseArgs, loadConfig, validateConfig };

