# ビルド手順

## 概要

`src`ディレクトリ内の複数のJavaScriptファイルを1つのファイルにバンドルして、`docs/sample/chartcanvas.js`として出力します。

## ビルド方法

```bash
npm run build
```

または

```bash
node build.js
```

## 動作

1. `src`ディレクトリ内のすべての`.js`ファイルを再帰的に検索
2. ファイル間の依存関係（import文）を解析
3. 依存関係順にファイルを並べ替え（トポロジカルソート）
4. エントリーポイント（`main.js`）を最初に配置
5. ES Modulesのimport/exportをIIFE形式に変換
6. すべてのファイルを結合して`docs/sample/chartcanvas.js`に出力

## ファイル構造

```
src/
├── main.js          # エントリーポイント（最初に配置される）
├── graph/
│   ├── line.js
│   ├── bar.js
│   └── pie.js
├── data/
│   ├── parser.js
│   └── validator.js
└── utils/
    └── helpers.js
```

↓ ビルド後 ↓

```
docs/sample/
└── chartcanvas.js   # バンドルされた単一ファイル
```

## 注意事項

- 現在の実装は簡易版です。完全なES Modulesの解決は行っていません
- 外部モジュール（node_modules）のimportはスキップされます
- 循環依存がある場合は警告が表示されますが、ビルドは続行されます
- より高度なバンドル機能が必要な場合は、Rollupやesbuildなどの専用ツールの使用を検討してください

## 開発フロー

1. `src`ディレクトリで複数のJavaScriptファイルに分けて開発
2. `npm run build`でバンドルを作成
3. `docs/sample`ディレクトリのHTMLファイルで`chartcanvas.js`を読み込んでテスト
4. 必要に応じて修正して再ビルド

