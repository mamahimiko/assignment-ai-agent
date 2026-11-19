import { useEffect, useRef, useState, createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, useRouter } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import {
  Bird,
  LayoutDashboard,
  Building2,
  Files,
  CircleCheck,
  ChartNoAxesCombined,
  Settings2,
  CircleHelp,
  ChevronRight,
  ArrowRight,
  Upload,
  FileText,
  ShieldCheck,
  Globe2,
  X,
  Plus,
  LogOut,
  Leaf,
  Info,
  Download,
  Check,
  Search,
  Clock3,
  LockKeyhole,
} from "lucide-react";
import { LovableMark } from "@lovable.dev/cloud-auth-js/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { dictionaries, type Language, type TranslationKey } from "@/lib/i18n";
import {
  emptyDetails,
  initialSettings,
  demoDocuments,
  refreshDemoSchedule,
  DEMO_SCHEDULE_VERSION,
  DEMO_OPENING,
  totals,
  conversion,
  feeReviewComplete,
  validatePdf,
  type FinancialDoc,
  type Details,
  type Settings,
} from "@/lib/finance";
import { readDemoSettings, writeDemoSettings, DEMO_SETTINGS_KEY } from "@/lib/demo-session";
import { AiUploadControls, AiEvidence } from "@/components/ai/document-ai";
import { aiCopy } from "@/lib/ai/copy";
import { readWithAi, errorCode } from "@/lib/ai/client";
import { aiCandidates, storedAiReading, type AiReading, type AiErrorCode } from "@/lib/ai/schema";
import { readPdf, downloadReport } from "@/lib/pdf";
import { extractDocument, prefillDetails } from '@/lib/document-extraction';
import { expectedPaymentDate, rateTargetDate } from '@/lib/exchange-rate';
import { DocumentRateFields } from '@/components/document-rate-fields';
import { yearEndChecklist, neGuidance, closingReady } from '@/lib/year-end';
import { ExpenseCategoryAssistant, ClosingAssistant, NeAssistant } from "@/components/ai/bookkeeping-assistant";
import { NeFilingGuide } from '@/components/ne-filing-guide';
import { neGuideCopy } from '@/lib/ne-guide-content';
import { deleteOwnAccount } from "@/lib/account.functions";
import birdImage from "@/assets/bookkeeping-bird.jpg";

