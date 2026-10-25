# LUMINA

介護学習と7部位の着せ替えを組み合わせたWebアプリ。LUMINA専用の独立リポジトリです。ブログ、会社アプリ、他サービスのデータは含めません。

## 起動

Node.js 22.13以降とpnpmを使用します。

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm db:local
pnpm worker:dev
```

`http://127.0.0.1:8788/lumina/` を開きます。Google認証の設定がない場合、準備中と表示され、認証を迂回してプレイすることはできません。ローカルの `.dev.vars` にこのアプリ専用のGoogle OAuthクライアント情報を設定してください。`.dev.vars.example` は空の見本です。

開発時の `pnpm dev` はVite画面＋APIプロキシ用です。認証とCookieの実確認はWranglerの同一オリジンで行います。

## 構成

- `app/lumina/`：既存ゲーム、装備、学習エンジン
- `src/`：Googleログイン画面、アカウント別ストレージと同期
- `server/`：Cloudflare Worker、Google OIDC、セッションと進捗API
- `migrations/`：このアプリ専用D1スキーマ
- `public/assets/lumina/`：LUMINAの画像だけ
- `docs/TECHNOLOGY.md`：採用・不採用技術と理由
- `docs/DEPLOYMENT.md`：公開と設定手順、確認範囲

## 制限

現状は18問の学習入口で、国家試験の全範囲や合格を保証しません。資格教育や実技指導の代わりではありません。装備は学習能力・資格の証明ではありません。120品目の登録があり、一部画像は共通です。

学習進捗と記録はアカウント単位で同期します。画面テーマ・背景選択はアカウント別の端末内設定です。旧匿名セーブを他のGoogleアカウントへ自動送信しません。公開ランキング、不正防止のサーバー採点、課金、広告は未実装です。

このリポジトリに既存作品のキャラクター、音楽、画面の転載は含めません。参考作品の画像も含めません。コード・画像の再利用ライセンスは付与していません。公開されていること自体は自由利用の許可ではありません。
