# Deploy Smoke Report

Date: 2026-04-24

## Commands

1. `docker compose config`
2. `docker build -f apps/web/Dockerfile -t prompt-assets-web:test .`
3. `git push origin master`
4. `$env:GHCR_OWNER='lim12137'; docker compose pull && docker compose up -d`
5. `.\scripts\smoke-compose.ps1`

## Result Summary

- `docker compose config`: passed after setting `GHCR_OWNER=lim12137`.
- `docker build -f apps/web/Dockerfile -t prompt-assets-web:test .`: blocked by local network failure to Docker Hub when fetching `node:22-alpine`; not a code failure.
- `git push origin master`: pushed commit `59fa05b` successfully.
- `Publish Images` GitHub Actions run `24863764296`: succeeded in `1m39s`.
- `$env:GHCR_OWNER='lim12137'; docker compose pull`: pulled updated GHCR images successfully.
- `$env:GHCR_OWNER='lim12137'; docker compose up -d`: recreated `prompt-assets-web` successfully.
- `$env:GHCR_OWNER='lim12137'; .\scripts\smoke-compose.ps1`: passed, health endpoint returned `{"status":"ok"}` on attempt 1.
