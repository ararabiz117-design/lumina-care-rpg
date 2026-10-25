# LUMINA専用の配備

## 分離

Worker `lumina-care-rpg`、D1 `lumina-db`、Google OAuthクライアントはLUMINA専用にします。他案件のアカウント・D1・秘密を流用しません。対象Chromeはユーザー確認済みの「【X × note】」です。

## 配備手順

1. 対象Cloudflareアカウントを確認する。`pnpm exec wrangler d1 create lumina-db` で新規DBを作り、返却IDだけを `wrangler.jsonc` に設定する。現在のゼロUUIDは実DBではない。
2. `APP_ORIGIN` をこのアプリの実HTTPSオリジンへ変更する。ローカル開発設定のまま公開しない。
3. Google CloudでLUMINA専用のWeb OAuthクライアントを用意し、承認済みリダイレクトURIを `https://<LUMINAのホスト>/api/auth/google/callback` にする。要求スコープは `openid profile` のみ。
4. `pnpm exec wrangler secret put GOOGLE_CLIENT_ID` と `GOOGLE_CLIENT_SECRET` に専用の値を設定する。GitHub、README、画面、チャットへ秘密を貼らない。
5. `pnpm db:remote` で専用DBだけにmigrationを適用する。
6. 認証開始の濫用対策としてWorker Rate Limiting binding `AUTH_RATE_LIMITER` を設定する。サーバー側のhookは実装済み、binding未設定では有効にならない。
7. `pnpm test`、`pnpm build`、`pnpm exec wrangler deploy --dry-run` の後に公開する。
8. HTTPS実URLでGoogleログイン、問題→解説→装備→再読込、ログアウト、別ユーザー分離を確認する。削除は匿名の試験アカウントでのみ確認する。

Cloudflare/GitHubの新しい連携権限や契約への同意が必要な場合は、本人確認・同意を経る。無料枠超過時の課金や有料プランは自動で申し込まない。

## 既存端末データ

旧ブラウザー版の匿名セーブは元の場所に残し、ログイン先へ勝手に移さない。アカウントに同期する進捗と統計はD1へ、外見テーマと背景選択は端末内のアカウント別領域へ保存する。共有は本人の操作で開始する。

## リリースの限界

ローカル型検査・テスト・Webビルド、GitHubへのファイル公開、Cloudflare配備、Google実ログイン、Android実機、Playストア公開はそれぞれ別の確認項目。未確認を完了として報告しない。
