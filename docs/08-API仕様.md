# API仕様

## ChartCanvasクラス

### コンストラクタ
```javascript
new ChartCanvas(containerElement)
```

**パラメータ:**
- `containerElement` (HTMLElement | null): グラフを表示するDOM要素（`null`の場合はDOMなしモード）

**例:**
```javascript
// ブラウザ環境での使用
const chart_div = document.getElementById('chart_div');
const chart = new ChartCanvas(chart_div);

// DOMなしモード（サーバーサイドやCLI環境）
const chart = new ChartCanvas(null);
```

**注意:**
- コンテナ要素のサイズは、JavaScript側で`size()`メソッドで指定します
- SVGのサイズとコンテナのサイズを一致させるため、CSSでのサイズ指定は不要です
- `containerElement`に`null`を指定すると、DOMなしモード（headless mode）で動作します。このモードでは、SVGは`getSVGString()`メソッドで文字列として取得できます

### メソッド

#### `size(width, height)`
グラフのサイズを指定します。コンテナ要素とSVGのサイズを設定します。

**パラメータ:**
- `width` (number): 幅（ピクセル）
- `height` (number): 高さ（ピクセル）

**戻り値:** `ChartCanvas`インスタンス（チェーンメソッド対応）

**例:**
```javascript
chart.size(1024, 600);
```

**注意:**
- `render()`の前に呼び出す必要があります
- デフォルト値は要検討（例: 800x400）
- **サイズは固定です** - ブラウザのリサイズに追従しません（一般的にグラフのサイズが動的に変わることは期待されていません）

#### `addDateChart()`
時系列データ（X軸が日付）のチャートを追加します。

**戻り値:** `DateChart`インスタンス

**例:**
```javascript
const dateChart = chart.addDateChart();
```

**注意:**
- 詳細なAPI仕様は[API設計（サンプルベース）](./17-API設計（サンプルベース）.md)を参照してください

#### `addLineChart()` (非推奨)
折れ線グラフを追加します。

**戻り値:** `LineChart`インスタンス

**例:**
```javascript
const lineChart = chart.addLineChart();
```

**注意:**
- 新しい設計では`addDateChart()`を使用してください

#### `addBarChart()` (非推奨)
棒グラフを追加します。

**戻り値:** `BarChart`インスタンス

**例:**
```javascript
const barChart = chart.addBarChart();
```

**注意:**
- 新しい設計では`addDateChart()`を使用してください

#### `addPieChart()`
円グラフを追加します。

**戻り値:** `PieChart`インスタンス

**例:**
```javascript
const pieChart = chart.addPieChart();
```

#### `addScatterChart()`
散布図を追加します。

**戻り値:** `ScatterChart`インスタンス

**例:**
```javascript
const scatterChart = chart.addScatterChart();
```

#### `setLayout(layout, options)` (要検討)
複数のグラフ（特に円グラフ）のレイアウトを設定します。

**パラメータ:**
- `layout` (string): レイアウトの種類
  - `'single'` (デフォルト): 単一のグラフ
  - `'horizontal'` または `'h'`: 横並び（グラフの数に応じて自動配置）
    - 1つ: 単一表示
    - 2つ: 横に2つ並べる
    - 3つ: 横に3つ並べる
    - 4つ: 2x2のグリッド（上下に2つずつ）
  - `'vertical'` または `'v'`: 縦並び（2つのグラフを縦に並べる）
  - `'auto'`: グラフの数に応じて自動的に最適なレイアウトを選択
    - 1つ: 単一表示
    - 2つ: 横並び
    - 3つ: 横に3つ並べる
    - 4つ: 2x2のグリッド（上下に2つずつ）

**戻り値:** `ChartCanvas`インスタンス（チェーンメソッド対応）

**例:**
```javascript
// 2つの円グラフを横並びに配置
chart.setLayout('horizontal');
// → 2つのグラフが横に並んで表示される

// 3つの円グラフを横に3つ並べる
chart.setLayout('horizontal');
// → 3つのグラフが横に並んで表示される

// 4つの円グラフを2x2のグリッド状に配置（上下に2つずつ）
chart.setLayout('horizontal');
// → 4つのグラフが2x2のグリッド状に配置される

// 自動レイアウト（推奨）
chart.setLayout('auto');
// → グラフの数に応じて自動的に最適なレイアウトを選択

// 2つの円グラフを縦並びに配置
chart.setLayout('vertical');
```

