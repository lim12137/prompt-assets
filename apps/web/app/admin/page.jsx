import { AdminReviewConsole } from "./_admin-review-console.jsx";
import { listPendingSubmissions } from "../../lib/api/prompt-repository.ts";

export default async function AdminPage() {
  const submissions = await listPendingSubmissions();
  return <AdminReviewConsole initialSubmissions={submissions} />;
}
