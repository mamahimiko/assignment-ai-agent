<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI connection.** The user explicitly selected a direct Gemini API connection for this exported demo. Keep `GEMINI_API_KEY` server-side, use the fixed Google endpoint/model, and do not fall back to paid providers.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Application architecture
- Use a shared multilingual workspace shell across public content routes; private reads are session-scoped browser queries protected by RLS, so the isolated demo remains accessible without sign-in.
- Store original PDF text separately from editable document details and preserve changes with database audit triggers, so corrections remain traceable.
- Keep decimal-safe draft ledger calculations in the finance module and derive reports from that ledger; do not treat the draft clearing journal as verified tax or BAS accounting.
- Read PDF text in the browser with a dynamically imported PDF reader; scanned documents can use explicit opt-in AI vision via the server-side Google Gemini connection. Never send documents without per-session consent; preserve local extraction and treat all AI output as unverified candidates.
- Prefill explicit labelled PDF values with the browser-safe extraction module on upload and existing-document review; retain field/page sources and never replace nonempty user corrections.
- Run privileged account deletion only through an authenticated server function using the verified caller identity.
- Derive year-end checklist and NE candidate boxes in the year-end module from the draft ledger and settings; NE boxes stay labelled unverified until year-specific rules are validated.
- Keep sourced multilingual NE filing instructions separate from draft calculations, and distinguish published online section names from conceptual form sections; this prevents navigation guidance from implying validated tax amounts or future authenticated screens.
- Keep the unfinished NE calculation module isolated from the interface until its supported scenarios and saved inputs are validated; blank amounts and unsupported years must block results rather than become zero.
- Plain document saves preserve review status; the year-end unreviewed check counts only pending nonduplicates, while deferred documents stay outside the draft ledger to avoid treating postponement as accounting approval.
- Persist demo document corrections in tab-scoped session storage and restore after hydration so navigation between workspace pages does not discard saved sample reviews or mix them with private documents.
- Version demo schedule refreshes separately from saved reviews; refresh sample dates and source text once while preserving other corrections and never touching private documents.
- Reuse the document review dialog for year-end checklist document actions so corrections follow the same save and review workflow without leaving Reports.
- Determine year-end unpaid invoices from both the received-payment flag and a valid actual payment date no later than the selected year's final day; planned dates do not prove payment.
- Store fee review as an amount-and-payment-currency snapshot in document details; only matching snapshots clear the fee checklist, without posting expenses or validating tax treatment.

- For the user-requested month-end conversion option, fetch ECB rates from Frankfurter, store the requested month and actual publication date/source, keep existing manual values, and never substitute a latest rate for an unpublished future month-end. Payment status remains independent.

- AI expense categories are organizational labels requiring explicit user adoption; they do not determine VAT/deductibility/NE mappings or affect draft ledger posting. Assistant requests require separate consent and send minimal task context.
- AI closing explanations may reference only pending checks from the current snapshot. NE explanations use server-owned guide facts and exact allowlisted source links; reject invented monetary values or unknown field/source identifiers, and do not claim year-specific filing readiness.

- Public Vercel demos must use SUMITT_PUBLIC_DEMO and server-only shared-password authentication. Never deploy an unauthenticated hosted AI route. Keep static bundles free of credentials and use no-store for protected HTML/API responses.
- Keep outgoing AI JSON at or below 4 MB; never silently omit PDF pages. Normalize provider formatting only, reject conflicting values, distinguish truncated/blocked replies and never auto-retry billable calls.
