# CLI設定JSON仕様

## 概要

CLIツールで使用する設定JSONの詳細仕様です。線/棒日付グラフ、グループ線日付グラフ、ヒストグラムの3つのチャートタイプに対応します。

## 基本構造

設定JSONは以下の基本構造を持ちます：

```json
{
  "chart": {
    "width": 1024,
    "height": 600,
    "title": "グラフタイトル",
    "subtitle": "サブタイトル"
  },
  "chartType": "dateChart" | "groupDateChart" | "histogram",
  "tsv": {
    // TSVファイルの設定
  }
}
```

## 1. 線/棒 日付グラフ（dateChart）

事前に系列を定義し、TSVファイルの列名を各系列にマッピングする方式です。

### 設定構造

```json
{
  "chart": {
    "width": 1024,
    "height": 600,
    "title": "売上・客数推移",
    "subtitle": "7日分のデータ"
  },
  "chartType": "dateChart",
  "dateChart": {
    "xAxisTitle": "日付",
    "yAxisTitle": "売上",
    "yAxisScale": "円",
    "yAxisFormat": "#,##0",
    "secondAxis": false,
    "secondAxisTitle": "客数",
    "secondAxisScale": "人",
    "secondAxisFormat": "#,##0",
    "dateFormat": "auto",
    "xGrid": false,
    "yGrid": false
  },
  "tsv": {
    "dateTitle": "日付",
    "commentTitle": "コメント",
    "series": [
      {
        "type": "line",
        "title": "売上",
        "column": "売上",
        "color": "red",
        "lineWidth": 2,
        "lineType": "solid",
        "secondAxis": false,
        "showMarkers": true
      },
      {
        "type": "bar",
        "title": "客数",
        "column": "客数",
        "color": "blue",
        "secondAxis": true
      }
    ]
  }
}
```

### 設定項目の詳細

#### chart（グラフ全体の設定）

- `width` (number, デフォルト: 1024): グラフの幅（ピクセル）
- `height` (number, デフォルト: 600): グラフの高さ（ピクセル）
- `title` (string, オプション): グラフのタイトル
- `subtitle` (string, オプション): グラフのサブタイトル

#### dateChart（日付チャートの設定）

- `xAxisTitle` (string, オプション): X軸のタイトル
- `yAxisTitle` (string, オプション): Y軸（主軸）のタイトル
- `yAxisScale` (string, オプション): Y軸（主軸）の単位（例: "円", "万円", "人"）
- `yAxisFormat` (string, デフォルト: "#,##0"): Y軸（主軸）の数値フォーマット
  - `"#,##0"`: カンマ区切り（例: 1,000）
  - `"#,##0%"`: パーセンテージ（例: 50%）
  - `"0"`: 通常の数値（例: 1000）
- `secondAxis` (boolean, デフォルト: false): 副軸を使用するかどうか
- `secondAxisTitle` (string, オプション): 副軸のタイトル
- `secondAxisScale` (string, オプション): 副軸の単位
- `secondAxisFormat` (string, デフォルト: "#,##0"): 副軸の数値フォーマット
- `dateFormat` (string, デフォルト: "auto"): 日付形式
  - `"YYYYMMDD"`: 20250101形式
  - `"YYYY-MM-DD"`: 2025-01-01形式
  - `"YYYY/MM/DD"`: 2025/01/01形式
  - `"auto"`: 自動検出
- `xGrid` (boolean, デフォルト: false): X軸のグリッド線を表示するか
- `yGrid` (boolean, デフォルト: false): Y軸のグリッド線を表示するか

#### tsv（TSVデータの設定）

- `dateTitle` (string, 必須): TSVファイルの日付列の列名
- `commentTitle` (string, オプション): TSVファイルのコメント列の列名
- `series` (array, 必須): 系列の設定配列
  - `type` (string, 必須): 系列の種類
    - `"line"`: 線グラフ
    - `"bar"`: 棒グラフ
  - `title` (string, 必須): 系列のタイトル（凡例に表示される）
  - `column` (string, 必須): TSVファイルの値列の列名
  - `color` (string, オプション): 系列の色（デフォルト: "black" for line, "blue" for bar）
  - `lineWidth` (number, オプション): 線の太さ（lineタイプのみ、デフォルト: 2）
  - `lineType` (string, オプション): 線の種類（lineタイプのみ）
    - `"solid"`: 実線（デフォルト）
    - `"dashed"`: 破線
    - `"dotted"`: 点線
  - `secondAxis` (boolean, オプション): 副軸を使用するか（デフォルト: false）
  - `showMarkers` (boolean, オプション): マーカーを表示するか（lineタイプのみ、デフォルト: false）

### TSVファイルの形式

```
日付	売上	客数	コメント
20250101	20000	150	特売日
20250102	21000	160	
20250103	19000	140	通常営業
```

### 使用例