**注意:**
- 複数のグラフを追加した後に`setLayout()`を呼び出す必要があります
- 円グラフ以外のグラフタイプでも使用可能ですが、主に円グラフで使用されることを想定
- **複数の円グラフを並べる場合、全ての円グラフを同じサイズに統一します**
  - ラベルの大きさ（タイトル、サブタイトル、凡例の文字数など）によって、各円グラフの描画エリアのサイズが変わる
  - 全ての円グラフの中で、一番小さな描画エリアのサイズに統一する
  - これにより、見た目の統一感が保たれる
- **4つ以上のグラフは想定していません**（見づらくて使いにくいため）

#### `render()`
追加したすべてのグラフをレンダリングします。SVGを生成してコンテナに表示します。

**戻り値:** `void`

**例:**
```javascript
chart.render();
```

**注意:**
- `setLayout()`を呼び出した場合、レイアウトに応じてグラフが配置されます
- 複数のグラフがある場合、追加した順序で配置されます

#### `downloadSVG(filename)` (要検討)
SVGファイルとしてダウンロードします。

**パラメータ:**
- `filename` (string): ダウンロードするファイル名

**戻り値:** `void`

**例:**
```javascript
chart.downloadSVG('chart.svg');
```

#### `getSVGString()`
SVG文字列を取得します。DOMなしモード（headless mode）でも使用できます。

**戻り値:** `string` SVGの文字列表現（XML宣言付き）

**例:**
```javascript
// ブラウザ環境
const chart = new ChartCanvas(document.getElementById('chart_div'));
chart.render();
const svgString = chart.getSVGString();

// DOMなしモード（サーバーサイドやCLI環境）
const chart = new ChartCanvas(null);
chart.render();
const svgString = chart.getSVGString(); // SVG文字列を取得
```

**注意:**
- DOMなしモードでは、`render()`を呼び出した後に`getSVGString()`でSVG文字列を取得できます
- 返される文字列にはXML宣言（`<?xml version="1.0" encoding="UTF-8"?>`）が含まれます

#### `clear()` (要検討)
すべてのグラフをクリアします。

**戻り値:** `void`

**例:**
```javascript
chart.clear();
```

## LineChartクラス（要検討）

### メソッド

#### `setData(data)` (要検討)
データを設定します。データを設定すると、Y軸の範囲とラベルが自動的に計算されます。

**パラメータ:**
- `data` (number[] | number[][]): データの配列
  - 単一の系列の場合: `number[]`（例: `[100, 150, 200, 180, 250]`）
  - 複数の系列の場合: `number[][]`（例: `[[100, 150, 200], [120, 160, 180]]`）

**戻り値:** `LineChart`インスタンス（チェーンメソッド対応）

**例:**
```javascript
// 単一の系列
lineChart.setData([100, 150, 200, 180, 250]);
// → データの最大値（250）に基づいてY軸を自動計算
// → Y軸ラベル: 0, 50, 100, 150, 200, 250（50刻み）
// → 凡例は表示されない（単一の系列のため）

// 複数の系列
lineChart.setData([
    [100, 150, 200, 180, 250],  // 系列1
    [120, 160, 190, 200, 240]   // 系列2
]);
// → データの最大値（250）に基づいてY軸を自動計算
// → Y軸ラベル: 0, 50, 100, 150, 200, 250（50刻み）
// → 凡例が自動表示: グラフの右側に「系列1」「系列2」が表示される
```

**Y軸の自動計算:**
- データから最小値と最大値を取得
- マイナスの値も含めて、データが全部含まれるようにスケールを決定
- 最小値が0以上の場合: ゼロベース（0から始める）
- 最小値が0未満の場合: 最小値から始める
- 範囲（最大値 - 最小値）が30以下の場合: 1刻みでラベルを生成
- 範囲が30超の場合: 10の倍数で間隔を調整し、ラベル数が30個以下になるように調整
- 最小値と最大値の両方を含むようにラベルを生成

#### `setLabels(labels)` (要検討)
X軸のラベル（カテゴリラベル）を設定します。日付以外のラベルに使用します。

**パラメータ:**
- `labels` (string[]): ラベルの配列

**戻り値:** `LineChart`インスタンス（チェーンメソッド対応）

**例:**
```javascript
// 日付以外のラベル
lineChart.setLabels(['1月', '2月', '3月', '4月', '5月']);
```

