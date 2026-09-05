# MORRIS — 3人の対戦室

2人がナインメンズモリスを対戦し、1人が観戦する日本語Webアプリです。

## 遊ぶ

https://morris-three-friends.uminoyeah.chatgpt.site

1. 名前を入れて部屋を作ります。
2. 「招待URLをコピー」で、同じURLをほかの2人に送ります。
3. 3人が参加したら、部屋を作った人が開始します。
4. 対局終了後、「交代して、次の対局へ」で組み合わせが交代します。

参加順で **1–2 → 2–3 → 3–1** の総当たりです。観戦者も同じ盤面を見られます。再接続には同じブラウザを使ってください。

## ルール

9個ずつ配置し、3個一直線のミルを作ると相手の駒を1個捕獲します。相手にミル外の駒がある場合、それを優先します。全配置後は隣接点に移動でき、残り3個なら任意の空き点へ飛べます。駒が2個以下、または合法手がなくなると負けです。同一盤面・手番3回、または捕獲なし50往復で引き分けます。

参考: https://www.flyordie.com/mill/rules

## 実装

- React / Vinext / Cloudflare Workers / D1 / Drizzle
- サーバーを唯一の盤面管理元とし、約1.2秒間隔で同期
- 更新番号を条件にしたSQL更新で同時操作を排他
- HttpOnly Cookieとサーバー側のハッシュで参加者を識別
- 部屋URLは推測困難なランダムID。URLを知る人が参加・閲覧可能
- 3席の小規模な友人同士の利用向け。席の強制解除、対局時計、ランキングはありません

GitHub Pages単独ではD1のAPIを実行できないため、公開アプリはSitesでホストしています。GitHubにはソースを公開しています。

## 開発

Node.js 22.13以上とpnpmが必要です。

```sh
pnpm install
pnpm db:generate
pnpm dev
pnpm build
pnpm exec tsc --noEmit
node --experimental-strip-types --test tests/game.test.ts
```

`.openai/hosting.json` はこのSitesプロジェクトの識別子と論理DBバインディングを保持しています。別のSitesに展開する場合は自分のプロジェクトIDに置き換えてください。D1には `drizzle/*.sql` のマイグレーションを適用します。ローカル開発でもテーブルの適用が必要です。

ローカルDBを用意しサーバーを起動後、`node tests/rooms.integration.mjs` で3接続の同期、観戦権限、競合制御、交代を検証できます。このテストは検証用の部屋を1つ作成します。接続先の変更は `MORRIS_TEST_URL` を指定してください。