```json
{
  "chart": {
    "title": "売上・客数推移"
  },
  "chartType": "dateChart",
  "dateChart": {
    "yAxisTitle": "売上",
    "yAxisScale": "円",
    "secondAxis": true,
    "secondAxisTitle": "客数",
    "secondAxisScale": "人"
  },
  "tsv": {
    "dateTitle": "日付",
    "commentTitle": "コメント",
    "series": [
      {
        "type": "line",
        "title": "売上",
        "column": "売上",
        "color": "red",
        "lineWidth": 2,
        "showMarkers": true
      },
      {
        "type": "bar",
        "title": "客数",
        "column": "客数",
        "color": "blue",
        "secondAxis": true
      }
    ]
  }
}
```

## 2. グループ線 日付グラフ（groupDateChart）

グループ列を指定して、グループごとに自動的に系列を作成する方式です。

### 設定構造

```json
{
  "chart": {
    "width": 1024,
    "height": 600,
    "title": "店舗別売上推移",
    "subtitle": ""
  },
  "chartType": "groupDateChart",
  "dateChart": {
    "xAxisTitle": "日付",
    "yAxisTitle": "売上",
    "yAxisScale": "円",
    "yAxisFormat": "#,##0",
    "dateFormat": "auto",
    "xGrid": false,
    "yGrid": false
  },
  "tsv": {
    "dateTitle": "日付",
    "valueTitle": "売上",
    "groupTitle": "店舗名",
    "commentTitle": "コメント",
    "seriesType": "line",
    "seriesOptions": {
      "lineWidth": 2,
      "lineType": "solid",
      "showMarkers": true
    },
    "seriesColors": ["red", "blue", "green", "orange", "purple", "brown", "pink", "gray"]
  }
}
```

### 設定項目の詳細

#### chart（グラフ全体の設定）

dateChartと同じです。

#### dateChart（日付チャートの設定）

dateChartと同じですが、`secondAxis`関連の設定は使用されません（グループごとに系列が作成されるため、副軸の概念は適用されません）。

#### tsv（TSVデータの設定）

- `dateTitle` (string, 必須): TSVファイルの日付列の列名
- `valueTitle` (string, 必須): TSVファイルの値列の列名（すべてのグループで共通）
- `groupTitle` (string, 必須): TSVファイルのグループ列の列名
- `commentTitle` (string, オプション): TSVファイルのコメント列の列名
- `seriesType` (string, デフォルト: "line"): 系列の種類
  - `"line"`: 線グラフ
  - `"bar"`: 棒グラフ
- `seriesOptions` (object, オプション): 系列作成時の追加オプション
  - `lineWidth` (number, オプション): 線の太さ（lineタイプのみ、デフォルト: 2）
  - `lineType` (string, オプション): 線の種類（lineタイプのみ、デフォルト: "solid"）
  - `showMarkers` (boolean, オプション): マーカーを表示するか（lineタイプのみ、デフォルト: false）
- `seriesColors` (array, オプション): 系列の色のパレット（デフォルト: ["red", "blue", "green", "orange", "purple", "brown", "pink", "gray"]）
  - グループ数が色の数より多い場合、色が循環して使用されます

### TSVファイルの形式

```
日付	売上	店舗名	コメント
20250101	20000	新宿店	特売日
20250102	21000	新宿店	
20250101	15000	渋谷店	
20250102	16000	渋谷店	通常営業
```

### 使用例

```json
{
  "chart": {
    "title": "店舗別売上推移"
  },
  "chartType": "groupDateChart",
  "dateChart": {
    "yAxisTitle": "売上",
    "yAxisScale": "円",
    "xGrid": true,
    "yGrid": true
  },
  "tsv": {
    "dateTitle": "日付",
    "valueTitle": "売上",
    "groupTitle": "店舗名",
    "commentTitle": "コメント",
    "seriesType": "line",
    "seriesOptions": {
      "lineWidth": 2,
      "lineType": "solid",
      "showMarkers": true
    }
  }
}
```

## 3. ヒストグラム（histogram）

生データからヒストグラムを作成する方式です。単一系列またはグループ別のヒストグラムに対応します。

### 設定構造

```json
{
  "chart": {
    "width": 1024,
    "height": 600,
    "title": "売上の分布（店舗別）",
    "subtitle": "各店舗の売上データの分布を比較"
  },
  "chartType": "histogram",
  "histogram": {
    "xAxisTitle": "売上",
    "yAxisTitle": "頻度",
    "xAxisFormat": "#,##0",
    "yAxisFormat": "#,##0",
    "binCount": null,
    "binWidth": null,
    "binAlignment": "left",
    "curveMode": false,
    "xGrid": false,
    "yGrid": false
  },
  "tsv": {
    "valueTitle": "値",
    "groupTitle": "店舗名",
    "seriesColors": ["blue", "red", "green", "orange", "purple", "brown", "pink", "gray"]
  }
}
```

### 設定項目の詳細

