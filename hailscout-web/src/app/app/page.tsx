import { redirect } from "next/navigation";

export default function AppIndexPage() {
  // Default route → map
  redirect("/app/map");
}
