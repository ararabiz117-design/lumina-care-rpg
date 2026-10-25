# 技術選定と理由

| 技術 | 役割・採用理由 | トレードオフ |
| --- | --- | --- |
| React 19 + TypeScript | 現行の学習・装備・セーブ処理を維持しつつ、認証画面と同期状態を型付きで接続する。 | 巨大な全面書き換えは避けられるが、既存の大きな画面は今後分割余地がある。 |
| Vite 8 | 独立した静的SPAを軽量にビルド。ブログ用のNext/Vinextを公開物から分離する。 | サーバー描画はしない。ログイン後の学習アプリにSEOは不要と判断。 |
| Cloudflare Workers + Static Assets | APIと画面を同じオリジンから配信し、CookieとCSRFを単純化。専用Workerで他案件と分離。 | Cloudflare仕様に依存。利用量・費用を管理する必要がある。 |
| Cloudflare D1 / SQL migration | ユーザー・セッション・学習記録を関連付け、ユーザー単位の保存とrevision競合制御を行う。 | 同時更新時は自動マージせず、競合を利用者へ明示する。ランキング用の信頼できる採点DBではない。 |
| Google OpenID Connect + jose 6 | Googleだけでログイン。署名検証を実績あるJWTライブラリへ委ね、state・nonce・PKCEを使用。 | Google OAuth専用クライアント設定が必要。Androidネイティブのシステムブラウザー復帰は別途実装・検証が必要。 |
| HttpOnly Cookie + D1 session hash | ブラウザーJSに認証トークンを渡さず、ログアウトでサーバー上のセッションを失効する。 | Cookie認証なのでOriginとCSRFの両方を検証する。 |
| アカウント別localStorage | 通信切断時の変更を端末に残す。旧匿名データの自動取込みを避け、Googleユーザー別に分離。 | 別ブラウザーには自動移行されない。同期前の端末データ消去では失われ得る。暗号化保管ではない。 |
| CSS animation + Canvas | スケルトン、タブ、カード、正答、報酬を演出し、既存ドット調装備合成を維持する。 | 動きを減らす設定を尊重。読み込みを長く見せる人工的な待ち時間は入れない。 |
| Node test runner + SQLite fixture | セーブ・試着・ユーザー分離・競合・CSRF・OIDCの失敗系を直接検証。 | mock GoogleとローカルSQLiteの試験は本番Google/D1のE2Eを証明しない。 |
| GitHub + pnpm lockfile | LUMINAだけのソースと再現可能な依存関係を保存。 | 公開前の秘密・個人情報・他案件混入検査が必須。 |
| Capacitor（既存互換のみ） | ブラウザー/共有APIの既存呼出を維持し、将来のAndroid展開を妨げない。 | 今回の成果物はWeb版。署名AABやPlay提出を実施した意味ではない。 |

## 今回採用しないもの

Supabase、独自パスワード、メール認証、広告SDK、決済SDK、行動分析SDKは使用しません。画像はStatic Assetsで足りるためR2は現時点で不要です。セッションをD1で管理するためKVも追加しません。2D画面に不要なThree.js/PixiJSは独立版へ持ち込みません。

## 一次資料

- Cloudflare Workers Static Assets: https://developers.cloudflare.com/workers/static-assets/binding/
- Cloudflare D1: https://developers.cloudflare.com/d1/
- Google OIDC: https://developers.google.com/identity/openid-connect/reference

公式仕様を参照し、今回の規模と既存コードに合わせた選定です。無制限無料や認証・審査の成功を保証するものではありません。