#### chart（グラフ全体の設定）

dateChartと同じです。

#### histogram（ヒストグラムの設定）

- `xAxisTitle` (string, オプション): X軸のタイトル
- `yAxisTitle` (string, デフォルト: "頻度"): Y軸のタイトル
- `xAxisFormat` (string, デフォルト: "#,##0"): X軸の数値フォーマット
- `yAxisFormat` (string, デフォルト: "#,##0"): Y軸の数値フォーマット
- `binCount` (number | null, デフォルト: null): ビンの数（nullの場合は自動計算）
- `binWidth` (number | null, デフォルト: null): ビンの幅（nullの場合は自動計算）
  - `binCount`と`binWidth`の両方が指定されている場合、`binWidth`が優先されます
- `binAlignment` (string, デフォルト: "left"): ビンの配置
  - `"left"`: 左揃え
  - `"center"`: 中央揃え
  - `"right"`: 右揃え
- `curveMode` (boolean, デフォルト: false): ベジェ曲線モードを使用するか
  - `true`: ベジェ曲線で描画
  - `false`: 棒グラフで描画
- `xGrid` (boolean, デフォルト: false): X軸のグリッド線を表示するか
- `yGrid` (boolean, デフォルト: false): Y軸のグリッド線を表示するか

#### tsv（TSVデータの設定）

- `valueTitle` (string, 必須): TSVファイルの値列の列名
- `groupTitle` (string, オプション): TSVファイルのグループ列の列名
  - 指定されていない場合: 単一のヒストグラム系列を作成
  - 指定されている場合: グループごとにヒストグラム系列を作成
- `seriesColors` (array, オプション): 系列の色のパレット（デフォルト: ["blue", "red", "green", "orange", "purple", "brown", "pink", "gray"]）
  - グループ別ヒストグラムの場合、各グループに色が割り当てられます

### TSVファイルの形式

#### 単一系列の場合

```
値
100
150
200
120
180
```

#### グループ別の場合

```
値	店舗名
100	新宿店
150	新宿店
200	渋谷店
120	渋谷店
180	新宿店
```

### 使用例

#### 単一系列のヒストグラム

```json
{
  "chart": {
    "title": "売上の分布"
  },
  "chartType": "histogram",
  "histogram": {
    "xAxisTitle": "売上",
    "yAxisTitle": "頻度"
  },
  "tsv": {
    "valueTitle": "値"
  }
}
```

#### グループ別のヒストグラム

```json
{
  "chart": {
    "title": "売上の分布（店舗別）"
  },
  "chartType": "histogram",
  "histogram": {
    "xAxisTitle": "売上",
    "yAxisTitle": "頻度",
    "curveMode": true,
    "xGrid": true,
    "yGrid": true
  },
  "tsv": {
    "valueTitle": "値",
    "groupTitle": "店舗名"
  }
}
```

## チャートタイプの判定

`chartType`フィールドでチャートタイプを指定します：

- `"dateChart"`: 線/棒 日付グラフ（事前に系列を定義）
- `"groupDateChart"`: グループ線 日付グラフ（グループ列から自動生成）
- `"histogram"`: ヒストグラム

## エラーハンドリング

### 必須項目の不足

以下の必須項目が不足している場合、エラーをスローします：

- `chartType`: チャートタイプが指定されていない
- `tsv.dateTitle`: dateChart/groupDateChartの場合、日付列が指定されていない
- `tsv.valueTitle`: groupDateChart/histogramの場合、値列が指定されていない
- `tsv.groupTitle`: groupDateChartの場合、グループ列が指定されていない
- `tsv.series`: dateChartの場合、系列が1つも指定されていない

### TSVファイルの解析エラー

- ヘッダー行に必要な列が見つからない場合: エラーをスロー
- データ行の列数が足りない場合: その行をスキップ
- 値列が数値でない場合: その行をスキップ

## 実装時の注意点

### 1. チャートタイプの判定

`chartType`フィールドに基づいて、適切なチャートタイプを選択します。

### 2. TSVデータの読み込み

標準入力からTSVデータを読み込み、設定に基づいて解析します。

### 3. 系列の作成

- `dateChart`: `tsv.series`配列に基づいて系列を作成
- `groupDateChart`: TSVデータからグループを抽出し、グループごとに系列を作成
- `histogram`: `tsv.groupTitle`の有無に応じて、単一またはグループ別の系列を作成

### 4. デフォルト値の適用

設定ファイルで指定されていない項目は、各セクションで定義されたデフォルト値を使用します。

## 関連ドキュメント

- [21-CLI仕様.md](./21-CLI仕様.md) - CLIツールの基本仕様
- [20-002.html仕様（TSVローダーAPI）.md](./20-002.html仕様（TSVローダーAPI）.md) - TSVローダーのAPI仕様
- [08-API仕様.md](./08-API仕様.md) - ChartCanvasのAPI仕様

