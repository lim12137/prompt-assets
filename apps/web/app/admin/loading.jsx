import { LoadingShell } from "../_shared/loading-shell.jsx";

export default function AdminLoading() {
  return <LoadingShell title="管理页加载中..." description="正在校验登录状态并加载管理数据。" />;
}
