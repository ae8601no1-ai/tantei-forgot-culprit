# 探偵は犯人を忘れた…

GOTO ARG LAB 第3作。検索型ARG／ミステリー。

## 開発

```bash
npm install
npm run dev
```

## 検証

```bash
npm test
npm run build
```

完成台本は `source/CANONICAL_SCRIPT.md` に原文のまま保存されています。`scripts/extract-canonical.mjs` が検索データを機械的に抽出し、固定SHA-256と照合します。原文が変更された場合は `SCRIPT_INTEGRITY_ERROR` で停止します。

認証を利用する場合は `src/data/config.json` にサーバー側または配信環境側の認証設定を接続してください。合言葉は仕様未決定のため設定していません。