#### `setDateRange(startDate, endDate)` (要検討)
X軸の日付範囲を設定します。最初の日と最後の日を指定し、内部で期間に応じて自動的にモードを切り替えます。

**パラメータ:**
- `startDate` (string | Date): 開始日（例: '2024-01-01' または Dateオブジェクト）
- `endDate` (string | Date): 終了日（例: '2024-12-31' または Dateオブジェクト）

**戻り値:** `LineChart`インスタンス（チェーンメソッド対応）

**例:**
```javascript
// 1ヶ月分の日付
lineChart.setDateRange('2025-10-01', '2025-10-31');
// → 内部で「1ヶ月モード」に切り替え
// → 階層的な表示: 2025/10/01 02 03 04 05 06 07 08 09 10 11 12 ...

// 3ヶ月分の日付
lineChart.setDateRange('2024-01-01', '2024-03-31');
// → 内部で「3ヶ月モード」に切り替え

// 1年分の日付
lineChart.setDateRange('2024-01-01', '2024-12-31');
// → 内部で「1年モード」に切り替え
// → 階層的な表示: 2024/01 02 03 04 05 06 07 08 09 10 11 12

// 1年以上の日付
lineChart.setDateRange('2020-01-01', '2023-12-31');
// → 内部で「1年以上モード」に切り替え
// → 階層的な表示: 2020/01 02 03 ... 12 2021/01 02 ...（最初の年/月だけ通常サイズ、残りは小さく）
```

**内部モード切り替え:**
- **1ヶ月モード:** 1ヶ月以内の場合
  - 年/月を大きく表示し、その月の日を横に並べて表示
  - 例: `2025/10/01 02 03 04 05 06 07 08 09 10 11 12 13 14 15 ...`
  - すべて通常のフォントサイズ

- **3ヶ月モード:** 1ヶ月超〜3ヶ月以内の場合
  - （詳細は要検討）

- **1年モード:** 3ヶ月超〜1年以内の場合
  - 年を大きく表示し、その年の月を横に並べて表示
  - 例: `2024/01 02 03 04 05 06 07 08 09 10 11 12`
  - すべて通常のフォントサイズ

- **1年以上モード:** 1年超の場合
  - 最初の年/月だけ通常のフォントサイズ（例: `2020/01`）
  - 残りの月/日は小さなフォントサイズ（例: `02 03 04 05 06 07 08 09 10 11 12`）
  - 次の年の最初の月は再び通常サイズ（例: `2021/01`）
  - ラベルが被ることを防ぎ、スペースを節約しつつ読みやすくする

**重要:** 
- ラベルはグラフの線よりも重要です。ラベルがないとグラフの意味が伝わりません。
- **日付ラベルの場合、階層的な表示を行います。**
  - 縦書き（90度回転）は読みづらいため、階層表示を採用
  - 期間に応じて自動的に最適なモードを選択

#### `setXAxisTitle(title)` (要検討)
X軸のタイトルを設定します。

**パラメータ:**
- `title` (string): X軸のタイトル

**戻り値:** `LineChart`インスタンス（チェーンメソッド対応）

**例:**
```javascript
lineChart.setXAxisTitle('月');
```

#### `setYAxisTitle(title)` (要検討)
Y軸のタイトルを設定します。

**パラメータ:**
- `title` (string): Y軸のタイトル

**戻り値:** `LineChart`インスタンス（チェーンメソッド対応）

**例:**
```javascript
lineChart.setYAxisTitle('売上（万円）');
```

#### Y軸の自動スケーリング（自動）

`setData()`を呼び出すと、Y軸の範囲とラベルが自動的に計算されます。

**ルール:**
- **パーセンテージの場合:** データが0〜100の範囲にある場合、10%刻みでラベルを生成
  - ラベル: `0%, 10%, 20%, 30%, 40%, 50%, 60%, 70%, 80%, 90%, 100%`
- **通常の数値の場合:**
  - データから最小値と最大値を取得
  - マイナスの値も含めて、データが全部含まれるようにスケールを決定
  - 最小値が0以上の場合: ゼロベース（0から始める）
  - 最小値が0未満の場合: 最小値から始める
  - **ラベル間隔の自動調整:**
    - 範囲（最大値 - 最小値）が30以下の場合: 1刻み（例: `-10, -9, ..., 0, 1, 2, ..., 20`）
    - 範囲が30超の場合: 10の倍数で間隔を調整（例: `-50, -40, ..., 0, 10, 20, ..., 50`）
    - ラベル数が30個以下になるように自動調整
    - 最小値と最大値の両方を含むようにラベルを生成

