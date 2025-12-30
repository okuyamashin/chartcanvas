#!/usr/bin/env node

/**
 * 複数店舗のヒストグラム用TSVデータ生成スクリプト
 * 各店舗ごとに適度な量の売上データを生成します
 */

const fs = require('fs');
const path = require('path');

// 店舗ごとの設定（平均値、標準偏差、データ数）
const stores = [
    { name: '上野店', mean: 24000, stdDev: 3000, count: 35 },
    { name: '東京店', mean: 28000, stdDev: 4000, count: 35 },
    { name: '渋谷店', mean: 20000, stdDev: 5000, count: 30 }
];

/**
 * 正規分布に近い乱数を生成（Box-Muller変換）
 */
function randomNormal(mean, stdDev) {
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z0 * stdDev + mean;
}

/**
 * 値を適切な範囲に丸める（1000円単位）
 */
function roundToNearestThousand(value) {
    return Math.round(value / 1000) * 1000;
}

// TSVデータを生成
const lines = ['値\t店舗名'];

for (const store of stores) {
    for (let i = 0; i < store.count; i++) {
        // 正規分布に近い乱数を生成
        let value = randomNormal(store.mean, store.stdDev);
        
        // 1000円単位に丸める
        value = roundToNearestThousand(value);
        
        // 最小値は5000円、最大値は50000円に制限
        value = Math.max(5000, Math.min(50000, value));
        
        lines.push(`${value}\t${store.name}`);
    }
}

// ファイルに書き込み
const outputPath = path.join(__dirname, 'data-histogram-multi-store.tsv');
fs.writeFileSync(outputPath, lines.join('\n') + '\n', 'utf8');

console.log(`✓ TSVファイルを生成しました: ${outputPath}`);
console.log(`  総行数: ${lines.length - 1}行（ヘッダー除く）`);
console.log(`  店舗数: ${stores.length}`);
for (const store of stores) {
    console.log(`    - ${store.name}: ${store.count}行`);
}

