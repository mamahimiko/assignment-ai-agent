import { createFileRoute } from "@tanstack/react-router";
import { Workspace } from "@/components/workspace";
export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "Review together — Sumitt" },
      {
        name: "description",
        content: "Check PDF details, payment dates, fees and sourced currency conversions.",
      },
      { property: "og:title", content: "Review together — Sumitt" },
      {
        property: "og:description",
        content: "A few small questions for a clearer financial picture.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <Workspace page="review" />,
});
