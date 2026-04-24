import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";

/*
 * Task17 并发脚本骨架（搜索 + 投稿）
 *
 * 默认目标：
 * - 20 并发搜索用户，命中 GET /api/prompts
 * - 10 并发投稿用户，命中 POST /api/prompts/{slug}/submissions
 *
 * 可覆盖参数（通过 k6 环境变量传入）：
 * - BASE_URL: 默认 http://127.0.0.1:13000
 * - TEST_DURATION: 默认 30s
 * - SEARCH_VUS: 默认 20
 * - SUBMIT_VUS: 默认 10
 * - SEARCH_KEYWORD: 默认 API
 * - SEARCH_SORT: 默认 latest
 * - SUBMIT_SLUG: 默认 api-debug-assistant
 * - SUBMIT_USER_PREFIX: 默认 loadtest-user
 * - SUBMIT_CONTENT_PREFIX: 默认 并发投稿内容
 * - SUBMIT_CHANGE_NOTE_PREFIX: 默认 并发投稿变更说明
 * - THINK_TIME_SECONDS: 默认 0.2（每次请求后 sleep）
 *
 * 示例命令（本机已有 k6 时）：
 * k6 run tests/concurrency/search-and-submit.js
 *
 * 示例命令（Docker 运行 k6）：
 * docker run --rm -i -e BASE_URL=http://host.docker.internal:13000 grafana/k6 run - < tests/concurrency/search-and-submit.js
 */

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:13000";
const TEST_DURATION = __ENV.TEST_DURATION || "30s";
const SEARCH_VUS = Number(__ENV.SEARCH_VUS || 20);
const SUBMIT_VUS = Number(__ENV.SUBMIT_VUS || 10);
const SEARCH_KEYWORD = __ENV.SEARCH_KEYWORD || "API";
const SEARCH_SORT = __ENV.SEARCH_SORT || "latest";
const SUBMIT_SLUG = __ENV.SUBMIT_SLUG || "api-debug-assistant";
const SUBMIT_USER_PREFIX = __ENV.SUBMIT_USER_PREFIX || "loadtest-user";
const SUBMIT_CONTENT_PREFIX = __ENV.SUBMIT_CONTENT_PREFIX || "并发投稿内容";
const SUBMIT_CHANGE_NOTE_PREFIX =
  __ENV.SUBMIT_CHANGE_NOTE_PREFIX || "并发投稿变更说明";
const THINK_TIME_SECONDS = Number(__ENV.THINK_TIME_SECONDS || 0.2);

const searchSuccessCount = new Counter("search_success_count");
const submitSuccessCount = new Counter("submit_success_count");

export const options = {
  scenarios: {
    search_users: {
      executor: "constant-vus",
      exec: "searchScenario",
      vus: SEARCH_VUS,
      duration: TEST_DURATION,
      tags: { scenario: "search" },
    },
    submit_users: {
      executor: "constant-vus",
      exec: "submitScenario",
      vus: SUBMIT_VUS,
      duration: TEST_DURATION,
      tags: { scenario: "submit" },
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.05"],
    "http_req_failed{scenario:search}": ["rate<0.05"],
    "http_req_failed{scenario:submit}": ["rate<0.05"],
    "http_req_duration{scenario:search}": ["p(95)<1500"],
    "http_req_duration{scenario:submit}": ["p(95)<2000"],
    checks: ["rate>0.95"],
  },
};

function buildSearchUrl() {
  const keyword = encodeURIComponent(SEARCH_KEYWORD);
  const sort = encodeURIComponent(SEARCH_SORT);
  return `${BASE_URL}/api/prompts?keyword=${keyword}&sort=${sort}`;
}

function buildSubmissionUrl() {
  const slug = encodeURIComponent(SUBMIT_SLUG);
  return `${BASE_URL}/api/prompts/${slug}/submissions`;
}

function parseJson(response) {
  try {
    return response.json();
  } catch {
    return null;
  }
}

export function searchScenario() {
  const response = http.get(buildSearchUrl());
  const data = parseJson(response);

  const ok = check(
    response,
    {
      "search status is 200": (res) => res.status === 200,
      "search response is array": () => Array.isArray(data),
    },
    { scenario: "search" },
  );

  if (ok) {
    searchSuccessCount.add(1);
  }

  sleep(THINK_TIME_SECONDS);
}

export function submitScenario() {
  const userEmail = `${SUBMIT_USER_PREFIX}-vu${__VU}-iter${__ITER}@example.com`;
  const payload = JSON.stringify({
    content: `${SUBMIT_CONTENT_PREFIX} vu=${__VU} iter=${__ITER} ts=${Date.now()}`,
    changeNote: `${SUBMIT_CHANGE_NOTE_PREFIX} vu=${__VU} iter=${__ITER}`,
  });

  const response = http.post(buildSubmissionUrl(), payload, {
    headers: {
      "content-type": "application/json",
      "x-user-email": userEmail,
    },
  });
  const data = parseJson(response);

  const ok = check(
    response,
    {
      "submit status is 201": (res) => res.status === 201,
      "submit returns candidate version": () =>
        Boolean(data && data.candidateVersion && data.candidateVersion.versionNo),
      "submit returns pending status": () =>
        Boolean(data && data.submission && data.submission.status === "pending"),
    },
    { scenario: "submit" },
  );

  if (ok) {
    submitSuccessCount.add(1);
  }

  sleep(THINK_TIME_SECONDS);
}
