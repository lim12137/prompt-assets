import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repositoryPath = path.resolve(
  __dirname,
  "../../../apps/web/lib/api/prompt-repository.ts",
);

function pickFunctionBody(source: string, functionName: string): string {
  const start = source.indexOf(`async function ${functionName}(`);
  assert.notEqual(start, -1, `未找到函数 ${functionName}`);
  const end = source.indexOf("\nasync function ", start + 1);
  return end >= 0 ? source.slice(start, end) : source.slice(start);
}

test("prompt-version like/unlike 在 DB 路径通过 UPDATE ... RETURNING likes_count 回读", async () => {
  const source = await readFile(repositoryPath, "utf-8");
  const likeBody = pickFunctionBody(source, "likePromptVersionInDb");
  const unlikeBody = pickFunctionBody(source, "unlikePromptVersionInDb");

  assert.match(
    likeBody,
    /UPDATE\s+prompt_versions[\s\S]*SET\s+likes_count\s*=\s*likes_count\s*\+\s*1[\s\S]*RETURNING\s+likes_count/i,
    "like 路径应通过 UPDATE ... RETURNING likes_count 获取最新计数",
  );
  assert.match(
    unlikeBody,
    /UPDATE\s+prompt_versions[\s\S]*SET\s+likes_count\s*=\s*GREATEST\(likes_count\s*-\s*1,\s*0\)[\s\S]*RETURNING\s+likes_count/i,
    "unlike 路径应通过 UPDATE ... RETURNING likes_count 获取最新计数",
  );
});
