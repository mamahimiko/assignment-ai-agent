import { createFileRoute } from "@tanstack/react-router";
import { Workspace } from "@/components/workspace";

// The home route ships no og:image, so serve-time hosting can inject the
// project's social preview (explicit og:image or latest screenshot).
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sumitt — A little clarity for your finances" },
      {
        name: "description",
        content:
          "Your Japanese-first private bookkeeping workspace for Swedish sole traders. Organize PDFs and review draft calculations.",
      },
      { property: "og:title", content: "Sumitt — A little clarity for your finances" },
      {
        property: "og:description",
        content: "Organize your documents, one gentle step at a time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

// IMPORTANT: Replace this placeholder. See ./README.md for routing conventions.
function Index() {
  return <Workspace page="home" />;
}
