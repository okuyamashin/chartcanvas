# 円グラフTSV仕様

## 概要

円グラフ用のTSVファイル形式とTSVローダーAPIの仕様を定義します。

円グラフは時系列データではないため、日付列は不要です。カテゴリ名と値のみで構成されます。

## TSVファイルの形式

### 1. 単一の円グラフの場合

#### ヘッダー行

TSVファイルの1行目はヘッダー行として扱われます。タブ区切りで列名を記述します。

**必須列:**
- `カテゴリ名` (または `category`): セグメントのカテゴリ名
- `値` (または `value`): セグメントの値（数値）

```
カテゴリ名	値
```

または英語版:

```
category	value
```

#### データ行

2行目以降がデータ行として扱われます。タブ区切りでデータを記述します。

```
商品A	100
商品B	200
商品C	150
商品D	80
```

**データ形式:**
- **カテゴリ名列**: カテゴリ名を文字列で記述（例: `商品A`, `商品B`）
- **値列**: 数値を記述（例: `100`, `200`）

**注意:**
- 値は0以上の数値である必要があります
- 値が0のセグメントは表示されません（または表示オプションで制御可能）
- 値が負の数の場合、その行はスキップされます

### 2. 複数の円グラフを並べる場合

複数の円グラフを並べる場合、グループ列を追加します。

#### ヘッダー行

```
カテゴリ名	値	グループ
```

または英語版:

```
category	value	group
```

#### データ行

```
商品A	100	2023年度
商品B	200	2023年度
商品C	150	2023年度
商品A	120	2024年度
商品B	180	2024年度
商品C	200	2024年度
```

**データ形式:**
- **カテゴリ名列**: カテゴリ名を文字列で記述
- **値列**: 数値を記述
- **グループ列**: グループ名を文字列で記述（例: `2023年度`, `2024年度`）

**処理方法:**
- グループごとに円グラフが作成されます
- 同じグループ名のデータは、同じ円グラフに集約されます
- グループごとに自動的に`addPieChart()`が呼び出されます

## TSVローダーAPI仕様

### TSVローダーの作成

`PieChart`オブジェクトに対して、`tsvLoader()`メソッドを呼び出してTSVローダーを作成します。

```javascript
const loader = pieChart.tsvLoader('https://sample.com/data.tsv');
```

**パラメータ:**
- `url` (string): TSVファイルのURL

**戻り値:**
- `PieTsvLoader`オブジェクト

### 列のマッピング設定

TSVファイルのヘッダー行にある列名を、カテゴリ名、値、グループに対応付けます。

#### 単一の円グラフの場合

```javascript
loader.categoryTitle = 'カテゴリ名';  // カテゴリ名列の列名
loader.valueTitle = '値';              // 値列の列名
```

**プロパティ:**
- `categoryTitle` (string): カテゴリ名列の列名（必須）
- `valueTitle` (string): 値列の列名（必須）

#### 複数の円グラフを並べる場合

```javascript
loader.categoryTitle = 'カテゴリ名';  // カテゴリ名列の列名
loader.valueTitle = '値';              // 値列の列名
loader.groupTitle = 'グループ';        // グループ列の列名（必須）
```

**プロパティ:**
- `categoryTitle` (string): カテゴリ名列の列名（必須）
- `valueTitle` (string): 値列の列名（必須）
- `groupTitle` (string): グループ列の列名（複数の円グラフを並べる場合に必須）

### データの読み込み

`load()`メソッドを呼び出して、TSVファイルを読み込み、データを解析してグラフに追加します。

```javascript
await loader.load();
```

**戻り値:**
- `Promise<void>`: 読み込みが完了したら解決されるPromise

**処理内容:**
1. TSVファイルをfetch APIで読み込む
2. ヘッダー行（1行目）を解析して、各列のインデックスを取得
3. データ行（2行目以降）を解析して、グループごとにデータを分類
4. グループごとに自動的に`addPieChart()`を呼び出し（複数の円グラフの場合）
5. 各グループのデータに対して`setData()`を呼び出してデータを追加
6. 色を自動的に決定

## 使用例

### 例1: 単一の円グラフ

```javascript
window.addEventListener('DOMContentLoaded', async () => {
    const chart_div = document.getElementById('chart_div');
    const chart = new ChartCanvas(chart_div);
    chart.size(800, 600);
    
    const pieChart = chart.addPieChart();
    pieChart.title = '商品別売上構成比';
    pieChart.subtitle = '2024年度';

    const loader = pieChart.tsvLoader('https://sample.com/data-pie.tsv');
    loader.categoryTitle = 'カテゴリ名';
    loader.valueTitle = '値';

    try {
        await loader.load();
        chart.render();
    } catch (error) {
        console.error('TSVファイルの読み込みエラー:', error);
        chart.render();
    }
});
```

**TSVファイル (`data-pie.tsv`):**
```
カテゴリ名	値
商品A	100
商品B	200
商品C	150
商品D	80
```

### 例2: 複数の円グラフを横並びに配置

```javascript
window.addEventListener('DOMContentLoaded', async () => {
    const chart_div = document.getElementById('chart_div');
    const chart = new ChartCanvas(chart_div);
    chart.size(1200, 600);
    
    const pieChart = chart.addPieChart();
    pieChart.title = '年度別商品構成比';

    const loader = pieChart.tsvLoader('https://sample.com/data-pie-multi.tsv');
    loader.categoryTitle = 'カテゴリ名';
    loader.valueTitle = '値';
    loader.groupTitle = 'グループ';

    try {
        await loader.load();
        // レイアウトを設定（横並び）
        chart.setLayout('horizontal');
        chart.render();
    } catch (error) {
        console.error('TSVファイルの読み込みエラー:', error);
        chart.render();
    }
});
```