**例:**
```javascript
// パーセンテージの場合（0〜100の範囲）
lineChart.setData([25, 50, 75, 90]);
// → Y軸ラベル: 0%, 10%, 20%, 30%, 40%, 50%, 60%, 70%, 80%, 90%, 100%（10%刻み、11個）

// 最小値0、最大値25の場合（範囲25、パーセンテージではない）
lineChart.setData([10, 15, 20, 25]);
// → Y軸ラベル: 0, 1, 2, 3, ..., 25（1刻み、26個）

// 最小値-10、最大値20の場合（範囲30）
lineChart.setData([-5, 0, 10, 20]);
// → Y軸ラベル: -10, -9, -8, ..., 0, 1, 2, ..., 20（1刻み、31個）

// 最小値-50、最大値50の場合（範囲100）
lineChart.setData([-30, 0, 30, 50]);
// → Y軸ラベル: -50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50（10刻み、11個）

// 最小値0、最大値100の場合（範囲100、パーセンテージではない）
lineChart.setData([50, 75, 90, 100]);
// → Y軸ラベル: 0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100（10刻み、11個）

// 最小値0、最大値250の場合（範囲250）
lineChart.setData([100, 150, 200, 250]);
// → Y軸ラベル: 0, 50, 100, 150, 200, 250（50刻み、6個）

// 最小値-100、最大値100の場合（範囲200）
lineChart.setData([-50, 0, 50, 100]);
// → Y軸ラベル: -100, -50, 0, 50, 100（50刻み、5個）
```

#### `setTitle(title)` (要検討)
グラフのタイトルを設定します。

**パラメータ:**
- `title` (string): グラフのタイトル

**戻り値:** `LineChart`インスタンス（チェーンメソッド対応）

**例:**
```javascript
lineChart.setTitle('2024年売上推移');
```

#### `setSubtitle(subtitle)` (要検討)
グラフのサブタイトルを設定します。タイトルの下に表示されます。

**パラメータ:**
- `subtitle` (string): グラフのサブタイトル

**戻り値:** `LineChart`インスタンス（チェーンメソッド対応）

**例:**
```javascript
lineChart.setTitle('全店売上');
lineChart.setSubtitle('2024/01/01 - 2024/12/31');
// → タイトル: "全店売上"
// → サブタイトル: "2024/01/01 - 2024/12/31"
```

#### `setTitles(title, subtitle)` (要検討)
グラフのタイトルとサブタイトルを一度に設定します。

**パラメータ:**
- `title` (string): グラフのタイトル
- `subtitle` (string, オプション): グラフのサブタイトル

**戻り値:** `LineChart`インスタンス（チェーンメソッド対応）

**例:**
```javascript
// タイトルとサブタイトルを一度に設定
lineChart.setTitles('全店売上', '2024/01/01 - 2024/12/31');

// タイトルのみ設定
lineChart.setTitles('全店売上');
```

#### `setLegendLabels(labels)` (要検討)
凡例のラベルを設定します。複数の系列がある場合に使用します。

**パラメータ:**
- `labels` (string[]): 凡例のラベルの配列

**戻り値:** `LineChart`インスタンス（チェーンメソッド対応）

**例:**
```javascript
// 複数の系列がある場合、凡例のラベルを指定
lineChart.setData([
    [100, 150, 200, 180, 250],  // 系列1
    [120, 160, 190, 200, 240]   // 系列2
]);
lineChart.setLegendLabels(['売上A', '売上B']);
// → 右側の凡例に「売上A」「売上B」が表示される
```

#### `setLegendPosition(position)` (要検討)
凡例の配置位置を設定します。

**パラメータ:**
- `position` (string): 凡例の配置位置
  - `'right'` (デフォルト): グラフの右側に配置
  - `'top'`: グラフの上部に配置
  - `'bottom'`: グラフの下部に配置
  - `'left'`: グラフの左側に配置

**戻り値:** `LineChart`インスタンス（チェーンメソッド対応）

**例:**
```javascript
// デフォルト: 右側に配置
lineChart.setLegendPosition('right');

// 上部に配置
lineChart.setLegendPosition('top');

// 下部に配置
lineChart.setLegendPosition('bottom');

// 左側に配置
lineChart.setLegendPosition('left');
```

