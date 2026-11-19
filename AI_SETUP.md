# Sumitt: Gemini document reading

## Macでの起動（日本語）

1. この最新版ZIPをダウンロードして展開します。以前の版と混ぜず、展開した `Sumitt_Demo` フォルダを使ってください。
2. Node.js 24以降を使います。ターミナルでこのフォルダへ移動します。
3. `npm ci` を実行します。
4. `bash scripts/start-ai-demo.sh` を実行します。
5. 「APIキーを貼り付けてEnter」と表示されたら、Google AI Studioで作成したキーの値を貼り付け、Enterを押します。「Default Gemini API Key」という名前ではなく、そのキーの値です。入力中は文字が表示されません。
6. ターミナルに表示された Local のURLをブラウザで開きます。
7. 「書類」で「Geminiキー設定あり」と表示されていることを確認し、AI読み取りとGoogleへの送信への同意をチェックします。
8. まず架空の請求書PDF（5ページ以内）をアップロードして、候補と読み取り根拠を確認します。

キーはチャットやGitHubに貼らないでください。このスクリプトはキーをファイルやシェル履歴に保存しません。停止するときは Ctrl+C。次回起動時に再度入力します。

### 無料で試すために

Google AI StudioでキーのプロジェクトがFree tierであり、Google Cloudの課金が有効になっていないことを確認してください。有料プランへの変更は必要ありません。SumittはGoogleの課金状態を確認・変更できないため、アプリだけでゼロ円を保証するものではありません。

使用モデルは、実装時点で無料枠が掲載されている `gemini-3.1-flash-lite` に固定しています。上限に達したら止まり、別モデルや有料プロバイダーへ自動切替せず、自動再試行もしません。枠が回復するまで待つか、手入力で続けられます。無料枠の提供条件・回数はGoogle側のアカウントや地域で異なります。

### エラーの場合

- 「AIは未接続」：通常の `npm run dev` ではキーは入りません。Ctrl+Cで停止し、上のスクリプトで再起動してください。
- 「Geminiキーが拒否」：AI Studioで正しいキーの値、プロジェクトのアクセス可否、キーのAPI制限を確認します。エラー時に課金を有効にする必要はありません。
- 「利用上限」：少し時間をおくか、手入力で続けます。日次上限の場合は翌日以降になることがあります。

## Architecture

The original app used PDF.js and fixed-label parsing, without an AI model. The optional reader now renders every PDF page and calls Google's OpenAI-compatible Gemini endpoint directly from the server. It does not use OpenAI billing or the Lovable gateway.

Server variable: `GEMINI_API_KEY`. Never use a `VITE_` prefix. The model and endpoint are fixed server-side; there are no automatic model/provider fallbacks, grounding tools, paid upgrades or billable retries. The app cannot infer your billing tier from an API key.

The API requires same-origin POSTs, explicit document consent and body/page limits. Local unauthenticated calls are allowed only in development demo mode on localhost/127.0.0.1. Hosted demo AI uses the shared-password protection described in DEPLOY_VERCEL.md; non-demo live requests still require verified sign-in. The hosted server must receive its key through its own secret settings. The local startup script does not configure a hosted site. Set GEMINI_API_KEY and SUMITT_DEMO_PASSWORD in Vercel and follow DEPLOY_VERCEL.md.

This is bounded AI extraction, not an autonomous tax-filing agent. It cannot submit tax returns, decide tax treatment, invent rates or confirm payments. Scans, handwriting and unfamiliar labels are offered as unverified candidates with original evidence. Illegible or uncertain values remain blank and require review.

## Privacy and verification

Only PDFs uploaded with AI enabled and consent checked send their filename, extracted text and page images to Google. Standard reading stays local. Check Google's applicable data-handling terms for your account and region before using real accounting documents; start the presentation with synthetic data.

Automated tests use mocked provider replies, cover authentication, limits, malformed responses, page images and uncertain fields, and do not prove handwriting accuracy. No actual user API key is included in this archive. Real API access and recognition must be checked on the user's Mac after entering their key.

References checked during implementation:
- https://ai.google.dev/gemini-api/docs/openai
- https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite
- https://ai.google.dev/gemini-api/docs/pricing

## New AI guides

- Expense review: choose Expense or Supplier invoice, then request a category suggestion. Only issuer and description are sent. Apply the suggestion explicitly, then save the document. The category is an organizational label, not a deductible expense decision or NE mapping.
- Year-end: the AI can prioritize pending checklist items. Only the year, status and counts are sent. Action buttons open the associated documents or business settings. The AI cannot complete checklist items.
- NE supplement: select a topic or field and optionally ask a question. The server supplies its curated official-guide snapshot, and the response links to the corresponding official page. Unsupported amounts, unknown source identifiers and invented numerical filing instructions are rejected. This is not a year-verified tax engine or live retrieval of the authenticated filing screen.

Each panel needs its own explicit consent and click. There are no background AI requests containing documents or questions. Descriptions and questions are untrusted context. Explanations are hidden when their input context changes. The original manual checklist and guide remain usable without a key or after a quota error. No assistant can set payment/review status, change tax amounts or submit a return. Existing categories are changed only by a user action.

Verification uses mocked Gemini replies. Actual model wording and accuracy must be checked on the user's configured Mac; no live key was available in the implementation environment.
