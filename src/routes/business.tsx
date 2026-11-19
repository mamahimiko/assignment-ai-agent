import { createFileRoute } from "@tanstack/react-router";
import { Workspace } from "@/components/workspace";
export const Route = createFileRoute("/business")({
  head: () => ({
    meta: [
      { title: "Your business — Sumitt" },
      {
        name: "description",
        content:
          "Set up Swedish sole-trader accounts, currencies, VAT status and bookkeeping method.",
      },
      { property: "og:title", content: "Your business — Sumitt" },
      {
        property: "og:description",
        content: "Simple business settings for your bookkeeping journey.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <Workspace page="business" />,
});
