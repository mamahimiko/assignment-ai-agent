import { createFileRoute } from "@tanstack/react-router";
import { Workspace } from "@/components/workspace";
export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Draft reports & filing guidance — Sumitt" },
      {
        name: "description",
        content:
          "Follow sourced Skatteverket NE filing steps, trace draft totals to documents and see which annual tax rules still require validation.",
      },
      { property: "og:title", content: "Draft reports & filing guidance — Sumitt" },
      {
        property: "og:description",
        content: "Step-by-step NE annex filing guidance and transparent draft financial reports for Swedish sole traders.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <Workspace page="reports" />,
});
