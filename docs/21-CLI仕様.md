# CLI仕様

## 概要

ChartCanvasをコマンドラインから実行できるようにするためのCLIツールの仕様です。シェルでワンライナーとして実行でき、TSVデータを標準入力から読み込み、SVGを標準出力に出力します。

## 目的

- サーバー側で動くだけでなく、シェルでワンライナーで動かせるようにする
- JSONファイルまたは直接JSONの引数を渡して設定を指定する
- TSVファイルは標準入力から読み込む
- SVGは標準出力に出力する

## コマンド形式

### 基本形式

```bash
node cli.js [OPTIONS] [CONFIG]
```

### オプション

- `-c, --config <file>`: 設定ファイル（JSON）のパスを指定
- `-j, --json <json>`: 設定を直接JSON文字列で指定
- `-h, --help`: ヘルプを表示
- `-v, --version`: バージョンを表示

### 設定の指定方法

設定は以下のいずれかの方法で指定できます：

1. **JSONファイルから読み込む**
   ```bash
   node cli.js -c config.json < data.tsv > output.svg
   ```

2. **直接JSON文字列で指定**
   ```bash
   node cli.js -j '{"title":"売上推移"}' < data.tsv > output.svg
   ```

3. **引数として直接指定（位置引数）**
   ```bash
   node cli.js '{"title":"売上推移"}' < data.tsv > output.svg
   ```

## 設定JSONの形式

### 基本構造

```json
{
  "chart": {
    "width": 1024,
    "height": 600,
    "title": "グラフタイトル",
    "subtitle": "サブタイトル"
  },
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

### 設定項目の説明

#### chart（グラフ全体の設定）

- `width` (number, デフォルト: 1024): グラフの幅（ピクセル）
- `height` (number, デフォルト: 600): グラフの高さ（ピクセル）
- `title` (string, オプション): グラフのタイトル
- `subtitle` (string, オプション): グラフのサブタイトル

#### dateChart（日付チャートの設定）

- `xAxisTitle` (string, オプション): X軸のタイトル
- `yAxisTitle` (string, オプション): Y軸（主軸）のタイトル
- `yAxisScale` (string, オプション): Y軸（主軸）の単位
- `yAxisFormat` (string, デフォルト: "#,##0"): Y軸（主軸）の数値フォーマット
- `secondAxis` (boolean, デフォルト: false): 副軸を使用するかどうか
- `secondAxisTitle` (string, オプション): 副軸のタイトル
- `secondAxisScale` (string, オプション): 副軸の単位
- `secondAxisFormat` (string, デフォルト: "#,##0"): 副軸の数値フォーマット
- `dateFormat` (string, デフォルト: "auto"): 日付形式（"YYYYMMDD", "YYYY-MM-DD", "YYYY/MM/DD", "auto"）
- `xGrid` (boolean, デフォルト: false): X軸のグリッド線を表示するか
- `yGrid` (boolean, デフォルト: false): Y軸のグリッド線を表示するか

#### tsv（TSVデータの設定）

- `dateTitle` (string, 必須): TSVファイルの日付列の列名
- `commentTitle` (string, オプション): TSVファイルのコメント列の列名
- `series` (array, 必須): 系列の設定配列
  - `type` (string, 必須): 系列の種類（"line" または "bar"）
  - `title` (string, 必須): 系列のタイトル
  - `column` (string, 必須): TSVファイルの値列の列名
  - `color` (string, オプション): 系列の色（デフォルト: "black" for line, "blue" for bar）
  - `lineWidth` (number, オプション): 線の太さ（lineタイプのみ、デフォルト: 2）
  - `lineType` (string, オプション): 線の種類（lineタイプのみ、"solid", "dashed", "dotted"、デフォルト: "solid"）
  - `secondAxis` (boolean, オプション): 副軸を使用するか（デフォルト: false）
  - `showMarkers` (boolean, オプション): マーカーを表示するか（lineタイプのみ、デフォルト: false）

## TSVファイルの形式

TSVファイルは標準入力から読み込まれます。形式は既存のTSVローダーと同じです。

### ヘッダー行

1行目はヘッダー行として扱われます。タブ区切りで列名を記述します。

```
日付	売上	客数	コメント
```

### データ行

2行目以降がデータ行として扱われます。タブ区切りでデータを記述します。

```
20250101	20000	150	特売日
20250102	21000	160	
20250103	19000	140	通常営業
```

### データ形式

- **日付列**: 日付を文字列で記述（例: `20250101`, `2025/01/01`, `2025-01-01`）
- **値列**: 数値を記述（例: `20000`, `150`）
- **コメント列**: コメントテキスト（オプション、空文字列も可）

## 使用例

### 例1: JSONファイルを使用

```bash
# config.json
{
  "chart": {
    "title": "売上・客数推移"
  },
  "dateChart": {
    "yAxisTitle": "売上",
    "yAxisScale": "円",
    "secondAxis": true,
    "secondAxisTitle": "客数",
    "secondAxisScale": "人"
  },
  "tsv": {
    "dateTitle": "日付",
    "series": [
      {"type": "line", "title": "売上", "column": "売上", "color": "red"},
      {"type": "bar", "title": "客数", "column": "客数", "color": "blue", "secondAxis": true}
    ]
  }
}

