import { LoadingShell } from "../../_shared/loading-shell.jsx";

export default function PromptDetailLoading() {
  return <LoadingShell title="详情加载中..." description="正在读取提示词版本与互动数据。" />;
}
