# API設計（サンプルベース）

## 概要

このドキュメントは、サンプルHTMLから読み取ったAPI設計をまとめたものです。

## ChartCanvasクラス

### メソッド

#### `addDateChart()`
時系列データ（X軸が日付）のチャートを追加します。

**戻り値:** `DateChart`インスタンス

**例:**
```javascript
const dateChart = chart.addDateChart();
```

## DateChartクラス

### プロパティ

#### `xAxisTitle` (string)
X軸のタイトルを設定します。

**例:**
```javascript
dateChart.xAxisTitle = '日付';
```

#### `yAxisTitle` (string)
Y軸（主軸）のタイトルを設定します。

**例:**
```javascript
dateChart.yAxisTitle = '売上';
```

#### `yAxisScale` (string)
Y軸（主軸）の単位を設定します。

**例:**
```javascript
dateChart.yAxisScale = '万円';
```

#### `yAxisFormat` (string)
Y軸（主軸）のフォーマットを設定します。

**例:**
```javascript
dateChart.yAxisFormat = '#,##0';  // 数値フォーマット（例: 20,000）
```

#### `title` (string)
グラフのタイトルを設定します。

**例:**
```javascript
dateChart.title = '売上推移';
```

#### `subtitle` (string)
グラフのサブタイトルを設定します。

**例:**
```javascript
dateChart.subtitle = '2025/01/01 - 2025/01/09';
```

#### `secondAxis` (boolean)
2軸グラフを有効にするかどうかを設定します。

**例:**
```javascript
dateChart.secondAxis = true;
```

#### `secondAxisTitle` (string)
Y軸（副軸）のタイトルを設定します。

**例:**
```javascript
dateChart.secondAxisTitle = '売上構成比';
```

#### `secondAxisScale` (string)
Y軸（副軸）の単位を設定します。

**例:**
```javascript
dateChart.secondAxisScale = '%';
```

#### `secondAxisFormat` (string)
Y軸（副軸）のフォーマットを設定します。

**例:**
```javascript
dateChart.secondAxisFormat = '#,##0%';  // パーセンテージフォーマット（例: 4%）
```

### メソッド

#### `addLine(options)`
線グラフの系列を追加します。

**パラメータ:**
- `options` (object): オプションオブジェクト
  - `title` (string): 系列のタイトル（凡例に表示）
  - `color` (string): 線の色
  - `lineWidth` (number): 線の太さ
  - `lineType` (string): 線の種類（`'solid'`, `'dashed'`, `'dotted'`など）
  - `lineDash` (array): 破線のパターン（配列）
  - `lineDashOffset` (number): 破線のオフセット
  - `lineDashArray` (array): 破線の配列パターン

**戻り値:** `LineSeries`インスタンス

**例:**
```javascript
const firstLine = dateChart.addLine({
    title: '売上',
    color: 'red',
    lineWidth: 2,
    lineType: 'solid',
    lineDash: [],
    lineDashOffset: 0,
    lineDashArray: [],
    lineDashOffset: 0
});
```

#### `addBar(options)`
棒グラフの系列を追加します。

**パラメータ:**
- `options` (object): オプションオブジェクト
  - `title` (string): 系列のタイトル（凡例に表示）
  - `color` (string): 棒の色
  - `secondAxis` (boolean): 副軸（右のY軸）を使用するかどうか

**戻り値:** `BarSeries`インスタンス

**例:**
```javascript
const secondLine = dateChart.addBar({
    title: '売上構成比',
    color: 'blue',
    secondAxis: true
});
```

## LineSeriesクラス / BarSeriesクラス

### メソッド

#### `addData(date, value, ...)`
データを1つずつ追加します。

**パラメータ:**
- `date` (string): 日付（形式: `'YYYYMMDD'`、例: `'20250101'`）
- `value` (number): 値
- `tooltip` (string, オプション): ツールチップのテキスト
- `denominator` (number, オプション): 分母（パーセンテージ計算用）

**戻り値:** `LineSeries`または`BarSeries`インスタンス（チェーンメソッド対応）

**例:**
```javascript
// 基本的な使い方
firstLine.addData('20250101', 20000);

// ツールチップ付き
firstLine.addData('20250108', 27000, "This day is holiday");

// パーセンテージ計算（分子と分母を指定）
secondLine.addData('20250101', 20000, 500000);  // 20000 / 500000 = 4%
```

**注意:**
- データは通常ループで追加します
- パーセンテージ計算が必要な場合、分子と分母を指定します
- ツールチップは3番目の引数で指定できます

## 使用例

### 基本的な時系列データ（線グラフ）

```javascript
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

const firstLine = dateChart.addLine({
    title: '売上',
    color: 'red',
    lineWidth: 2,
    lineType: 'solid'
});

firstLine.addData('20250101', 20000);
firstLine.addData('20250102', 21000);
firstLine.addData('20250103', 22000);
// ... ループで追加

chart.render();
```

### 2軸グラフ（線グラフと棒グラフの組み合わせ）

```javascript
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

// 2軸グラフを有効化
dateChart.secondAxis = true;
dateChart.secondAxisTitle = '売上構成比';
dateChart.secondAxisScale = '%';
dateChart.secondAxisFormat = '#,##0%';

// 主軸（左）の線グラフ
const firstLine = dateChart.addLine({
    title: '売上',
    color: 'red',
    lineWidth: 2,
    lineType: 'solid'
});
firstLine.addData('20250101', 20000);
firstLine.addData('20250102', 21000);
// ... ループで追加

// 副軸（右）の棒グラフ
const secondLine = dateChart.addBar({
    title: '売上構成比',
    color: 'blue',
    secondAxis: true
});
secondLine.addData('20250101', 20000, 500000);  // 20000 / 500000 = 4%
secondLine.addData('20250102', 21000, 510000);  // 21000 / 510000 = 4.12%
// ... ループで追加

chart.render();
```

### ツールチップ付きデータ

```javascript
const firstLine = dateChart.addLine({
    title: '売上',
    color: 'red',
    lineWidth: 2
});

firstLine.addData('20250101', 20000);
firstLine.addData('20250108', 27000, "This day is holiday");  // ツールチップ付き
firstLine.addData('20250109', 24000);
```

**ツールチップの表示形式:**
- マーカーや棒グラフにマウスオーバーすると、ツールチップが2行で表示されます
- 1行目: 日付（yyyy/MM/dd形式、例: `2025/01/08`）
- 2行目: 値（コメントがある場合は値 + コメント、例: `27,000 This day is holiday`）

## 設計の特徴

1. **プロパティベースの設定**
   - メソッドチェーンではなく、プロパティに直接代入する方式
   - シンプルで直感的

2. **系列ごとにデータを追加**
   - `addLine()`や`addBar()`で系列を作成し、`addData()`でデータを追加
   - ループ処理に適している

3. **2軸グラフのサポート**
   - `secondAxis: true`で2軸グラフを有効化
   - 系列ごとに`secondAxis: true`を指定して副軸に割り当て

4. **パーセンテージ計算**
   - `addData(date, numerator, denominator)`で分子と分母を指定
   - 自動的にパーセンテージを計算

5. **ツールチップのサポート**
   - `addData(date, value, tooltip)`でツールチップを指定可能
   - ツールチップは2行表示:
     - 1行目: 日付（yyyy/MM/dd形式）
     - 2行目: 値（コメントがある場合は値 + コメント）

6. **線グラフと棒グラフの混在**
   - 同じチャートに線グラフと棒グラフを同時に表示可能