#### `setLegendVisible(visible)` (要検討)
凡例の表示/非表示を設定します。

**パラメータ:**
- `visible` (boolean): 凡例を表示するかどうか
  - `true` (デフォルト): 凡例を表示（複数の系列がある場合）
  - `false`: 凡例を非表示

**戻り値:** `LineChart`インスタンス（チェーンメソッド対応）

**例:**
```javascript
// 凡例を非表示
lineChart.setLegendVisible(false);

// 凡例を表示
lineChart.setLegendVisible(true);
```

#### `setLegendMaxWidth(maxWidth)` (要検討)
凡例の最大幅を設定します。グラフエリアが圧迫されないように、凡例の幅を制限します。

**パラメータ:**
- `maxWidth` (number): 凡例の最大幅（ピクセル）
  - デフォルト: グラフ幅の20%以下、または最大200px

**戻り値:** `LineChart`インスタンス（チェーンメソッド対応）

**例:**
```javascript
// 凡例の最大幅を200pxに設定
lineChart.setLegendMaxWidth(200);

// 凡例の最大幅をグラフ幅の15%に設定
lineChart.setLegendMaxWidthPercent(15);
```

#### `setLegendMaxWidthPercent(percent)` (要検討)
凡例の最大幅をグラフ幅の割合で設定します。

**パラメータ:**
- `percent` (number): グラフ幅に対する割合（0〜100）
  - デフォルト: 20（グラフ幅の20%以下）

**戻り値:** `LineChart`インスタンス（チェーンメソッド対応）

**例:**
```javascript
// 凡例の最大幅をグラフ幅の15%に設定
lineChart.setLegendMaxWidthPercent(15);
```

#### `setLegendMaxLabelLength(maxLength)` (要検討)
凡例のラベルの最大文字数を設定します。文字列が長い場合、省略記号（...）で表示します。

**パラメータ:**
- `maxLength` (number): ラベルの最大文字数
  - デフォルト: 20文字

**戻り値:** `LineChart`インスタンス（チェーンメソッド対応）

**例:**
```javascript
// 凡例のラベルの最大文字数を20文字に設定（デフォルト）
lineChart.setLegendMaxLabelLength(20);
// → "非常に長いラベル名が20字以上ある場合" → "非常に長いラベル名が20字以上..."

// カスタム設定
lineChart.setLegendMaxLabelLength(15);
```

#### `setOptions(options)` (要検討)
オプションを設定します。

**パラメータ:**
- `options` (object): オプションオブジェクト

**戻り値:** `LineChart`インスタンス（チェーンメソッド対応）

**例:**
```javascript
lineChart.setOptions({
    color: '#3498db',
    strokeWidth: 2,
    // ラベル間引きのオプション（要検討）
    labelThinning: {
        enabled: true,  // デフォルト: true（自動間引き）
        minInterval: 50, // ラベル間の最小間隔（ピクセル）
        maxLabels: 20   // 表示するラベルの最大数（オプション）
    }
});
```

#### `setLabelThinning(enabled, options)` (要検討)
ラベルの自動間引きを設定します。

**パラメータ:**
- `enabled` (boolean): 自動間引きを有効にするか
- `options` (object, オプション): 間引きのオプション
  - `minInterval` (number): ラベル間の最小間隔（ピクセル）
  - `maxLabels` (number): 表示するラベルの最大数

**戻り値:** `LineChart`インスタンス（チェーンメソッド対応）

**例:**
```javascript
// 自動間引きを有効化（デフォルト）
lineChart.setLabelThinning(true);

// 自動間引きを無効化（すべてのラベルを表示）
lineChart.setLabelThinning(false);

// カスタム設定
lineChart.setLabelThinning(true, {
    minInterval: 100,
    maxLabels: 12
});
```

#### `setDateLabelFormat(format)` (要検討)
日付ラベルのフォーマットを設定します。日付ラベルの場合、階層的な表示を行います。

**パラメータ:**
- `format` (string): 日付フォーマット（例: 'YYYY/MM/DD', 'YYYY-MM-DD'）
  - または `'auto'` で自動検出（デフォルト）

**戻り値:** `LineChart`インスタンス（チェーンメソッド対応）

**例:**
```javascript
// 日付フォーマットを指定
lineChart.setDateLabelFormat('YYYY/MM/DD');
// → 1年分の場合: 2024/01 02 03 ... 12 2025/01 02
// → 1ヶ月分の場合: 2025/10/01 02 03 04 05 06 07 08 09 10 11 12 ...

// 自動検出（デフォルト）
lineChart.setDateLabelFormat('auto');
```

