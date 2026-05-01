import { AdminPromptManagementDetail } from "../_prompt-management-detail.jsx";

export default async function AdminPromptDetailPage({ params }) {
  const resolvedParams = await Promise.resolve(params);
  return <AdminPromptManagementDetail slug={resolvedParams.slug} />;
}
