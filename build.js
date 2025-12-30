#!/usr/bin/env node

/**
 * 統合ファイル生成スクリプト
 * src/dateChart.js と src/main.js を統合して chartcanvas.js を生成します
 */

const fs = require('fs');
const path = require('path');

// ファイルパス
const dateChartPath = path.join(__dirname, 'src', 'datechart.js');
const mainPath = path.join(__dirname, 'src', 'main.js');
const outputPath = path.join(__dirname, 'chartcanvas.js');

// ヘッダーコメント
const headerComment = `/**
 * ChartCanvas - グラフライブラリ
 * 
 * 日付チャート（線グラフ・棒グラフ）を描画するためのライブラリです。
 * 1つのファイルをロードするだけで使用できます。
 * 
 * @version 1.0.0
 */

`;

/**
 * ファイルを読み込む
 */
function readFile(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        console.error(`エラー: ファイルを読み込めませんでした: ${filePath}`);
        console.error(error.message);
        process.exit(1);
    }
}

/**
 * ファイルを書き込む
 */
function writeFile(filePath, content) {
    try {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✓ 統合ファイルを生成しました: ${filePath}`);
    } catch (error) {
        console.error(`エラー: ファイルを書き込めませんでした: ${filePath}`);
        console.error(error.message);
        process.exit(1);
    }
}

/**
 * 統合ファイルを生成
 */
function build() {
    console.log('統合ファイルを生成中...');
    
    // ファイルを読み込む
    const dateChartContent = readFile(dateChartPath);
    const mainContent = readFile(mainPath);
    
    // dateChart.jsからグローバルスコープへの公開部分を削除
    // (最後にまとめて追加するため)
    const dateChartWithoutExport = dateChartContent.replace(
        /\/\/ グローバルスコープに公開[\s\S]*$/,
        ''
    ).trim();
    
    // main.jsからグローバルスコープへの公開部分を取得
    const mainExportMatch = mainContent.match(/\/\/ グローバルスコープに公開[\s\S]*$/);
    const mainExport = mainExportMatch ? mainExportMatch[0] : '';
    
    // main.jsからグローバルスコープへの公開部分を削除
    const mainWithoutExport = mainContent.replace(
        /\/\/ グローバルスコープに公開[\s\S]*$/,
        ''
    ).trim();
    
    // 統合ファイルの内容を構築
    // 順序: DateChart関連クラス → ChartCanvasクラス → グローバルスコープへの公開
    const integratedContent = headerComment +
        dateChartWithoutExport + '\n\n' +
        mainWithoutExport + '\n\n' +
        '// グローバルスコープに公開\n' +
        'window.ChartCanvas = ChartCanvas;\n' +
        'window.DateChart = DateChart;\n' +
        'window.LineSeries = LineSeries;\n' +
        'window.BarSeries = BarSeries;\n' +
        'window.TSVLoader = TSVLoader;\n';
    
    // ファイルを書き込む
    writeFile(outputPath, integratedContent);
    
    // ファイルサイズを表示
    const stats = fs.statSync(outputPath);
    const fileSizeKB = (stats.size / 1024).toFixed(2);
    console.log(`✓ ファイルサイズ: ${fileSizeKB} KB`);
}

// メイン処理
if (require.main === module) {
    build();
}

module.exports = { build };

