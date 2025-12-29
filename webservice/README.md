# Web Service

sampleディレクトリのファイルをlocalhostから提供するためのWebサービスです。

## セットアップ

Node.jsがインストールされていることを確認してください。

## 起動方法

```bash
npm start
```

または

```bash
node server.js
```

## アクセス

サーバーが起動すると、以下のURLでアクセスできます：

- http://localhost:3000/001.html
- http://localhost:3000/002.html
- http://localhost:3000/data.tsv
- http://localhost:3000/chartcanvas.js (動的にバンドルされたJavaScriptファイル)

## ポート番号

デフォルトのポート番号は3000です。変更する場合は、`server.js`の`PORT`変数を編集してください。

## ディレクトリ構造

```
webservice/
├── server.js      # HTTPサーバー
├── package.json   # Node.jsパッケージ設定
└── README.md      # このファイル
```

サーバーは`../docs/sample`ディレクトリのファイルを提供します。

## chartcanvas.jsの動的バンドル

`/chartcanvas.js`にアクセスすると、`../src`ディレクトリ内のすべてのJavaScriptファイルが自動的にバンドルされて返されます。

- `src`ディレクトリ内のすべての`.js`ファイルを再帰的に検索
- ファイル間の依存関係（import文）を解析
- 依存関係順にファイルを並べ替え（トポロジカルソート）
- エントリーポイント（`main.js`）を最初に配置
- ES Modulesのimport/exportをIIFE形式に変換
- すべてのファイルを結合して返す

**注意**: リクエストごとに動的にバンドルを生成するため、開発中は常に最新のコードが反映されます。本番環境では、事前にビルドしたファイルを使用することを推奨します。

