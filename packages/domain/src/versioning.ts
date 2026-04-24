const VERSION_PREFIX = "v";
const VERSION_DIGITS = 4;
const CANDIDATE_MARKER = "cand";

type BuildSubmissionCandidateNoInput = {
  baseVersionNo: string;
  submitter: string;
  revisionIndex: number;
};

function normalizeSubmitterKey(submitter: string): string {
  const normalized = submitter.trim().toLowerCase();
  const source = normalized.includes("@")
    ? normalized.split("@")[0] ?? ""
    : normalized;

  const key = source.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!key) {
    throw new Error("Invalid submitter for candidate no");
  }
  return key;
}

export function buildSubmissionCandidateNo(
  input: BuildSubmissionCandidateNoInput,
): string {
  const baseVersionNo = input.baseVersionNo.trim();
  if (!/^v\d+$/i.test(baseVersionNo)) {
    throw new Error("Invalid base version format");
  }
  if (!Number.isInteger(input.revisionIndex) || input.revisionIndex <= 0) {
    throw new Error("Invalid revision index");
  }

  const submitterKey = normalizeSubmitterKey(input.submitter);
  return `${baseVersionNo}-${CANDIDATE_MARKER}-${submitterKey}-${input.revisionIndex}`;
}

export function nextVersionNo(currentVersionNo?: string): string {
  if (!currentVersionNo) {
    return `${VERSION_PREFIX}${String(1).padStart(VERSION_DIGITS, "0")}`;
  }

  const matched = /^v(\d+)$/.exec(currentVersionNo);
  if (!matched) {
    throw new Error("Invalid version format");
  }

  const current = Number(matched[1]);
  const next = current + 1;
  return `${VERSION_PREFIX}${String(next).padStart(VERSION_DIGITS, "0")}`;
}