type Page = "home" | "business" | "documents" | "review" | "reports" | "settings" | "help";
type WorkspaceContextValue = {
  lang: Language;
  t: (key: TranslationKey) => string;
  user: User | null;
  demo: boolean;
  docs: FinancialDoc[];
  settings: Settings;
  setSettings: (s: Settings) => void;
  saveSettings: () => Promise<void>;
  saveDoc: (doc: FinancialDoc) => Promise<void>;
  auth: () => void;
  refresh: () => Promise<void>;
};
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
function useWorkspace() {
  const c = useContext(WorkspaceContext);
  if (!c) throw new Error("Workspace unavailable");
  return c;
}
const navigation = [
  { key: "home", path: "/", icon: LayoutDashboard },
  { key: "business", path: "/business", icon: Building2 },
  { key: "documents", path: "/documents", icon: Files },
  { key: "review", path: "/review", icon: CircleCheck },
  { key: "reports", path: "/reports", icon: ChartNoAxesCombined },
] as const;
const pathSteps = ["/business", "/documents", "/review", "/reports"] as const;
export function Workspace({ page }: { page: Page }) {
  const [lang, setLang] = useState<Language>("en");
  const [user, setUser] = useState<User | null>(null);
  const [isDemo, setDemo] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [sampleDocs, setSampleDocs] = useState(demoDocuments);
  const [ready, setReady] = useState(false);
  const [demoReady, setDemoReady] = useState(false);
  const sampleDocsRef = useRef(sampleDocs);
  const demoOnly = import.meta.env["VITE_SUMITT_DEMO_ONLY"] === "true";
  const [name, setName] = useState("");
  const qc = useQueryClient();
  const router = useRouter();
  const t = (k: TranslationKey) => {
    if (isDemo && k === "demoNote") return dictionaries[lang].demoLocalNote;
    if (isDemo && k === "uploadPrivacy") return dictionaries[lang].demoLocalPrivacy;
    if (isDemo && k === "paymentRule") return "";
    return dictionaries[lang][k];
  };
  useEffect(() => {
    let active = true;
    setSettings(readDemoSettings(sessionStorage));
    setDemoReady(true);
    const stored = sessionStorage.getItem("komorebi-language");
    if (stored === "ja" || stored === "en" || stored === "sv") setLang(stored);
    try {
      const savedDemo = sessionStorage.getItem("sumitt-demo-documents");
      if (savedDemo) {
        const restored: unknown = JSON.parse(savedDemo);
        if (Array.isArray(restored) && restored.length <= 100 && restored.every((doc) => doc && typeof doc.id === "string" && doc.details && ["pending", "deferred", "confirmed"].includes(doc.details.review))) {
          const next = sessionStorage.getItem("sumitt-demo-schedule-version") === DEMO_SCHEDULE_VERSION
            ? restored : refreshDemoSchedule(restored);
          sampleDocsRef.current = next;
          setSampleDocs(next);
          sessionStorage.setItem("sumitt-demo-documents", JSON.stringify(next));
        }
      }
    } catch {
      // Keep the original demo if this tab's saved sample data cannot be read.
    }
    sessionStorage.setItem("sumitt-demo-schedule-version", DEMO_SCHEDULE_VERSION);
    if (demoOnly) {
      setReady(true);
      return () => { active = false; };
    }
    supabase.auth.getUser().then(({ data }) => {
      if (active) {
        setUser(data.user);
        setReady(true);
        if (!data.user) setDemo(true);
        else
          void supabase.from("documents").select("id", { count: "exact", head: true }).then(({ count }) => {
            // Show the demo to signed-in users whose private workspace is still empty.
            if (active) setDemo(!count);
          });
      }
    }).catch(() => { if (active) { setReady(true); setDemo(true); } });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].includes(event)) return;
      setUser(session?.user ?? null);
      setDemo(!session?.user);
      setAuthOpen(false);
      router.invalidate();
      if (event !== "SIGNED_OUT") qc.invalidateQueries();
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [qc, router, demoOnly]);
  useEffect(() => {
    if (isDemo && demoReady) writeDemoSettings(sessionStorage, settings);
  }, [settings, isDemo, demoReady]);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const workspaceQuery = useQuery({
    queryKey: ["workspace", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [w, p] = await Promise.all([
        supabase.from("workspaces").select("settings").maybeSingle(),
        supabase.from("profiles").select("language,display_name").maybeSingle(),
      ]);
      if (w.error || p.error) throw w.error || p.error;
      return { settings: w.data?.settings, profile: p.data };
    },
  });
  const docsQuery = useQuery({
    queryKey: ["documents", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []).map((d) => ({
        ...d,
        details: { ...emptyDetails, ...(d.details as unknown as Details) },
        original: d.original as Record<string, unknown>,
      })) as FinancialDoc[];
    },
  });
  useEffect(() => {
    const data = workspaceQuery.data;
    if (!data) return;
    if (data.settings && typeof data.settings === "object")
      setSettings({ ...initialSettings, ...(data.settings as unknown as Settings) });
    const p = data.profile;
    if (p) {
      setName(p.display_name);
      if (p.language === "ja" || p.language === "en" || p.language === "sv") setLang(p.language);
    }
  }, [workspaceQuery.data]);
  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["documents", user?.id] });
  }
  async function saveSettings() {
    if (isDemo) {
      writeDemoSettings(sessionStorage, settings);
      toast.success(t("savedToast"));
      return;
    }
    if (!user) {
      setAuthOpen(true);
      return;
    }
    const { error } = await supabase
      .from("workspaces")
      .upsert({
        user_id: user.id,
        settings: JSON.parse(JSON.stringify(settings)),
        updated_at: new Date().toISOString(),
      });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("savedToast"));
  }
  async function saveDoc(doc: FinancialDoc) {
    if (isDemo) {
      const current = sampleDocsRef.current;
      const next = current.some(d => d.id === doc.id) ? current.map((d) => (d.id === doc.id ? doc : d)) : [...current, doc];
      sampleDocsRef.current = next;
      sessionStorage.setItem("sumitt-demo-documents", JSON.stringify(next));
      setSampleDocs(next);
      toast.success(t("savedToast"));
      return;
    }
    const { error } = await supabase
      .from("documents")
      .update({ details: JSON.parse(JSON.stringify(doc.details)), status: doc.status })
      .eq("id", doc.id);
    if (error) throw error;
    await refresh();
    toast.success(t("savedToast"));
  }
  async function changeLanguage(next: Language) {
    setLang(next);
    sessionStorage.setItem("komorebi-language", next);
    if (user) {
      const { error } = await supabase
        .from("profiles")
        .update({ language: next })
        .eq("id", user.id);
      if (error) toast.error(error.message);
    }
  }
  function resetDemo() {
    const next = demoDocuments();
    sampleDocsRef.current = next;
    setSampleDocs(next);
    setSettings(structuredClone(initialSettings));
    sessionStorage.removeItem(DEMO_SETTINGS_KEY);
    sessionStorage.setItem("sumitt-demo-documents", JSON.stringify(next));
    toast.success(lang === "ja" ? "デモを最初の状態に戻しました" : lang === "sv" ? "Demon har återställts" : "Demo reset to the starting state");
  }
  const allDocs = isDemo ? sampleDocs : (docsQuery.data ?? []);
  const docs = allDocs.filter((d) => d.year === settings.year);
  const c: WorkspaceContextValue = {
    lang,
    t,
    user,
    demo: isDemo,
    docs,
    settings: isDemo && !settings.opening.trim() ? { ...settings, opening: DEMO_OPENING } : settings,
    setSettings,
    saveSettings,
    saveDoc,
    auth: () => demoOnly ? toast.info(t("demoNote")) : setAuthOpen(true),
    refresh,
  };
  return (
    <WorkspaceContext.Provider value={c}>
      <div className="app-shell" data-workspace-ready={demoReady ? "true" : "false"}>
        <header className="app-header">
          <Link to="/" className="brand">
            <span className="brand-mark">
              <Bird size={26} />
            </span>
            <span>
              Sumitt
              <span className="hidden text-[10px] font-medium text-muted-foreground sm:block">
                {t("companion")}
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs">
              <Globe2 size={16} />
              <select
                aria-label={t("language")}
                value={lang}
                onChange={(e) => void changeLanguage(e.target.value as Language)}
                className="bg-transparent py-2 outline-none"
              >
                <option value="ja">日本語</option>
                <option value="en">English</option>
                <option value="sv">Svenska</option>
              </select>
            </label>
            {demoOnly ? <span className="status-pill confirmed">{t("demo")}</span> : user ? (
              <Button
                variant="ghost"
                size="icon"
                title={t("signOut")}
                aria-label={t("signOut")}
                onClick={() => void supabase.auth.signOut()}
              >
                <LogOut />
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setAuthOpen(true)}>
                {t("signIn")}
              </Button>
            )}
          </div>
        </header>
        <div className="workspace-layout">
          <aside className="side-nav">
            <p className="nav-caption">{t("workspace")}</p>
            {navigation.map((n) => (
              <Button
                key={n.key}
                variant={page === n.key ? "secondary" : "ghost"}
                className="nav-item"
                asChild
              >
                <Link to={n.path}>
                  <n.icon size={18} />
                  <span>{t(n.key)}</span>
                  {n.key === "review" && docs.some((d) => d.details.review === "pending") && (
                    <span className="ml-auto hidden h-5 min-w-5 rounded-full bg-peach px-1 text-center text-[10px] leading-5 sm:block">
                      {docs.filter((d) => d.details.review === "pending").length}
                    </span>
                  )}
                </Link>
              </Button>
            ))}
            <div className="nav-divider my-4 border-t border-border" />
            <Button
              variant={page === "settings" ? "secondary" : "ghost"}
              className="nav-item"
              asChild
            >
              <Link to="/settings">
                <Settings2 />
                {t("settings")}
              </Link>
            </Button>
            <Button variant={page === "help" ? "secondary" : "ghost"} className="nav-item" asChild>
              <Link to="/help">
                <CircleHelp />
                {t("help")}
              </Link>
            </Button>
            <div className="nav-footer">
              <div className="rounded-xl bg-sage p-4">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <Leaf size={16} />
                  {isDemo ? t("demoWorkspace") : t("liveWorkspace")}
                </div>
                <p className="mt-2 text-[11px] leading-6 text-muted-foreground">
                  {isDemo ? t("demoNote") : t("saved")}
                </p>
                {!demoOnly && <Button
                  variant="link"
                  className="h-auto px-0 pt-2 text-xs"
                  onClick={() => (user ? setDemo(!isDemo) : setAuthOpen(true))}
                >
                  {isDemo ? t("switchLive") : t("switchDemo")}
                  <ArrowRight />
                </Button>}
              </div>
              {isDemo && <Button variant="outline" className="mt-3 w-full text-xs" onClick={resetDemo}>
                {lang === "ja" ? "デモをリセット" : lang === "sv" ? "Återställ demo" : "Reset demo"}
              </Button>}
              <p className="mt-6 flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                <LockKeyhole size={11} />
                {t("privacy")}
              </p>
            </div>
          </aside>
          <main className="main-content">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="eyebrow">
                <Leaf size={14} />
                {isDemo ? t("demoWorkspace") : name || t("liveWorkspace")}
                <span className="mx-1">/</span>
                {t(page)}
              </p>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">
                  {t("year")}{" "}
                  <select
                    aria-label={t("year")}
                    value={settings.year}
                    onChange={(e) => setSettings({ ...settings, year: Number(e.target.value) })}
                    className="ml-1 rounded-md border border-border bg-card px-2 py-1.5 text-foreground"
                  >
                    {[2024, 2025, 2026, 2027].map((y) => (
                      <option key={y}>{y}</option>
                    ))}
                  </select>
                </label>
                {isDemo && <span className="status-pill confirmed">{t("demo")}</span>}
              </div>
            </div>
            {page === "home" ? (
              <Overview />
            ) : (
              <>
                <h1 className="page-title">{t(page)}</h1>
                <p className="page-subtitle">
                  {t(
                    page === "business"
                      ? "businessIntro"
                      : page === "documents"
                        ? "dropText"
                        : page === "review"
                          ? "reviewIntro"
                          : page === "reports"
                            ? "reportIntro"
                            : page === "help"
                              ? "helpSubtitle"
                              : "saved",
                  )}
                </p>
                {["business", "documents", "review", "reports"].includes(page) && (
                  <Workflow active={["business", "documents", "review", "reports"].indexOf(page)} />
                )}
                <div className="mt-6">
                  {page === "business" ? (
                    <Business />
                  ) : page === "documents" ? (
                    <Documents />
                  ) : page === "review" ? (
                    <Review />
                  ) : page === "reports" ? (
                    <Reports />
                  ) : page === "settings" ? (
                    <Preferences name={name} setName={setName} />
                  ) : (
                    <Help />
                  )}
                </div>
              </>
            )}
            {(workspaceQuery.error || docsQuery.error) && (
              <p role="alert" className="soft-note">
                {t("error")}
              </p>
            )}
            <footer className="mt-10 flex items-center gap-2 border-t border-border pt-5 text-[11px] text-muted-foreground">
              <ShieldCheck size={14} />
              {isDemo ? t("demoNote") : ready ? t("saved") : t("loading")}
            </footer>
          </main>
        </div>
      </div>
      {authOpen && <AuthDialog close={() => setAuthOpen(false)} />}
    </WorkspaceContext.Provider>
  );
}
function Workflow({ active }: { active: number }) {
  const { t } = useWorkspace();
  return (
    <nav className="workflow" aria-label="Workflow">
      {pathSteps.map((path, i) => (
        <Link to={path} key={path} className={`workflow-step ${i === active ? "active" : ""}`}>
          <span className="step-number">{i < active ? <Check size={14} /> : i + 1}</span>
          <span>{t((["step1", "step2", "step3", "step4"] as const)[i] ?? "step1")}</span>
        </Link>
      ))}
    </nav>
  );
}
function Overview() {
  const { t, docs, demo } = useWorkspace();
  const pending = docs.filter((d) => d.details.review !== "confirmed");
  return (
    <>
      <h1 className="page-title">{t("greeting")}</h1>
      <p className="page-subtitle">{t("intro")}</p>
      <Workflow active={1} />
      <section className="welcome-band">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-medium text-primary">
            <Leaf size={14} />
            Sumitt
          </p>
          <h2>{t("welcome")}</h2>
          <p className="mt-2 text-xs leading-7 text-muted-foreground">{t("welcomeText")}</p>
          <Button size="lg" className="mt-4" asChild>
            <Link to="/documents">
              <Upload />
              {t("upload")}
              <ArrowRight />
            </Link>
          </Button>
        </div>
        <img
          src={birdImage}
          width={1024}
          height={768}
          alt="A little bird beside a stack of documents"
        />
      </section>
      <div className="summary-grid">
        {[
          {
            label: "docCount" as const,
            count: docs.length,
            unit: "documentsUnit" as const,
            icon: Files,
            color: "bg-sage",
          },
          {
            label: "needReview" as const,
            count: pending.length,
            unit: "questionsUnit" as const,
            icon: CircleHelp,
            color: "bg-peach",
          },
          {
            label: "confirmed" as const,
            count: docs.length - pending.length,
            unit: "documentsUnit" as const,
            icon: CircleCheck,
            color: "bg-lilac",
          },
        ].map((s) => (
          <div className="summary-card" key={s.label}>
            <div className="flex items-center justify-between gap-1">
              <p className="text-xs text-muted-foreground">{t(s.label)}</p>
              <span className={`icon-tile ${s.color}`}>
                <s.icon size={18} />
              </span>
            </div>
            <p className="stat">
              {s.count}
              <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                {t(s.unit)}
              </span>
            </p>
          </div>
        ))}
      </div>
      <div className="section-heading">
        <h2>{t("recent")}</h2>
        <Button variant="link" asChild>
          <Link to="/documents">
            {t("viewAll")}
            <ChevronRight />
          </Link>
        </Button>
      </div>
      <DocumentRows docs={docs.slice(0, 3)} />
      <div className="soft-note">
        <span className="mt-1">
          <Leaf size={18} />
        </span>
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold">{t("next")}</h3>
            <p>{t("nextText")}</p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/review">
              {t("startReview")}
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
      <p className="mt-5 flex gap-2 text-[11px] leading-6 text-muted-foreground">
        <ShieldCheck className="mt-1 shrink-0" size={14} />
        {t("draftNote")}
      </p>
    </>
  );
}
function Field({ label, children, required }: { label: string; children: ReactNode; required?: boolean }) {
  return (
    <label className="field">
      <span className="font-semibold">{label}{required && <span className="text-destructive" aria-hidden="true"> *</span>}</span>
      {children}
    </label>
  );
}
function Business() {
  const { t, settings: s, setSettings, saveSettings } = useWorkspace();
  const update = (key: keyof Settings, value: unknown) => setSettings({ ...s, [key]: value });
  return (
    <>
      <p className="soft-note mt-0">
        <Info size={18} className="shrink-0" />
        {t("scope")}
      </p>
      <section className="form-section">
        <div className="form-grid">
          <Field label={t("method")}>
            <select value={s.method} onChange={(e) => update("method", e.target.value)}>
              {["unsure", "cash", "accrual"].map((k) => (
                <option key={k} value={k}>
                  {t(k as TranslationKey)}
                </option>
              ))}
            </select>
            <small className="leading-6 text-muted-foreground">{t("methodHint")}</small>
          </Field>
          <Field label={t("vat")}>
            <select value={s.vat} onChange={(e) => update("vat", e.target.value)}>
              {["unsure", "registered", "notRegistered"].map((k) => (
                <option key={k} value={k}>
                  {t(k as TranslationKey)}
                </option>
              ))}
            </select>
          </Field>
          {s.vat === "registered" && (
            <>
              <Field label={t("frequency")}>
                <select value={s.frequency} onChange={(e) => update("frequency", e.target.value)}>
                  {["yearly", "quarterly", "monthly"].map((k) => (
                    <option key={k} value={k}>
                      {t(k as TranslationKey)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("period")}>
                <input value={s.period} onChange={(e) => update("period", e.target.value)} />
              </Field>
            </>
          )}
        </div>
      </section>
      <section className="form-section">
        <h3>{t("accounts")}</h3>
        {s.accounts.map((a, i) => (
          <div
            key={a.id}
            className="mb-4 grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_1fr_1fr_auto]"
          >
            <Field label={t("accountName")}>
              <input
                value={a.name}
                onChange={(e) =>
                  update(
                    "accounts",
                    s.accounts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                  )
                }
              />
            </Field>
            <Field label={t("accountType")}>
              <select
                value={a.type}
                onChange={(e) =>
                  update(
                    "accounts",
                    s.accounts.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)),
                  )
                }
              >
                {["swedishBank", "japaneseBank", "paymentService", "other"].map((k) => (
                  <option key={k} value={k}>
                    {t(k as TranslationKey)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("accountCurrencies")}>
              <input
                value={a.currencies}
                onChange={(e) =>
                  update(
                    "accounts",
                    s.accounts.map((x, j) =>
                      j === i ? { ...x, currencies: e.target.value.toUpperCase() } : x,
                    ),
                  )
                }
              />
            </Field>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("remove")}
              onClick={() =>
                update(
                  "accounts",
                  s.accounts.filter((x) => x.id !== a.id),
                )
              }
            >
              <X />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          onClick={() =>
            update("accounts", [
              ...s.accounts,
              { id: crypto.randomUUID(), name: "", type: "swedishBank", currencies: "SEK" },
            ])
          }
        >
          <Plus />
          {t("addAccount")}
        </Button>
        <div className="mt-6">
          <Field label={t("currencies")}>
            <input
              value={s.currencies.join(", ")}
              onChange={(e) =>
                update(
                  "currencies",
                  e.target.value
                    .toUpperCase()
                    .split(",")
                    .map((x) => x.trim()),
                )
              }
            />
          </Field>
        </div>
      </section>
      <section className="form-section">
        <div className="form-grid">
          <Field label={t("prior")}>
            <select value={s.previous} onChange={(e) => update("previous", e.target.value)}>
              {["available", "partial", "unavailable", "started"].map((k) => (
                <option key={k} value={k}>
                  {t(k as TranslationKey)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("opening")}>
            <textarea
              rows={3}
              value={s.opening}
              onChange={(e) => update("opening", e.target.value)}
            />
            <small className="leading-6 text-muted-foreground">{t("openingHint")}</small>
          </Field>
        </div>
      </section>
      <div className="mt-6 flex justify-between gap-3">
        <Button variant="outline" onClick={() => void saveSettings()}>
          {t("save")}
        </Button>
        <Button asChild size="lg">
          <Link to="/documents">
            {t("step2")}
            <ArrowRight />
          </Link>
        </Button>
      </div>
    </>
  );
}
function DocumentRows({
  docs,
  onOpen,
  selected,
  onSelect,
}: {
  docs: FinancialDoc[];
  onOpen?: (d: FinancialDoc) => void;
  selected?: string[];
  onSelect?: (id: string) => void;
}) {
  const { t } = useWorkspace();
  return (
    <div className="document-list">
      {docs.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        docs.map((doc) => (
          <div className="document-row" key={doc.id}>
            {onSelect && doc.details.type === "sales" && (
              <input
                type="checkbox"
                aria-label={doc.name}
                checked={selected?.includes(doc.id) ?? false}
                onChange={() => onSelect(doc.id)}
                className="size-4 accent-primary"
              />
            )}
            <span
              className={`icon-tile shrink-0 ${doc.details.type === "expense" ? "bg-lilac" : doc.details.type === "bank" ? "bg-sage" : "bg-peach"}`}
            >
              <FileText size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="document-name">{doc.name}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t(doc.details.type)}
                {doc.details.issuer && ` · ${doc.details.issuer}`}
              </p>
            </div>
            <span
              className={`status-pill ${doc.details.review === "confirmed" ? "confirmed" : ""}`}
            >
              {doc.details.review === "confirmed" ? <Check size={12} /> : <Clock3 size={12} />}{" "}
              {t(
                doc.details.duplicate
                  ? "duplicate"
                  : doc.details.review === "confirmed"
                    ? "confirmed"
                    : doc.details.review === "deferred"
                      ? "deferred"
                      : "pending",
              )}
            </span>
            {onOpen ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${t("review")} ${doc.name}`}
                onClick={() => onOpen(doc)}
              >
                <ChevronRight />
              </Button>
            ) : (
              <Button variant="ghost" size="icon" asChild aria-label={t("review")}>
                <Link to="/review">
                  <ChevronRight />
                </Link>
              </Button>
            )}
          </div>
        ))
      )}
    </div>
  );
}
function Documents() {
  const { t, lang, user, demo, docs, settings, refresh, auth, saveDoc } = useWorkspace();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [processing, setProcessing] = useState("");
  const [open, setOpen] = useState<FinancialDoc | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulk, setBulk] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [aiEnabled,setAiEnabled] = useState(false);
  const [aiConsent,setAiConsent] = useState(false);
  const [aiReady,setAiReady] = useState(false);
  const a=aiCopy[lang];
  async function upload(files: FileList | File[] | null) {
    if (!files) return;
    if (aiEnabled && (!aiReady || !aiConsent)) { toast.error(aiReady?a.errors.consent_required:a.errors.not_configured); return; }
    if (!user && !demo) {
      toast.info(t("demoUpload"));
      auth();
      return;
    }
    const localHashes = new Set(docs.map(d => d.file_hash));
    for (const file of Array.from(files)) {
      try {
        setProcessing(`${t("uploading")} ${file.name}`);
        const buffer = await file.arrayBuffer();
        const header = new TextDecoder().decode(buffer.slice(0, 8));
        const validation = validatePdf(file.name, file.size, header);
        if (validation) {
          toast.error(t(validation));
          continue;
        }
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        setProcessing(t("processing"));
        let localText="",pages=0;
        try { const local=await readPdf(buffer.slice(0));localText=local.text;pages=local.pages; }
        catch(error) { if(!aiEnabled) throw error; }
        let ai:AiReading|null=null, aiError:AiErrorCode|undefined;
        if(aiEnabled){
          try{
            const token=!demo&&user?(await supabase.auth.getSession()).data.session?.access_token:undefined;
            ai=await readWithAi(buffer.slice(0),file.name,localText,token,stage=>setProcessing(a[stage]));
          }catch(error){aiError=errorCode(error);toast.error(a.errors[aiError]);}
        }
        const text=ai?.result.transcription.trim()?ai.result.transcription:localText;
        const extraction=extractDocument(text,file.name);
        const fields={...extraction.fields,...(ai?aiCandidates(ai.result):{})};
        // Ambiguous AI fields must not be replaced by a label-based guess.
        if(ai) for(const field of ai.result.fields) if(field.value===null||field.confidence==='low') delete fields[field.field];
        const details={...emptyDetails,currency:'',paymentCurrency:'',...fields,originalText:text,duplicate:localHashes.has(hash)};
        const original={text:localText,localText,pages:pages||undefined,extraction:extraction.version,fields:extraction.fields,sources:extraction.sources,confidence:'review_required',...(ai?{ai}:{}),...(aiError?{aiError}:{})};
        if (demo) {
          const id = `demo-upload-${crypto.randomUUID()}`;
          await saveDoc({ id, name: file.name, year: settings.year, status: "needs_information", storage_path: "", file_hash: hash, details, original });
          localHashes.add(hash);
          if (!text.replace(/\[Page \d+\]/g, "").trim()) toast.info(t("scanned"));
          toast.success(t("uploadSuccess"));
          continue;
        }
        if (!user) continue;
        const { data: duplicates } = await supabase
          .from("documents")
          .select("id")
          .eq("file_hash", hash);
        const id = crypto.randomUUID();
        const path = `${user.id}/${id}.pdf`;
        const { error: upError } = await supabase.storage
          .from("financial-documents")
          .upload(path, file, { contentType: "application/pdf" });
        if (upError) throw upError;
        details.duplicate=!!duplicates?.length;
        const status='needs_information';
        const { error } = await supabase
          .from("documents")
          .insert({
            id,
            user_id: user.id,
            name: file.name,
            storage_path: path,
            file_hash: hash,
            year: settings.year,
            status,
            details: JSON.parse(JSON.stringify(details)),
            original: JSON.parse(JSON.stringify(original)),
          });
        if (error) {
          await supabase.storage.from("financial-documents").remove([path]);
          throw error;
        }
        toast.success(t("uploadSuccess"));
        await refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("error"));
      } finally {
        setProcessing("");
      }
    }
  }
  return (
    <>
      <AiUploadControls lang={lang} enabled={aiEnabled} consent={aiConsent} busy={!!processing} onEnabled={setAiEnabled} onConsent={setAiConsent} onReady={setAiReady}/>
      <div
        className="upload-zone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void upload(e.dataTransfer.files);
        }}
      >
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-sage text-primary">
          <Upload size={25} />
        </div>
        <h2 className="text-xl font-bold">{t("dropTitle")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("dropText")}</p>
        <input
          type="file"
          ref={fileRef}
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            void upload(e.target.files);
            e.target.value = "";
          }}
        />
        <Button
          size="lg"
          className="mt-5"
          disabled={!!processing || (aiEnabled && (!aiReady || !aiConsent))}
          onClick={() => fileRef.current?.click()}
        >
          <Plus />
          {t("browse")}
        </Button>
        <p className="mt-4 text-xs text-muted-foreground">{processing || t("uploadHint")}</p>
      </div>
      <p className="mt-4 flex items-start gap-2 text-xs leading-6 text-muted-foreground">
        <ShieldCheck size={16} className="mt-1 shrink-0" />
        {t("uploadPrivacy")}
      </p>
      <p className="soft-note">
        <Info size={18} className="shrink-0" />
        {t("extractionStatus")}
      </p>
      <div className="section-heading">
        <h2>
          {t("all")}{" "}
          <span className="ml-2 text-sm font-normal text-muted-foreground">{docs.length}</span>
        </h2>
        <Button variant="outline" disabled={!selected.length} onClick={() => setBulk(true)}>
          {t("bulk")} {selected.length > 0 && `(${selected.length})`}
        </Button>
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="field min-w-0 flex-1">
          <input
            aria-label={t("search")}
            placeholder={t("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="field">
          <select aria-label={t("type")} value={filter} onChange={(e) => setFilter(e.target.value)}>
            {["all", "sales", "expense", "bank", "other"].map((k) => (
              <option key={k} value={k}>
                {t(k as TranslationKey)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <DocumentRows
        docs={docs.filter(
          (d) =>
            (filter === "all" || d.details.type === filter) &&
            `${d.name} ${d.details.issuer}`.toLowerCase().includes(search.toLowerCase()),
        )}
        onOpen={setOpen}
        selected={selected}
        onSelect={(id) =>
          setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
        }
      />
      {open && <ReviewDialog doc={open} close={() => setOpen(null)} />}{" "}
      {bulk && (
        <BulkDialog
          selected={selected}
          close={() => {
            setBulk(false);
            setSelected([]);
          }}
        />
      )}
    </>
  );
}
function Review() {
  const { t, docs } = useWorkspace();
  const [open, setOpen] = useState<FinancialDoc | null>(null);
  const [filter, setFilter] = useState("pending");
  const list = docs.filter((d) => d.details.review === filter);
  return (
    <>
      <div className="mb-5 flex flex-wrap gap-2">
        {["pending", "deferred", "confirmed"].map((k) => (
          <Button
            key={k}
            variant={filter === k ? "secondary" : "outline"}
            onClick={() => setFilter(k)}
          >
            {t(k as TranslationKey)} · {docs.filter((d) => d.details.review === k).length}
          </Button>
        ))}
      </div>
      <DocumentRows docs={list} onOpen={setOpen} />
      <div className="soft-note">
        <CircleHelp className="shrink-0" size={18} />
        {t("reviewWhy")}
      </div>
      {open && <ReviewDialog doc={open} close={() => setOpen(null)} />}
    </>
  );
}
function ReviewDialog({ doc, close }: { doc: FinancialDoc; close: () => void }) {
  const { t, lang, demo, docs, settings, saveDoc } = useWorkspace();
  const countryName = (c: string) => { try { return `${new Intl.DisplayNames([t("localeCode")], { type: "region" }).of(c) ?? c} (${c})`; } catch { return c; } };
  const sourceText = doc.details.originalText || (typeof doc.original['text'] === 'string' ? doc.original['text'] : '');
  const extraction = extractDocument(sourceText, doc.name);
  const [d, setD] = useState<Details>(() => {
    const p = storedAiReading(doc.original) ? { ...doc.details } : prefillDetails(doc.details, sourceText, doc.name);
    return !p.paymentDate && p.invoiceDate && p.type === "sales" ? { ...p, paymentDate: expectedPaymentDate(p.invoiceDate) } : p;
  });
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [earlier, setEarlier] = useState(false);
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    async function load() {
      if (demo) {
        // Show the fictional source in readable Unicode, without a font-dependent PDF viewer.
        if (active) setUrl("");
      } else {
        const { data, error } = await supabase.storage
          .from("financial-documents")
          .createSignedUrl(doc.storage_path, 300);
        if (error) toast.error(error.message);
        if (active) setUrl(data?.signedUrl ?? "");
      }
    }
    void load();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc, demo]);
  const change = (key: keyof Details, value: unknown) =>
    setD((prev) => ({ ...prev, [key]: value, ...(key === "currency" || (key === "paymentDate" && prev.rateBasis !== "monthEnd") ? {rate:"",rateDate:"",rateSource:""} : {}) }));
  const converted = conversion(d);
  async function save(review: Details["review"]) {
    if (review === "confirmed" && d.rateDate && d.rateDate < rateTargetDate(d) && !earlier) {
      toast.error(t("dateMismatch"));
      return;
    }
    setSaving(true);
    try {
      await saveDoc({
        ...doc,
        details: { ...d, review },
        status: review === "confirmed" ? "confirmed" : "needs_information",
      });
      close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setSaving(false);
    }
  }
  const requiredKeys: (keyof Details)[] = ["invoiceDate", "paymentDate", "currency", "total", "rate", "rateDate", "rateSource"];
  const stringField = (key: keyof Details, label: TranslationKey, type = "text") => (
    <Field key={key} label={t(label)} required={requiredKeys.includes(key)}>
      <input aria-label={t(label)} required={requiredKeys.includes(key)} type={type} value={String(d[key])} onChange={(e) => change(key, e.target.value)} />
      {extraction.sources[key] && <small className="text-[11px] leading-5 text-muted-foreground">{t('page')} {extraction.sources[key]?.page} · {t('pending')} · {extraction.sources[key]?.text}</small>}
    </Field>
  );
  return (
    <div className="dialog-overlay">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={t("review")}
        className="dialog-panel review-dialog"
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{t("review")}</p>
            <h2 className="mt-1 break-all text-lg font-bold">{doc.name}</h2>
          </div>
          <Button size="icon" variant="ghost" aria-label={t("back")} onClick={close}>
            <X />
          </Button>
        </div>
        <div className="review-layout">
          <div>
            <p className="mb-3 text-sm font-bold">
              {storedAiReading(doc.original) ? (lang==='ja'?'AI文字起こし（要確認）':lang==='sv'?'AI-transkription (granska)':'AI transcription (review required)') : t("preview")} {demo && <span className="status-pill">{t("demo")}</span>}
            </p>
            {demo ? (
              <div className="pdf-preview overflow-auto bg-white p-6 text-foreground">
                <p className="mb-5 text-xs font-semibold text-muted-foreground">{t("demo")} · {t("original")}</p>
                <h3 className="mb-5 break-all text-base font-bold">{doc.name}</h3>
                <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-8">{sourceText}</pre>
              </div>
            ) : url ? (
              <iframe title={t("preview")} src={url} className="pdf-preview" />
            ) : (
              <p className="pdf-preview p-8">{t("loading")}</p>
            )}
            <Field label={t("original")}>
              <textarea rows={7} value={d.originalText} readOnly />
            </Field>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">{t("sourceNote")}</p>
            {url && (
              <Button variant="link" asChild>
                <a href={url} target="_blank" rel="noreferrer" download={doc.name}>
                  <Download />
                  {t("downloadPdf")}
                </a>
              </Button>
            )}
          </div>
          <div className="space-y-5">
            <AiEvidence lang={lang} original={doc.original}/>
            {(d.type === "expense" || d.type === "supplier") && <ExpenseCategoryAssistant details={d} onChange={setD} lang={lang} demo={demo}/>}
            <div className="form-grid">
              <Field label={t("type")} required>
                <select value={d.type} onChange={(e) => change("type", e.target.value)}>
                  {["sales", "expense", "supplier", "bank", "previous", "tax", "other"].map((k) => (
                    <option key={k} value={k}>
                      {t(k as TranslationKey)}
                    </option>
                  ))}
                </select>
              </Field>
              {stringField("issuer", "issuer")}
              {stringField("number", "number")}
              <Field label={t("invoiceDate")} required>
                <input aria-label={t("invoiceDate")} type="date" value={d.invoiceDate} onChange={(e) => { const v = e.target.value; setD((prev) => ({ ...prev, invoiceDate: v, ...(!prev.paymentDate && prev.type === "sales" && v ? { paymentDate: expectedPaymentDate(v) } : {}), ...(prev.rateBasis === "monthEnd" ? { rateMonth: v.slice(0,7), rate: "", rateDate: "", rateSource: "" } : {}) })); }} />
                {extraction.sources.invoiceDate && <small className="text-[11px] leading-5 text-muted-foreground">{t('page')} {extraction.sources.invoiceDate?.page} · {t('pending')} · {extraction.sources.invoiceDate?.text}</small>}
              </Field>
              {stringField("dueDate", "dueDate", "date")}
              {stringField("paymentDate", "paymentDate", "date")}
              {stringField("currency", "currency")}
              {stringField("total", "total")}
              {stringField("tax", "taxAmount")}
              {stringField("withholding", "withholding")}
              {stringField("fee", "fee")}
              {d.type === "sales" && d.fee.trim() !== "" && d.fee !== "0" && (
                <div className="space-y-2">
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={feeReviewComplete(d)}
                      onChange={(e) => change("feeReview", e.target.checked ? { amount: d.fee, currency: d.paymentCurrency } : undefined)}
                    />
                    {t("feeReviewed")}
                  </label>
                  <p className="text-xs leading-6 text-muted-foreground">{t("feeReviewNote")}</p>
                </div>
              )}
              {stringField("received", "received")}
              {stringField("paymentCurrency", "paymentCurrency")}
              <Field label={t("account")}>
                <select value={d.account} onChange={(e) => change("account", e.target.value)}>
                  <option value="">{t("unsure")}</option>
                  {settings.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("country")}>
                <select value={d.country} onChange={(e) => change("country", e.target.value)}>
                  <option value="">{t("unsure")}</option>
                  {[...new Set(["JP", "SE", "DE", "US", "GB", "FR", "FI", "NO", "DK", "NL", "ES", "IT", "CA", "AU", "CN", "KR", d.country].filter(Boolean))].map((c) => (
                    <option key={c} value={c}>{countryName(c)}</option>
                  ))}
                </select>
              </Field>
              <Field label={t("customerType")}>
                <select
                  value={d.customerType}
                  onChange={(e) => change("customerType", e.target.value)}
                >
                  {["unsure", "businessCustomer", "individual"].map((k) => (
                    <option key={k} value={k}>
                      {t(k as TranslationKey)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {stringField("description", "description")}
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={d.paid}
                onChange={(e) => change("paid", e.target.checked)}
              />
              {t("paid")}
            </label>
            <Field label={t("businessUse")}>
              <select value={d.businessUse} onChange={(e) => change("businessUse", e.target.value)}>
                {["unsure", "yes", "no"].map((k) => (
                  <option key={k} value={k}>
                    {t(k as TranslationKey)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("match")}>
              <select value={d.matchId} onChange={(e) => change("matchId", e.target.value)}>
                <option value="">{t("noMatch")}</option>
                {docs
                  .filter(
                    (x) => x.id !== doc.id && x.details.type === "sales" && !x.details.matchId,
                  )
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
              </select>
              <small className="leading-6 text-muted-foreground">{t("matchHint")}</small>
            </Field>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={d.duplicate}
                onChange={(e) => change("duplicate", e.target.checked)}
              />
              {t("duplicate")}
            </label>
            <div className="border-t border-border pt-5">
              <h3 className="mb-4 text-base font-bold">{t("conversion")}</h3>
              <DocumentRateFields details={d} onChange={setD} lang={lang}/>
              {d.rateDate && d.rateDate < rateTargetDate(d) && (
                <label className="mt-3 flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={earlier}
                    onChange={(e) => setEarlier(e.target.checked)}
                  />
                  {t("confirmEarlier")}
                </label>
              )}
              <div className="soft-note">
                {converted ? (
                  <div>
                    <p>
                      {d.total} {d.currency} × {d.rate} = <strong>{converted} SEK</strong>
                    </p>
                    <p>
                      {t("paymentDate")}: {d.paymentDate} · {t("rateDate")}: {d.rateDate}
                    </p>
                    <p>
                      {d.rateSource}
                    </p>
                  </div>
                ) : (
                  t("noConversion")
                )}
              </div>
            </div>
            <div className="soft-note">{t("taxWarning")}</div>
            <div className="flex flex-wrap gap-3">
              <Button disabled={saving} onClick={() => void save("confirmed")}>
                <Check />
                {t("confirm")}
              </Button>
              <Button disabled={saving} variant="outline" onClick={() => void save("deferred")}>
                {t("later")}
              </Button>
              <Button disabled={saving} variant="ghost" onClick={() => void save(d.review)}>
                {t("saveReviewDraft")}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
function BulkDialog({ selected, close }: { selected: string[]; close: () => void }) {
  const { t, docs, settings, saveDoc } = useWorkspace();
  const [date, setDate] = useState("");
  const [account, setAccount] = useState("");
  const [currency, setCurrency] = useState("SEK");
  const [busy, setBusy] = useState(false);
  async function apply() {
    setBusy(true);
    try {
      for (const doc of docs.filter((d) => selected.includes(d.id) && d.details.type === "sales"))
        await saveDoc({
          ...doc,
          details: {
            ...doc.details,
            paymentDate: date,
            account,
            paymentCurrency: currency,
            paid: true,
            review: "pending",
          },
          status: "needs_information",
        });
      close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="dialog-overlay">
      <section className="dialog-panel" role="dialog" aria-modal="true" aria-label={t("bulk")}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">{t("bulk")}</h2>
          <Button variant="ghost" size="icon" onClick={close} aria-label={t("back")}>
            <X />
          </Button>
        </div>
        <p className="mb-5 text-xs leading-6 text-muted-foreground">
          {selected.length} {t("selected")} · {t("bulkHint")}
        </p>
        <div className="space-y-4">
          <Field label={t("paymentDate")}>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={t("account")}>
            <select value={account} onChange={(e) => setAccount(e.target.value)}>
              <option value="">{t("unsure")}</option>
              {settings.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("paymentCurrency")}>
            <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
          </Field>
          <Button
            className="w-full"
            size="lg"
            disabled={!date || busy}
            onClick={() => void apply()}
          >
            {t("apply")}
            <Check />
          </Button>
        </div>
      </section>
    </div>
  );
}
function Reports() {
  const { t, docs, settings, demo } = useWorkspace();
  const [section, setSection] = useState("pl");
  const result = totals(docs);
  async function download() {
    await downloadReport(
      `SUMITT - DRAFT REPORT${demo ? " - DEMO DATA" : ""}\nFinancial year: ${settings.year}\nNot for filing. No verified year-specific tax mappings.\nSelected reference-date estimates only.\nRevenue SEK: ${result.revenue}\nExpenses SEK: ${result.expenses}\nProfit/loss SEK: ${result.profit}\n\nDraft journal\n${result.ledger.map((l) => `${docs.find((d) => d.id === l.documentId)?.name} | ${l.date} | ${l.account} | Debit ${l.debit} | Credit ${l.credit}`).join("\n")}\n\nUnresolved documents: ${docs.filter((d) => d.details.review !== "confirmed").length}\nOpening balances: ${settings.opening ? "Entered - review required" : "Not confirmed; not assumed zero"}\nMethod: ${settings.method}\nRounding: half-up, 2 SEK decimals after multiplication\nRule: draft-conversion-v1`,
    );
  }
  return (
    <>
      <div className="soft-note mt-0">
        <Info className="shrink-0" size={18} />
        <div>
          <strong>{t("blocked")}</strong>
          <p>{t("reportNote")}</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {["pl", "balance", "vatReport", "closing", "ne"].map((k) => (
          <Button
            key={k}
            variant={section === k ? "secondary" : "outline"}
            onClick={() => setSection(k)}
          >
            {t(k as TranslationKey)}
          </Button>
        ))}
      </div>
      {section === "pl" ? (
        <>
          <div className="summary-grid">
            {[
              { k: "revenue", v: result.revenue },
              { k: "expenses", v: result.expenses },
              { k: "profit", v: result.profit },
            ].map((s) => (
              <div className="summary-card" key={s.k}>
                <p className="text-sm text-muted-foreground">
                  {t(s.k as TranslationKey)} <span className="status-pill ml-1">{t("draft")}</span>
                </p>
                <p className="mt-4 text-2xl font-bold">
                  {s.v} <span className="text-xs font-normal">SEK</span>
                </p>
              </div>
            ))}
          </div>
          <div className="section-heading">
            <h2>{t("ledger")}</h2>
            <Button variant="outline" onClick={() => void download()}>
              <Download />
              {t("download")}
            </Button>
          </div>
          <p className="mb-4 text-xs leading-6 text-muted-foreground">
            {t("financialYearNote")} {t("rounding")}
          </p>
          {result.ledger.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border">
                  <tr>
                    <th className="p-3">{t("documents")}</th>
                    <th className="p-3">{t("account")}</th>
                    <th className="p-3">{t("debit")}</th>
                    <th className="p-3">{t("credit")}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.ledger.map((l, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="max-w-52 break-all p-3">
                        {docs.find((d) => d.id === l.documentId)?.name}
                      </td>
                      <td className="p-3">{l.account}</td>
                      <td className="p-3">{l.debit}</td>
                      <td className="p-3">{l.credit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-xl bg-muted p-6 text-sm">{t("noLedger")}</p>
          )}
        </>
      ) : section === "closing" ? (
        <YearEnd />
      ) : section === "ne" ? (
        <NeGuide />
      ) : (
        <section className="my-8 border-y border-border py-8">
          <h2 className="text-xl font-bold">{t(section as TranslationKey)}</h2>
          <p className="mt-4 text-sm text-muted-foreground">{t("notSupported")}</p>
          <p className="mt-3 text-sm leading-7">{t("taxGuidanceNote")}</p>
          {(section === "ne" || section === "vatReport") && (
            <p className="mt-5 rounded-lg bg-sage p-4 font-semibold">
              {t(section === "ne" ? "neLabel" : "vatLabel")} · {settings.year}
            </p>
          )}
        </section>
      )}
      <div className="section-heading">
        <h2>{t("included")}</h2>
      </div>
      <DocumentRows docs={docs.filter((d) => result.ledger.some((l) => l.documentId === d.id))} />
      <p className="mt-4 text-xs text-muted-foreground">{t("missing")}</p>
    </>
  );
}
function YearEnd() {
  const { t, docs, settings, lang, demo } = useWorkspace();
  const [open, setOpen] = useState<FinancialDoc | null>(null);
  const items = yearEndChecklist(docs, settings);
  const ready = closingReady(items);
  return (
    <section className="my-8 border-y border-border py-8">
      <h2 className="text-xl font-bold">{t("closing")} · {settings.year}</h2>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">{t("closingIntro")}</p>
      <ClosingAssistant items={items} settings={settings} lang={lang} demo={demo} action={id=>{
        const item=items.find(i=>i.key===id);
        if(!item)return null;
        return <div>{item.docIds.length?item.docIds.map(docId=>{const found=docs.find(x=>x.id===docId);return found?<Button key={docId} type="button" variant="link" className="h-auto whitespace-normal" onClick={()=>setOpen(found)}>{t("review")} · {found.name}</Button>:null;}):<Button asChild variant="link"><Link to="/business">{t("business")}</Link></Button>}</div>;
      }}/>
      <ul className="mt-5 space-y-3">
        {items.map((i) => (
          <li key={i.key} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              {i.ok ? <Check className="mt-0.5 shrink-0 text-primary" size={18} /> : <Clock3 className="mt-0.5 shrink-0 text-muted-foreground" size={18} />}
              <div className="min-w-0">
                <p className="font-semibold">
                  {t(`check_${i.key}` as TranslationKey)}
                  {i.count > 0 && <span className="status-pill ml-2">{i.count}</span>}
                </p>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">{(i.key === "unresolved" || i.key === "unpaidAtYearEnd" || i.key === "feesToReview") && i.ok ? t(`checkDone_${i.key}` as TranslationKey) : t(`checkHint_${i.key}` as TranslationKey)}</p>
                {i.docIds.length > 0 && (
                  <ul className="mt-2 text-xs leading-6">
                    {i.docIds.map((id) => {
                      const doc = docs.find((d) => d.id === id);
                      if (!doc) return null;
                      return (
                        <li key={id}>
                          <Button
                            variant="link"
                            className="h-auto max-w-full justify-start whitespace-normal px-0 py-1 text-left text-xs underline"
                            onClick={() => setOpen(doc)}
                            aria-label={`${t("review")} ${doc.name}`}
                          >
                            <FileText size={14} className="shrink-0" />
                            <span className="min-w-0 break-all">{doc.name}</span>
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="soft-note">{ready ? t("closingReady") : t("closingBlocked")}</div>
      {open && <ReviewDialog doc={open} close={() => setOpen(null)} />}
    </section>
  );
}
function NeGuide() {
  const { t, docs, settings, lang, demo } = useWorkspace();
  const lines = neGuidance(docs);
  return (
    <section className="my-8 border-y border-border py-8">
      <h2 className="text-xl font-bold">{t("ne")}</h2>
      <p className="mt-5 rounded-lg bg-sage p-4 font-semibold">{t("neLabel")} · {settings.year}</p>
      <NeAssistant lang={lang} year={settings.year} demo={demo}/>
      <NeFilingGuide lang={lang} year={settings.year} demo={demo} />
      <h3 className="mt-8 text-lg font-bold">{neGuideCopy[lang].draft}</h3>
      <p className="mt-4 text-sm leading-7 text-muted-foreground">{t("neIntro")}</p>
      <ul className="mt-5 space-y-3">
        {lines.map((l) => (
          <li key={l.key} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{l.box} <span className="status-pill ml-1">{t("neCandidate")}</span></p>
              <p className="font-bold">{l.amount === null ? "—" : `${l.amount} SEK`} {l.amount !== null && <span className="status-pill ml-1">{t("draft")}</span>}</p>
            </div>
            <p className="mt-2 text-sm">{t(l.key)}</p>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">{t(`${l.key}Hint` as TranslationKey)}</p>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm font-semibold">B1–B16 · R12–R48 — {neGuideCopy[lang].missing}</p>
      <div className="soft-note">{t("neNotCovered")}</div>
      <Button variant="link" asChild>
        <a href="https://www.skatteverket.se/foretag/drivaforetag/foretagsformer/enskildnaringsverksamhet.4.5c13cb6b1198121ee8580002518.html" target="_blank" rel="noreferrer">{t("neOfficial")}</a>
      </Button>
    </section>
  );
}
function Help() {
  const { t } = useWorkspace();
  return (
    <>
      <section className="border-b border-border pb-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="icon-tile bg-sage">
            <ShieldCheck />
          </span>
          <h2 className="text-lg font-bold">{t("privacy")}</h2>
        </div>
        <p className="text-sm leading-8 text-muted-foreground">{t("privacyText")}</p>
        <p className="mt-3 text-sm leading-8 text-muted-foreground">{t("uploadPrivacy")}</p>
      </section>
      <section className="form-section">
        <h3>{t("integration")}</h3>
        {["manualExtraction", "manualRates", "taxStatus"].map((k) => (
          <p key={k} className="mb-4 flex gap-3 text-sm leading-7">
            <Info size={16} className="mt-1 shrink-0 text-primary" />
            {t(k as TranslationKey)}
          </p>
        ))}
      </section>
      <div className="soft-note">{t("draftNote")}</div>
    </>
  );
}
function Preferences({ name, setName }: { name: string; setName: (v: string) => void }) {
  const { t, user, demo, settings, docs, auth } = useWorkspace();
  const remove = useServerFn(deleteOwnAccount);
  async function save() {
    if (!user) {
      auth();
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name })
      .eq("id", user.id);
    if (error) toast.error(error.message);
    else toast.success(t("savedToast"));
  }
  async function exportData() {
    if (!user || demo) {
      const blob = new Blob([JSON.stringify({ demo: true, settings, documents: docs }, null, 2)], {
        type: "application/json",
      });
      downloadBlob(blob);
      return;
    }
    const [d, a] = await Promise.all([
      supabase.from("documents").select("*"),
      supabase.from("audit_history").select("*"),
    ]);
    if (d.error || a.error) {
      toast.error(t("error"));
      return;
    }
    downloadBlob(
      new Blob([JSON.stringify({ settings, documents: d.data, audit: a.data }, null, 2)], {
        type: "application/json",
      }),
    );
  }
  function downloadBlob(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sumitt-data.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  async function deleteAccount() {
    if (!user || demo) {
      toast.info(t("notSignedIn"));
      return;
    }
    if (!window.confirm(t("deleteConfirm"))) return;
    try {
      await remove();
      await supabase.auth.signOut();
      window.location.assign("/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    }
  }
  return (
    <>
      <div className="max-w-lg space-y-5">
        <Field label={t("name")}>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Button onClick={() => void save()}>{t("saveName")}</Button>
      </div>
      <section className="form-section mt-5">
        <h3>{t("privacy")}</h3>
        <p className="mb-5 text-sm leading-7 text-muted-foreground">{t("exportNote")}</p>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => void exportData()}>
            <Download />
            {t("export")}
          </Button>
          <Button variant="destructive" onClick={() => void deleteAccount()}>
            {t("deleteAccount")}
          </Button>
        </div>
      </section>
      <Help />
    </>
  );
}
function GoogleLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
      />
    </svg>
  );
}
function AuthDialog({ close }: { close: () => void }) {
  const { t } = useWorkspace();
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setMessage(t("checkEmail"));
      } else if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setMessage(t("resetSent"));
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        close();
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("error"));
    } finally {
      setBusy(false);
    }
  }
  async function social(provider: "google" | "lovable") {
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result.error) setMessage(result.error.message);
  }
  return (
    <div className="dialog-overlay">
      <section className="dialog-panel" role="dialog" aria-modal="true" aria-label={t("signIn")}>
        <div className="mb-4 flex items-center justify-between">
          <span className="brand-mark">
            <Bird />
          </span>
          <Button variant="ghost" size="icon" aria-label={t("back")} onClick={close}>
            <X />
          </Button>
        </div>
        <h2 className="mb-6 text-xl font-bold">{t("authTitle")}</h2>
        <div className="mb-6 space-y-3">
          <Button
            variant="outline"
            className="w-full"
            size="lg"
            onClick={() => void social("google")}
          >
            <GoogleLogo />
            {t("google")}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            size="lg"
            onClick={() => void social("lovable")}
          >
            <LovableMark />
            {t("lovable")}
          </Button>
        </div>
        <form onSubmit={(e) => void submit(e)} className="space-y-4">
          <Field label={t("email")}>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          {mode !== "reset" && (
            <Field label={t("password")}>
              <input
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
          )}
          <Button size="lg" disabled={busy} className="w-full">
            {t(mode === "signup" ? "createAccount" : mode === "reset" ? "sendReset" : "signIn")}
          </Button>
          {message && (
            <p role="status" className="text-sm leading-7">
              {message}
            </p>
          )}
        </form>
        <div className="mt-4 flex flex-wrap justify-between gap-2">
          <Button variant="link" onClick={() => setMode(mode === "signup" ? "login" : "signup")}>
            {t(mode === "signup" ? "signIn" : "createAccount")}
          </Button>
          <Button variant="link" onClick={() => setMode("reset")}>
            {t("forgot")}
          </Button>
        </div>
      </section>
    </div>
  );
}
