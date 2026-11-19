# Sumitt デモを GitHub と Vercel で公開する

この版は発表・動作確認用のデモです。Geminiの利用キーと共有パスワードをVercelに設定すると、URLから開いてAIを使えます。実際の税務申告サービスとしての検証は完了していません。

## 1. 最新版を展開する

ZIPを新しいフォルダに展開してください。`package.json` と `vercel.json` がある `Sumitt_Demo` フォルダがプロジェクトのルートです。以前の `node_modules`、`.env`、ビルド結果をコピーする必要はありません。

Node.jsは24系です。Macで確認する場合は次を実行します。

```bash
npm ci
bash scripts/start-ai-demo.sh
```

ここで入力したキーはMacでの起動用です。Vercelには別に設定します。

## 2. GitHubへソースを登録する

GitHubで新しいリポジトリを作成します。Privateで構いません。展開したフォルダ内のソースを登録してください。ZIPそのものを登録するのではありません。

ターミナルを使う場合は、ルートフォルダで次を実行します。

```bash
git init
git add .
git status
git commit -m "Prepare Sumitt presentation demo"
git branch -M main
```

次にGitHubの新規リポジトリ画面に表示される `git remote add origin ...` と `git push -u origin main` を実行します。

`.gitignore` は `.env`、`.env.local`、`node_modules`、`.vercel`、ビルド結果を除外します。`.env.example` と `.env.demo` は秘密情報を持たない設定例なので登録します。以前から `.env` を追跡しているリポジトリでは、ignoreだけで追跡は解除されません。新しいフォルダ・リポジトリを使うと分かりやすくなります。

## 3. Vercelにインポートする

1. VercelでAdd New → Projectを開き、GitHubのリポジトリを選びます。
2. Root Directoryを `package.json` がある場所にします。
3. FrameworkはTanStack Startです。自動検出された設定を使います。
4. Build Commandは `npm run build:demo`、Install Commandは `npm ci` です。`vercel.json` に設定済みです。
5. Output Directoryは手動で `dist` や `.output` に変更せず、自動設定を使います。
6. Node.jsは24系です。`package.json` のenginesでも指定済みです。

## 4. 環境変数を登録する

Vercelのプロジェクト設定のEnvironment Variablesに、次の2つをSecretとして登録します。ProductionとPreviewの両方に適用してください。

| 名前 | 値 |
| --- | --- |
| `GEMINI_API_KEY` | Google AI Studioで作成したキーの値。キーの表示名ではありません |
| `SUMITT_DEMO_PASSWORD` | 自分で決めた16文字以上のランダムな共有パスワード。英数字を使うと入力が簡単です |

キーやパスワードに `VITE_` を付けないでください。GitHubやチャットには貼り付けません。

`SUMITT_PUBLIC_DEMO=true` は `vercel.json` に設定済みです。無効にしたりパスワードを設定しなかった場合、Vercel上ではデモを開けないようにしています。Supabaseのキーはこのデモには不要です。

無料で試す場合はGoogle側がFree tierで、課金を有効にしていないことを確認します。アプリはGoogleの課金状態を判定・変更できません。無料枠を超えたら処理を止め、有料モデルへの切替や自動再試行はしません。

## 5. Deployして確認する

デプロイ後のURLを開くと、ブラウザがログインを求めます。

- ユーザー名：`demo`
- パスワード：上で設定した `SUMITT_DEMO_PASSWORD`

環境変数を後から変更した場合は、VercelでRedeployしてください。発表相手にはURLと共有パスワードを伝えます。共有パスワードを知る相手は、設定したGeminiキーの利用枠を消費できます。

確認する順番：

1. ホーム・書類・レポートが開く。
2. 書類で「Geminiキー設定あり」と表示される。
3. 架空の1ページPDFで、AI読み取りと送信への同意をチェックしてアップロードする。
4. 読み取り候補と根拠を確認する。
5. 経費カテゴリー候補、年度末の案内、NE付表の説明を試す。

デモの編集内容は各ブラウザタブのsessionStorageです。他の人の編集内容を共有するデータベースではありません。元PDFは公開保存しません。

## エラーの見方

- ブラウザのログイン画面：ユーザー名は `demo`。VercelアカウントのパスワードやGeminiキーではありません。
- `Demo access is not configured`：共有パスワードが未設定か16文字未満です。設定後Redeployします。
- AIは未接続：Vercelに `GEMINI_API_KEY` を設定し、Redeployします。
- Geminiキーが拒否：Google側のキー、APIアクセス制限、利用可能なプロジェクトを確認します。
- AIの利用上限：しばらく待つか手入力で続けます。課金を有効にする必要はありません。
- 返答が途中で切れた：PDFを分割するか質問を短くして、必要なら自分で再実行します。途中の金額は採用しません。
- 返答の形式を読めない：完全なJSON以外を拒否しています。日付・通貨・桁区切りなどの表記差は補正しますが、矛盾した金額は手入力で確認します。
- 大きなPDF：1書類5ページまで。画像を圧縮し、JSON全体が4 MBを超える場合は送信前に停止します。長いPDFは分割します。

## 確認した内容と未確認の範囲

Vercel形式のビルド出力とNode.js 24ランタイム、パスワード保護、未設定時の閉鎖、ページのSSR、AI用APIの同一オリジン制限、書類データの表記補正を確認しています。AI応答の検証には架空のモック応答を使っています。実際のVercelアカウントへのデプロイと、実キーによる認識精度はこの環境からは実行していません。

実装上の補助的なリクエスト制限はサーバーインスタンス単位です。少人数向けのパスワード付きデモ用で、不特定多数向けの利用量制御や本番会計システムではありません。