# 実行
cat data.tsv | node cli.js -c config.json > output.svg
```

### 例2: 直接JSON文字列で指定

```bash
cat data.tsv | node cli.js -j '{"chart":{"title":"売上推移"},"tsv":{"dateTitle":"日付","series":[{"type":"line","title":"売上","column":"売上"}]}}' > output.svg
```

### 例3: 位置引数で指定

```bash
cat data.tsv | node cli.js '{"chart":{"title":"売上推移"},"tsv":{"dateTitle":"日付","series":[{"type":"line","title":"売上","column":"売上"}]}}' > output.svg
```

### 例4: パイプで連鎖

```bash
curl https://example.com/data.tsv | node cli.js -c config.json | tee output.svg
```

## エラーハンドリング

### エラー時の動作

- 設定ファイルが見つからない場合: エラーメッセージを標準エラー出力に出力し、終了コード1で終了
- JSONの解析エラー: エラーメッセージを標準エラー出力に出力し、終了コード1で終了
- TSVファイルの解析エラー: エラーメッセージを標準エラー出力に出力し、終了コード1で終了
- 必須項目が不足している場合: エラーメッセージを標準エラー出力に出力し、終了コード1で終了

### エラーメッセージの形式

```
Error: [エラーの種類]: [エラーの詳細]
```

例:
```
Error: Config file not found: config.json
Error: Invalid JSON: Unexpected token } in JSON at position 42
Error: Required field missing: tsv.dateTitle
Error: TSV parse error: Column '売上' not found in header
```

## 実装の考慮事項

### 1. 標準入力の読み込み

- Node.jsの`process.stdin`からTSVデータを読み込む
- ストリームとして処理するか、一度にすべて読み込むかは実装時に決定

### 2. 標準出力への出力

- SVG文字列を`process.stdout`に出力
- エラーメッセージは`process.stderr`に出力

### 3. ブラウザAPIの代替

- `ChartCanvas`クラスはDOM APIを使用しているため、Node.js環境では動作しない
- Puppeteerやjsdomなどのライブラリを使用してDOM環境をシミュレートする必要がある
- または、サーバー側レンダリング用の専用実装を作成する

### 4. 依存関係

- `puppeteer`: SVG生成のために使用（既存のサーバー側実装と同様）
- `commander`または`yargs`: コマンドライン引数の解析
- または、Node.js標準の`process.argv`を使用

### 5. パフォーマンス

- 大量のデータを処理する場合のメモリ使用量に注意
- ストリーム処理を検討する

## 将来の拡張

### 1. ヒストグラムチャートのサポート

```json
{
  "histogramChart": {
    "xAxisTitle": "価格",
    "yAxisTitle": "頻度",
    "bins": 20,
    "curveMode": false
  },
  "tsv": {
    "valueTitle": "価格",
    "series": [
      {
        "type": "histogram",
        "title": "価格分布",
        "column": "価格",
        "color": "blue"
      }
    ]
  }
}
```

### 2. 複数のチャートタイプのサポート

- 日付チャートとヒストグラムチャートを同時に指定できるようにする
- または、チャートタイプを自動判定する

### 3. 出力形式の拡張

- PNG形式での出力（`--format png`オプション）
- PDF形式での出力（`--format pdf`オプション）

### 4. 設定ファイルの検証

- JSONスキーマを使用した設定ファイルの検証
- より詳細なエラーメッセージ

## 関連ドキュメント

- [20-002.html仕様（TSVローダーAPI）.md](./20-002.html仕様（TSVローダーAPI）.md) - TSVローダーのAPI仕様
- [08-API仕様.md](./08-API仕様.md) - ChartCanvasのAPI仕様
- [19-レンダリング処理フロー.md](./19-レンダリング処理フロー.md) - レンダリング処理のフロー