#### `setHierarchicalLabels(enabled)` (要検討)
日付ラベルの階層表示を有効/無効にします。

**パラメータ:**
- `enabled` (boolean): 階層表示を有効にするか（デフォルト: true）

**戻り値:** `LineChart`インスタンス（チェーンメソッド対応）

**例:**
```javascript
// 階層表示を有効化（デフォルト）
lineChart.setHierarchicalLabels(true);
// → 1年分の場合: 2024/01 02 03 ... 12 2025/01 02
// → 1ヶ月分の場合: 2025/10/01 02 03 04 05 06 07 08 09 10 11 12 ...

// 階層表示を無効化（通常のラベル表示）
lineChart.setHierarchicalLabels(false);
```

## PieChartクラス（要検討）

### メソッド

#### `setData(data, labels)` (要検討)
円グラフのデータとラベルを設定します。

**パラメータ:**
- `data` (number[]): データの配列（各セグメントの値）
- `labels` (string[]): ラベルの配列（各セグメントのカテゴリ名）

**戻り値:** `PieChart`インスタンス（チェーンメソッド対応）

**例:**
```javascript
pieChart.setData([100, 200, 150, 80], ['商品A', '商品B', '商品C', '商品D']);
// → 4つのセグメントを持つ円グラフ
// → 各セグメントにラベルが表示される
```

#### `setLabelFormat(format)` (要検討)
円グラフのセグメントラベルの表示形式を設定します。

**パラメータ:**
- `format` (string): ラベルの表示形式
  - `'category'`: カテゴリ名のみ（例: "商品A"）
  - `'percentage'`: パーセンテージのみ（例: "25%"）
  - `'value'`: 値のみ（例: "100"）
  - `'category-percentage'` (デフォルト): カテゴリ名とパーセンテージ（例: "商品A (25%)"）
  - `'category-value'`: カテゴリ名と値（例: "商品A: 100"）
  - `'category-value-percentage'`: カテゴリ名、値、パーセンテージ（例: "商品A: 100 (25%)"）

**戻り値:** `PieChart`インスタンス（チェーンメソッド対応）

**例:**
```javascript
// デフォルト: カテゴリ名とパーセンテージ
pieChart.setLabelFormat('category-percentage');
// → "商品A (25%)"

// カテゴリ名、値、パーセンテージを表示
pieChart.setLabelFormat('category-value-percentage');
// → "商品A: 100 (25%)"
```

#### `setLabelPosition(position)` (要検討)
円グラフのセグメントラベルの配置方法を設定します。

**パラメータ:**
- `position` (string): ラベルの配置方法
  - `'auto'` (デフォルト): セグメントのサイズに応じて自動選択
    - セグメントが大きい場合: 外縁の円弧の中心に中央寄せでラベルを配置
    - セグメントが小さい場合: 引出線（リーダーライン）を出すタイプ
  - `'arc-center'`: 外縁の円弧の中心に中央寄せでラベルを配置
    - セグメントの外縁（円弧）の中心角度の位置にラベルを配置
    - ラベルは中央寄せで表示
  - `'leader-line'`: 引出線（リーダーライン）を出すタイプ
    - セグメントの外縁からリーダーラインを伸ばしてラベルを表示
    - 小さいセグメントでも読みやすい

**戻り値:** `PieChart`インスタンス（チェーンメソッド対応）

**例:**
```javascript
// 自動選択（デフォルト）
pieChart.setLabelPosition('auto');
// → セグメントのサイズに応じて自動的に最適な配置方法を選択

// 外縁の円弧の中心に中央寄せでラベルを配置
pieChart.setLabelPosition('arc-center');
// → 全てのセグメントのラベルを外縁の円弧の中心に配置

// 引出線（リーダーライン）を出すタイプ
pieChart.setLabelPosition('leader-line');
// → 全てのセグメントのラベルを引出線で表示
```

#### `setLabelThreshold(threshold)` (要検討)
小さいセグメントと判定する閾値を設定します。この閾値以下のセグメントは、ラベルをセグメント外に表示します。

**パラメータ:**
- `threshold` (number): 閾値（パーセンテージ、0〜100）
  - デフォルト: 5（5%以下のセグメントは小さいと判定）

