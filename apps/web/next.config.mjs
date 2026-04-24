/** @type {import('next').NextConfig} */
const resolvedDistDir = (() => {
  const fromEnv = process.env.NEXT_DIST_DIR;
  if (typeof fromEnv !== "string") {
    return ".next";
  }
  const normalized = fromEnv.trim();
  return normalized.length > 0 ? normalized : ".next";
})();

const nextConfig = {
  distDir: resolvedDistDir,
};

export default nextConfig;
