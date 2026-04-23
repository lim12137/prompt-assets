# Deploy Smoke Report

Date: 2026-04-24

## Commands

1. `docker compose config`
2. `docker build -f apps/web/Dockerfile -t prompt-assets-web:test .`
3. `git push origin master`
4. `$env:GHCR_OWNER='lim12137'; docker compose pull && docker compose up -d`
5. `.\scripts\smoke-compose.ps1`

## Result Summary

- Pending execution.
