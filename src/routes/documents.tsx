import { createFileRoute } from "@tanstack/react-router";
import { Workspace } from "@/components/workspace";
export const Route = createFileRoute("/documents")({
  head: () => ({
    meta: [
      { title: "Your documents — Sumitt" },
      {
        name: "description",
        content: "Privately upload and review financial PDFs in Japanese, English and Swedish.",
      },
      { property: "og:title", content: "Your documents — Sumitt" },
      {
        property: "og:description",
        content: "A safe place for your invoices, receipts and statements.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <Workspace page="documents" />,
});
