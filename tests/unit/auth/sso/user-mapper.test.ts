import test from "node:test";
import assert from "node:assert/strict";

import {
  mapSsoUserToSystemUser,
  buildPlaceholderEmail,
  MissingUserAccountError,
} from "../../../../apps/web/lib/auth/sso/user-mapper.ts";

// ---- buildPlaceholderEmail ----

test("buildPlaceholderEmail: 工号拼 @internal.local", () => {
  assert.equal(buildPlaceholderEmail("12061413"), "12061413@internal.local");
});

test("buildPlaceholderEmail: 工号转小写（归一化）", () => {
  assert.equal(buildPlaceholderEmail("UserABC"), "userabc@internal.local");
});

test("buildPlaceholderEmail: 去除首尾空白", () => {
  assert.equal(buildPlaceholderEmail("  12061413  "), "12061413@internal.local");
});

// ---- mapSsoUserToSystemUser: 标准层级 data.user.userAccount ----

test("mapSsoUser: 标准 data.user.userAccount 层级正确映射", () => {
  const userInfo = {
    code: 200,
    data: {
      user: {
        userAccount: "12061413",
        userName: "张三",
        deptName: "安全部",
      },
    },
  };
  const result = mapSsoUserToSystemUser(userInfo);
  assert.equal(result.uid, "12061413");
  assert.equal(result.name, "张三");
  assert.equal(result.department, "安全部");
  assert.equal(result.email, "12061413@internal.local");
});

test("mapSsoUser: email 与 uid 联动（小写）", () => {
  const result = mapSsoUserToSystemUser({
    data: { user: { userAccount: "AbC123" } },
  });
  assert.equal(result.email, "abc123@internal.local");
});

// ---- 字段 fallback ----

test("mapSsoUser: 缺 userName 时用 userAccount 作 name", () => {
  const result = mapSsoUserToSystemUser({
    data: { user: { userAccount: "12061413" } },
  });
  assert.equal(result.name, "12061413");
});

test("mapSsoUser: 缺 deptName 时 department 为 undefined（不出现该字段）", () => {
  const result = mapSsoUserToSystemUser({
    data: { user: { userAccount: "u1", userName: "n" } },
  });
  assert.equal(result.department, undefined);
});

test("mapSsoUser: userAccount 字段名变体 fallback（account/employeeId/loginName/uid/username）", () => {
  for (const key of ["account", "employeeId", "loginName", "uid", "username"]) {
    const result = mapSsoUserToSystemUser({ data: { user: { [key]: `v-${key}` } } });
    assert.equal(result.uid, `v-${key}`, `应支持字段名 ${key}`);
  }
});

test("mapSsoUser: userName 字段名变体 fallback（name/realName/nickName/displayName）", () => {
  for (const key of ["name", "realName", "nickName", "displayName"]) {
    const result = mapSsoUserToSystemUser({
      data: { user: { userAccount: "u1", [key]: `n-${key}` } },
    });
    assert.equal(result.name, `n-${key}`, `应支持字段名 ${key}`);
  }
});

test("mapSsoUser: 部门字段名变体 fallback（department/dept/org/organization）", () => {
  for (const key of ["department", "dept", "org", "organization"]) {
    const result = mapSsoUserToSystemUser({
      data: { user: { userAccount: "u1", [key]: `d-${key}` } },
    });
    assert.equal(result.department, `d-${key}`, `应支持字段名 ${key}`);
  }
});

// ---- 层级 fallback ----

test("mapSsoUser: data 层直接是用户记录（无 user 包裹）", () => {
  const result = mapSsoUserToSystemUser({
    data: { userAccount: "12061413", userName: "李四" },
  });
  assert.equal(result.uid, "12061413");
  assert.equal(result.name, "李四");
});

test("mapSsoUser: 根层直接是用户记录（无 data 包裹）", () => {
  const result = mapSsoUserToSystemUser({
    userAccount: "12061413",
    userName: "王五",
  });
  assert.equal(result.uid, "12061413");
  assert.equal(result.name, "王五");
});

test("mapSsoUser: user 字段包裹层级", () => {
  const result = mapSsoUserToSystemUser({
    user: { userAccount: "12061413", userName: "赵六" },
  });
  assert.equal(result.uid, "12061413");
  assert.equal(result.name, "赵六");
});

// ---- 缺失与非法 ----

test("mapSsoUser: 缺 userAccount 抛 MissingUserAccountError", () => {
  assert.throws(
    () => mapSsoUserToSystemUser({ data: { user: { userName: "无名" } } }),
    (err: unknown) => err instanceof MissingUserAccountError,
  );
});

test("mapSsoUser: userAccount 为空字符串抛 MissingUserAccountError", () => {
  assert.throws(
    () => mapSsoUserToSystemUser({ data: { user: { userAccount: "   " } } }),
    (err: unknown) => err instanceof MissingUserAccountError,
  );
});

test("mapSsoUser: userInfo 非对象抛 MissingUserAccountError", () => {
  assert.throws(() => mapSsoUserToSystemUser(null), MissingUserAccountError);
  assert.throws(() => mapSsoUserToSystemUser("string"), MissingUserAccountError);
  assert.throws(() => mapSsoUserToSystemUser(undefined), MissingUserAccountError);
});

test("mapSsoUser: 空对象抛 MissingUserAccountError", () => {
  assert.throws(() => mapSsoUserToSystemUser({}), MissingUserAccountError);
});

test("MissingUserAccountError: name 属性正确", () => {
  try {
    mapSsoUserToSystemUser({});
    assert.fail("应抛错");
  } catch (err) {
    assert.equal((err as MissingUserAccountError).name, "MissingUserAccountError");
  }
});
