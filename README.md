# クイックメモ

勤務中に思いついたことを、ポストイットに書く速さでスマホに残すためのアプリです。

- 仕様書:[`docs/SPEC.md`](docs/SPEC.md)
- 実装計画:[`docs/PLAN.md`](docs/PLAN.md)
- フロント:React + Vite(TypeScript)。希望休アプリと同じ構成

## いまの状態(手順4まで)

Google でログインし、メモは Supabase に保存して、スマホと PC で同期します。
ホーム画面アプリ化は、まだありません(`docs/PLAN.md` の手順5)。

- マイクボタンで話すと、話し終わりで自動保存(直後の「取り消し」で消せる)。入力欄に文字があるときはマイクの代わりに送信ボタン
- 先頭に「やること」「アイデア」「覚えておく」「共有」などと言う(書く)と、そのカテゴリに入り、キーワードは本文から除く。
  言葉の一覧は `src/lib/parse.ts` の `KEYWORDS`
- やること・共有事項は「今日」「明日」「明後日」「11月5日」「11/5」「5日まで」から期限を自動で入れる
- 音声入力はブラウザ標準の機能(Android の Chrome など)で、電波が必要。電波がないときは文字で入力する

- 自分のメールアドレスでログインしたときだけ使えます。ほかのアカウントでは、ログインできても何も読み書きできません(DB の権限で止めています)
- 電波がないときに書いたメモは端末に「未送信」として残り、つながったら自動で送ります(画面上部に「未送信 N」と出ます)
- 端末保存版で書いていたメモは、初めてログインしたときにクラウドへ移します
- Supabase を設定していない開発環境では、これまでどおり端末保存だけで動きます

- 入力欄に書いて Enter(または ↑ ボタン)で受信箱へ。色ボタンを押すとそのカテゴリで保存
- 受信箱のカードは、色ボタン1タップで4カテゴリへ仕分け
- カードをタップで編集(本文・カテゴリ・期限・伝える相手・ピン)
- 完了/伝えた/アーカイブは消さずに「済み」へ。直後の「取り消し」で戻せる
- 間違えたメモは、編集画面(カードをタップ)の「削除」で消せる。「済み」のカードにも削除ボタン。直後の「取り消し」で戻せる
- ピンをつけたメモは上(PCでは左)のボードに表示
- 期限切れ・今日のものは一覧の上に表示
- テーマは 自動/ライト/ダーク(選んだものは端末に保存)
- 画面幅 900px 以上で PC 用の配置になります

## はじめての設定

### 1. Supabase

1. [Supabase](https://supabase.com/) で新しいプロジェクトを作る(リージョンは Tokyo がおすすめ)
2. 「SQL Editor」で `supabase/migrations/0001_init.sql` の中身を全部貼り付けて実行
3. 続けて、使うメールアドレスを登録する(小文字で)

   ```sql
   insert into public.allowed_emails values ('ここにGmailアドレス');
   ```

4. 「Project Settings → API」の **Project URL** と **anon public key**(または Publishable key)を控える

### 2. Google ログイン

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作る
2. 「API とサービス → OAuth 同意画面」:User Type は「外部」。公開ステータスは「テスト」のままでよく、
   「テストユーザー」に自分の Gmail アドレスを追加する(テスト中は、ここに入れた人しか Google のログイン画面を通れない)
3. 「認証情報 → 認証情報を作成 → OAuth クライアント ID」:種類は「ウェブ アプリケーション」。
   「承認済みのリダイレクト URI」に `https://(Project URL のドメイン)/auth/v1/callback` を入れる
4. 表示された **クライアント ID** と **クライアント シークレット** を控える
5. Supabase の「Authentication → Sign In / Providers → Google」を有効にして、4 の2つを貼り付けて保存
6. Supabase の「Authentication → URL Configuration」
   - Site URL:公開先の URL(例:`https://memoapp-xxxx.vercel.app`)
   - Redirect URLs:公開先の URL と `http://localhost:5173` を追加
7. 一度ログインできたら、「Authentication → Sign In / Providers」の「Allow new users to sign up」を
   オフにすると、ほかの人はアカウント自体を作れなくなる(任意)

### 3. Vercel

1. このリポジトリを Vercel にインポート(Framework は Vite が自動で選ばれます)
2. Environment Variables に `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` を設定してデプロイ
3. 公開された URL を、上の 2-6 の Site URL・Redirect URLs に入れる

## 開発

```bash
npm install
npm run dev         # http://localhost:5173(.env.local に Supabase の値。なければ端末保存で動く)
npm run typecheck
npm test
npm run build
supabase/tests/run_tests.sh   # DB の権限のテスト(ローカルの PostgreSQL 16。PGHOST などを設定して実行)
```

## ファイル

| 場所 | 内容 |
|---|---|
| `supabase/migrations/0001_init.sql` | テーブル・権限(自分だけが読み書きできる) |
| `supabase/tests/` | 権限のテスト |
| `src/Root.tsx` | ログインの確認と、保存先の切り替え |
| `src/lib/memoStore.ts` | 保存先の共通の形(`MemoStore`)と端末保存版 |
| `src/lib/cloudStore.ts` | クラウド保存版。未送信の箱・再送・他の端末の変更の受け取り |
| `src/lib/supabase.ts` | Supabase とのやりとり |
| `src/lib/parse.ts` | 先頭のキーワードでのカテゴリ分け、期限の読み取り |
| `src/lib/useSpeech.ts` | 音声入力(Web Speech API) |
| `src/lib/selectors.ts` | 期限の帯・ピン・タブごとの一覧の絞り込み |
| `src/lib/categories.ts` | カテゴリの名前・期限や相手の有無・終わり方 |
| `src/styles.css` | 色はすべて CSS 変数(ライト/ダークで同じ名前) |
| `src/components/` | 入力欄・カード・ピン留めボード・期限の帯・編集シートなど |