**戻り値:** `PieChart`インスタンス（チェーンメソッド対応）

**例:**
```javascript
// 3%以下のセグメントは小さいと判定
pieChart.setLabelThreshold(3);
```

#### `setOthersCategory(enabled, threshold, label)` (要検討)
小さいセグメントを「その他」カテゴリにまとめる機能を設定します。

**パラメータ:**
- `enabled` (boolean): 「その他」カテゴリにまとめる機能を有効にするか
  - `true`: 有効
  - `false` (デフォルト): 無効
- `threshold` (number, オプション): 閾値（パーセンテージ、0〜100）
  - この閾値以下のセグメントを「その他」にまとめる
  - デフォルト: 5（5%以下のセグメントを「その他」にまとめる）
- `label` (string, オプション): 「その他」カテゴリのラベル
  - デフォルト: "その他"

**戻り値:** `PieChart`インスタンス（チェーンメソッド対応）

**例:**
```javascript
// 「その他」カテゴリにまとめる機能を有効化（5%以下のセグメントをまとめる）
pieChart.setOthersCategory(true);

// 3%以下のセグメントを「その他」にまとめる
pieChart.setOthersCategory(true, 3);

// カスタムラベルを指定
pieChart.setOthersCategory(true, 5, 'その他の項目');
```

**注意:**
- 「その他」カテゴリは、350度付近（北西）に配置することを推奨
- これにより、ラベルの数を減らし、見やすさが向上する
- 特に180度付近（南）でのラベルの重なりを回避できる

#### `setLegendVisible(visible)` (要検討)
円グラフの凡例の表示/非表示を設定します。円グラフの場合、凡例はデフォルトで表示されます。

**パラメータ:**
- `visible` (boolean): 凡例を表示するかどうか
  - `true` (デフォルト): 凡例を表示
  - `false`: 凡例を非表示

**戻り値:** `PieChart`インスタンス（チェーンメソッド対応）

**例:**
```javascript
// 凡例を表示（デフォルト）
pieChart.setLegendVisible(true);

// 凡例を非表示
pieChart.setLegendVisible(false);
```

#### `setTitle(title)` (要検討)
円グラフのタイトルを設定します。

**パラメータ:**
- `title` (string): グラフのタイトル

**戻り値:** `PieChart`インスタンス（チェーンメソッド対応）

**例:**
```javascript
pieChart.setTitle('商品別売上構成比');
```

#### `setSubtitle(subtitle)` (要検討)
円グラフのサブタイトルを設定します。

**パラメータ:**
- `subtitle` (string): グラフのサブタイトル

**戻り値:** `PieChart`インスタンス（チェーンメソッド対応）

**例:**
```javascript
pieChart.setTitle('商品別売上構成比');
pieChart.setSubtitle('2024年度');
```

#### 複数の円グラフを並べる方法

**2つの円グラフを横並びに配置:**
```javascript
const chart_div = document.getElementById('chart_div');
const chart = new ChartCanvas(chart_div);
chart.size(1200, 600);  // 横長のサイズ

// 1つ目の円グラフ
const pieChart1 = chart.addPieChart();
pieChart1.setData([100, 200, 150], ['商品A', '商品B', '商品C']);
pieChart1.setTitle('2023年度');

// 2つ目の円グラフ
const pieChart2 = chart.addPieChart();
pieChart2.setData([120, 180, 200], ['商品A', '商品B', '商品C']);
pieChart2.setTitle('2024年度');

// レイアウトを設定（横並び）
chart.setLayout('horizontal');  // または 'h'
// → 2つの円グラフが横に並んで表示される

chart.render();
```

**3つの円グラフを横に3つ並べる:**
```javascript
const chart_div = document.getElementById('chart_div');
const chart = new ChartCanvas(chart_div);
chart.size(1500, 600);  // 横長のサイズ

// 3つの円グラフを追加
const pieChart1 = chart.addPieChart();
pieChart1.setData([100, 200], ['商品A', '商品B']);
pieChart1.setTitle('2022年度');

const pieChart2 = chart.addPieChart();
pieChart2.setData([120, 180], ['商品A', '商品B']);
pieChart2.setTitle('2023年度');

const pieChart3 = chart.addPieChart();
pieChart3.setData([150, 200], ['商品A', '商品B']);
pieChart3.setTitle('2024年度');

// レイアウトを設定（横並び）
chart.setLayout('horizontal');
// → 3つの円グラフが横に並んで表示される

chart.render();
```

