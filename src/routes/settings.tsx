import { createFileRoute } from "@tanstack/react-router";
import { Workspace } from "@/components/workspace";
export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Preferences & data — Sumitt" },
      {
        name: "description",
        content: "Save your profile preferences, export data or delete your private account.",
      },
      { property: "og:title", content: "Preferences & data — Sumitt" },
      { property: "og:description", content: "Your data stays yours." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <Workspace page="settings" />,
});
