import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { dictionaries, type Language } from "@/lib/i18n";
export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — Sumitt" },
      {
        name: "description",
        content: "Securely set a new Sumitt password using your email recovery link.",
      },
      { property: "og:title", content: "Reset your password — Sumitt" },
      { property: "og:description", content: "Return to your private financial workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPassword,
});
function ResetPassword() {
  const [lang, setLang] = useState<Language>("ja");
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const t = dictionaries[lang];
  useEffect(() => {
    const hash = window.location.hash;
    setValid(hash.includes("type=recovery"));
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setValid(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setMessage(error.message);
    else setDone(true);
  }
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <div className="mb-10 flex justify-between">
        <Link to="/" className="brand">
          Sumitt
        </Link>
        <select
          aria-label={t.language}
          value={lang}
          onChange={(e) => setLang(e.target.value as Language)}
        >
          <option value="ja">日本語</option>
          <option value="en">English</option>
          <option value="sv">Svenska</option>
        </select>
      </div>
      <h1 className="page-title">{t.reset}</h1>
      {done ? (
        <Button className="mt-6" asChild>
          <Link to="/">{t.returnOverview}</Link>
        </Button>
      ) : valid ? (
        <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-5">
          <label className="field">
            <span>{t.password}</span>
            <input
              type="password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <Button>{t.save}</Button>
          <p role="status">{message}</p>
        </form>
      ) : (
        <p className="soft-note">{t.resetInvalid}</p>
      )}
    </main>
  );
}
