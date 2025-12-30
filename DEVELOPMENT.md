# 開発メモ

## サーバーの再起動方法

webサービスを再起動する場合は、以下の手順を実行してください：

1. **サーバーを停止**: `http://localhost:3000/stop` にアクセスしてサーバーを停止
2. **サーバーを再起動**: `webservice`ディレクトリで `node server.js` を実行

```bash
# 停止
curl http://localhost:3000/stop

# 再起動
cd webservice
node server.js
```

## SVGからPNGへの自動変換

SVGファイルをアップロードすると、自動的にPNGファイルも生成されます：
- SVGファイル: `docs/sample/output/chart-*.svg`
- PNGファイル: `docs/sample/output/chart-*.png`（同時に生成）

PNGファイルは `/output/chart-*.png` でアクセスできます。