**2つの円グラフを縦並びに配置:**
```javascript
const chart_div = document.getElementById('chart_div');
const chart = new ChartCanvas(chart_div);
chart.size(800, 1200);  // 縦長のサイズ

const pieChart1 = chart.addPieChart();
pieChart1.setData([100, 200, 150], ['商品A', '商品B', '商品C']);
pieChart1.setTitle('2023年度');

const pieChart2 = chart.addPieChart();
pieChart2.setData([120, 180, 200], ['商品A', '商品B', '商品C']);
pieChart2.setTitle('2024年度');

// レイアウトを設定（縦並び）
chart.setLayout('vertical');  // または 'v'
// → 2つの円グラフが縦に並んで表示される

chart.render();
```

**4つの円グラフを2x2のグリッド状に配置（上下に2つずつ）:**
```javascript
const chart_div = document.getElementById('chart_div');
const chart = new ChartCanvas(chart_div);
chart.size(1200, 1200);

// 4つの円グラフを追加
const pieChart1 = chart.addPieChart();
pieChart1.setData([100, 200], ['商品A', '商品B']);
pieChart1.setTitle('2021年度');

const pieChart2 = chart.addPieChart();
pieChart2.setData([120, 180], ['商品A', '商品B']);
pieChart2.setTitle('2022年度');

const pieChart3 = chart.addPieChart();
pieChart3.setData([150, 160], ['商品A', '商品B']);
pieChart3.setTitle('2023年度');

const pieChart4 = chart.addPieChart();
pieChart4.setData([180, 200], ['商品A', '商品B']);
pieChart4.setTitle('2024年度');

// レイアウトを設定（横並び - 4つの場合は自動的に2x2グリッド）
chart.setLayout('horizontal');
// → 4つの円グラフが2x2のグリッド状に配置される（上下に2つずつ）

// または、自動レイアウト（推奨）
chart.setLayout('auto');
// → グラフの数に応じて自動的に最適なレイアウトを選択

chart.render();
```

## 実装の優先順位

1. **Phase 1: 基本構造**
   - `ChartCanvas`コンストラクタ
   - `addLineChart()`メソッド
   - `render()`メソッド

2. **Phase 2: ラベル設定（最優先）**
   - `LineChart.setLabels()` - X軸ラベル（日付以外）
   - `LineChart.setDateRange()` - X軸日付範囲（最初の日と最後の日を指定）
   - 期間に応じた自動モード切り替え（1ヶ月、3ヶ月、1年、1年以上）
   - `LineChart.setXAxisTitle()` - X軸タイトル
   - `LineChart.setYAxisTitle()` - Y軸タイトル
   - `LineChart.setTitle()` - グラフタイトル
   - **注意:** ラベルはグラフの線よりも重要です

3. **Phase 3: ラベルの自動間引き（必須）**
   - X軸ラベルの自動間引きアルゴリズム
   - 大量のラベル（例: 1年分の日付）に対応
   - Chart.jsと同様の動作

4. **Phase 3.5: 日付ラベルの階層表示（必須）**
   - 日付ラベルの自動検出
   - 階層的な表示レイアウト
   - **1年分の日付:** 年→月の横並び（例: `2024/01 02 03 04 05 06 07 08 09 10 11 12 2025/01 02`）
     - すべて通常のフォントサイズ
   - **1ヶ月分の日付:** 年/月→日の横並び（例: `2025/10/01 02 03 04 05 06 07 08 09 10 11 12 13 14 15 ...`）
     - すべて通常のフォントサイズ
   - **3年分など長期間の日付:**
     - 最初の年/月だけ通常のフォントサイズ（例: `2020/01`）
     - 残りの月/日は小さなフォントサイズ（例: `02 03 04 05 06 07 08 09 10 11 12`）
     - 次の年の最初の月は再び通常サイズ
     - ラベルが被ることを防ぎ、スペースを節約
   - **重要:** 縦書きではなく、横書きの階層表示で読みやすくする

5. **Phase 5: データ設定**
   - `LineChart.setData()`

6. **Phase 6: その他のグラフタイプ**
   - `addBarChart()`
   - `addPieChart()`
   - `addScatterChart()`

7. **Phase 7: 出力機能**
   - `downloadSVG()`
   - `getSVGString()`

8. **Phase 8: オプション機能**
   - 各種オプション設定
   - スタイリング機能