**TSVファイル (`data-pie-multi.tsv`):**
```
カテゴリ名	値	グループ
商品A	100	2023年度
商品B	200	2023年度
商品C	150	2023年度
商品A	120	2024年度
商品B	180	2024年度
商品C	200	2024年度
```

**処理結果:**
- 2つの円グラフが作成されます（2023年度、2024年度）
- 各円グラフの下に凡例が表示されます
- 2つの円グラフが横に並んで表示されます
- 全ての円グラフが同じサイズに統一されます

### 例3: 英語版のTSVファイル

```javascript
window.addEventListener('DOMContentLoaded', async () => {
    const chart_div = document.getElementById('chart_div');
    const chart = new ChartCanvas(chart_div);
    chart.size(800, 600);
    
    const pieChart = chart.addPieChart();
    pieChart.title = 'Sales by Product';
    pieChart.subtitle = '2024';

    const loader = pieChart.tsvLoader('https://sample.com/data-pie-en.tsv');
    loader.categoryTitle = 'category';
    loader.valueTitle = 'value';

    try {
        await loader.load();
        chart.render();
    } catch (error) {
        console.error('TSVファイルの読み込みエラー:', error);
        chart.render();
    }
});
```

**TSVファイル (`data-pie-en.tsv`):**
```
category	value
Product A	100
Product B	200
Product C	150
Product D	80
```

## 処理フロー

### 1. TSVファイルの読み込み

`loader.load()`が呼ばれると、以下の処理が実行されます：

1. **fetch APIでTSVファイルを読み込む**
   - `fetch(url)`でTSVファイルを取得
   - `response.text()`でテキストデータを取得

2. **ヘッダー行の解析**
   - 1行目をタブ区切りで分割
   - `categoryTitle`, `valueTitle`, `groupTitle`（オプション）に対応する列のインデックスを取得
   - 列が見つからない場合はエラーをスロー

3. **データ行の解析**
   - 2行目以降を1行ずつ処理
   - タブ区切りで分割して、カテゴリ名、値、グループ（オプション）を取得
   - グループごとにデータを分類（`Map`を使用）

4. **データの検証**
   - 値が数値であることを確認
   - 値が0以上の数値であることを確認
   - 値が負の数の場合、その行はスキップ

5. **円グラフの自動追加（複数の円グラフの場合）**
   - 各グループに対して`addPieChart()`を呼び出し
   - 色を自動的に決定
   - 各グループのデータに対して`setData()`を呼び出してデータを追加

### 2. グラフの描画

`loader.load()`が完了したら、`chart.render()`を呼び出してグラフを描画します。

## 自動処理の詳細

### グループごとの円グラフ追加

- 新しいグループが出現したら、自動的に`addPieChart()`を呼び出します
- グループ名が円グラフのタイトルとして使用されます（オプション）

### 色の自動決定

- 色は自動的に割り当てられます（例: `red`, `blue`, `green`, `orange`, `purple`など）
- 各カテゴリに異なる色が割り当てられます
- カテゴリ数が色の数より多い場合、色が循環して使用されます

### データの追加

- 各グループのデータは、`setData()`で追加されます
- データはTSVファイルに記述された順序で追加されます（ソートは不要）

## エラーハンドリング

### ファイル読み込みエラー

- HTTPエラー（404、500など）が発生した場合、`load()`メソッドがエラーをスローします
- エラー時は`catch`ブロックで処理し、エラーメッセージをコンソールに出力します
- エラー時も`chart.render()`を呼び出して、空のグラフを表示します

### データ形式エラー

- ヘッダー行に必要な列が見つからない場合、エラーをスローします
- データ行の列数が足りない場合、その行はスキップされます
- 値列が数値でない場合、その行はスキップされます
- 値が負の数の場合、その行はスキップされます

## 実装時の注意点

### 1. 非同期処理

- `load()`メソッドは非同期で実行されるため、`await`で待機する必要があります
- `chart.render()`は、`load()`が完了してから呼び出す必要があります

### 2. データの順序

- TSVファイルのデータ行の順序は保持されます
- 円グラフのセグメントの順序は、TSVファイルの順序に従います

### 3. グループ名の重複

- 同じグループ名のデータは、同じ円グラフに集約されます
- グループ名が空文字列の場合も、1つのグループとして扱われます

### 4. 値が0の場合

- 値が0のセグメントは、デフォルトでは表示されません
- 表示オプションで制御可能（将来の拡張）

## 関連ドキュメント

- [20-002.html仕様（TSVローダーAPI）.md](./20-002.html仕様（TSVローダーAPI）.md) - 日付グラフ用のTSVローダーAPI仕様
- [08-API仕様.md](./08-API仕様.md) - PieChartクラスのAPI仕様
- [02-機能要件.md](./02-機能要件.md) - 円グラフの機能要件
- [10-ラベル設計.md](./10-ラベル設計.md) - 円グラフのラベル設計

## 将来の拡張

### CSVローダー

TSVローダーと同様に、CSVローダーも実装可能です：

```javascript
const loader = pieChart.csvLoader('https://sample.com/data.csv');
```

### JSONローダー

JSON形式のデータを読み込むローダーも実装可能です：

```javascript
const loader = pieChart.jsonLoader('https://sample.com/data.json');
loader.categoryPath = 'category';
loader.valuePath = 'value';
loader.groupPath = 'group';
```

### カスタマイズオプション

色のパレットをカスタマイズするオプションを追加することも可能です：

```javascript
loader.colorPalette = ['red', 'blue', 'green']; // 色のパレットを指定
```

### タイトルの自動設定

グループ名を円グラフのタイトルとして自動設定するオプション：

```javascript
loader.autoTitle = true; // グループ名をタイトルとして使用
```

