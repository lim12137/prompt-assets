export type PromptListItemDto = {
  slug: string;
  title: string;
  summary: string;
  likesCount: number;
  updatedAt: string;
  categorySlug: string;
  categoryName: string;
};

export type PromptVersionStatus = "approved" | "pending" | "rejected";

export type PromptDetailVersionDto = {
  versionNo: string;
  sourceType: string;
  status: PromptVersionStatus;
  submittedAt: string;
  content?: string;
};

export type PromptDetailDto = {
  slug: string;
  title: string;
  summary: string;
  likesCount: number;
  updatedAt: string;
  category: {
    slug: string;
    name: string;
  };
  currentVersion: {
    versionNo: string;
    sourceType: string;
    submittedAt: string;
    content: string;
  };
  versions: PromptDetailVersionDto[];
};

export type PromptListRaw = {
  slug: string;
  title: string;
  summary: string;
  likesCount: number;
  updatedAt: string | Date;
  categorySlug: string;
  categoryName: string;
};

export type PromptVersionRaw = {
  versionNo: string;
  sourceType: string;
  status: PromptVersionStatus;
  submittedAt: string | Date;
  content: string;
};

export type PromptDetailRaw = {
  slug: string;
  title: string;
  summary: string;
  likesCount: number;
  updatedAt: string | Date;
  categorySlug: string;
  categoryName: string;
  currentVersionNo: string;
  currentVersionSourceType: string;
  currentVersionSubmittedAt: string | Date;
  currentVersionContent: string;
  versions: PromptVersionRaw[];
};

export function toIsoString(input: string | Date): string {
  if (input instanceof Date) {
    return input.toISOString();
  }
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(0).toISOString();
  }
  return parsed.toISOString();
}

export function mapPromptListItem(raw: PromptListRaw): PromptListItemDto {
  return {
    slug: raw.slug,
    title: raw.title,
    summary: raw.summary,
    likesCount: raw.likesCount,
    updatedAt: toIsoString(raw.updatedAt),
    categorySlug: raw.categorySlug,
    categoryName: raw.categoryName,
  };
}

export function mapPromptDetailVersion(
  raw: PromptVersionRaw,
): PromptDetailVersionDto {
  const base: PromptDetailVersionDto = {
    versionNo: raw.versionNo,
    sourceType: raw.sourceType,
    status: raw.status,
    submittedAt: toIsoString(raw.submittedAt),
  };

  if (raw.status !== "rejected") {
    base.content = raw.content;
  }

  return base;
}

export function mapPromptDetail(raw: PromptDetailRaw): PromptDetailDto {
  return {
    slug: raw.slug,
    title: raw.title,
    summary: raw.summary,
    likesCount: raw.likesCount,
    updatedAt: toIsoString(raw.updatedAt),
    category: {
      slug: raw.categorySlug,
      name: raw.categoryName,
    },
    currentVersion: {
      versionNo: raw.currentVersionNo,
      sourceType: raw.currentVersionSourceType,
      submittedAt: toIsoString(raw.currentVersionSubmittedAt),
      content: raw.currentVersionContent,
    },
    versions: raw.versions.map(mapPromptDetailVersion),
  };
}
