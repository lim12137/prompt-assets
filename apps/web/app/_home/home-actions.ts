export const HOME_ACTION_ENTRIES = [
  {
    label: "导入",
    href: "/admin/import",
    className: "pm-secondary-button pm-button-link",
  },
  {
    label: "管理",
    href: "/admin",
    className: "pm-secondary-button pm-button-link",
  },
  {
    label: "创建",
    href: "/admin/create",
    className: "pm-primary-button pm-button-link",
  },
] as const;

export const HOME_ACTION_STATUS_TEXT =
  "入口已开放，可直接进入创建、导入或管理页。";
