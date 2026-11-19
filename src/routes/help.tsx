import { createFileRoute } from "@tanstack/react-router";
import { Workspace } from "@/components/workspace";
export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Privacy & connection status — Sumitt" },
      {
        name: "description",
        content:
          "Understand private PDF storage and the real status of extraction, rates and tax rule coverage.",
      },
      { property: "og:title", content: "Privacy & connection status — Sumitt" },
      { property: "og:description", content: "Private documents and honest integration status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <Workspace page="help" />,
});
