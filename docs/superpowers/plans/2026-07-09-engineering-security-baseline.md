# Engineering Security Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current runnable Pet Planet project into a clearer engineering baseline with verified password recovery and stronger rate-limit persistence.

**Architecture:** Keep the existing Express + MySQL + Expo architecture. Add small, focused database tables for email password reset tokens and rate-limit buckets, wire them through the existing auth and middleware boundaries, and preserve local development ergonomics with debug-only reset tokens.

**Tech Stack:** Expo Router, React Native Web, Express 5, MySQL 9, mysql2, JWT, bcryptjs.

---

## File Structure

- Modify `package.json`: add root scripts for backend startup and full verification.
- Modify `server/full_schema.sql`: add `email_reset_tokens` and `rate_limit_buckets`.
- Create `server/migrations/005_email_reset_and_rate_limit.sql`: migrate existing databases.
- Modify `server/routes/auth.js`: accept email at registration, send email reset tokens, validate one-time email reset tokens.
- Modify `server/middleware/rateLimit.js`: store rate-limit buckets in MySQL when a pool is available, fall back to memory only if the database is unavailable.
- Modify `scripts/db-summary.js`: check the new security tables.
- Modify `server/test-api.js`: prove email reset token behavior and invalid token rejection.
- Create `docs/engineering-baseline-2026-07-09.md`: document run, verify, baseline, and commit steps.

## Task 1: Root Engineering Scripts

- [ ] Add root scripts:
  - `server`: `npm --prefix server start`
  - `server:dev`: `npm --prefix server run dev`
  - `verify`: `npm run typecheck && npm run db:summary && npm run test:server:smoke`
- [ ] Run `npm.cmd run` and confirm the scripts are listed.

## Task 2: Email Reset Token Schema

- [ ] Add `email_reset_tokens` to `server/full_schema.sql`.
- [ ] Add migration `005_email_reset_and_rate_limit.sql`.
- [ ] Update `scripts/db-summary.js` to require `email_reset_tokens.token`.
- [ ] Run `npm.cmd run db:summary`; expected: pass after migration has been applied.

## Task 3: Email Reset TDD

- [ ] Add smoke tests:
  - register user with email.
  - request email reset token.
  - reject an invalid email reset token.
  - accept a valid email reset token.
  - reject reusing the same token.
  - login succeeds with the new password.
- [ ] Run `npm.cmd run test:server:smoke`; expected RED before implementation.
- [ ] Implement auth route behavior.
- [ ] Run `npm.cmd run test:server:smoke`; expected GREEN.

## Task 4: Persistent Rate Limiting

- [ ] Add `rate_limit_buckets` schema.
- [ ] Update middleware to read/write bucket state through MySQL.
- [ ] Keep in-memory fallback for bootstrapping and database outage.
- [ ] Run `npm.cmd run test:server:smoke`; expected GREEN.

## Task 5: Baseline Documentation

- [ ] Create engineering baseline documentation with:
  - run commands.
  - verification commands.
  - database migration steps.
  - safe commit checklist.
- [ ] Run `npm.cmd run verify`; expected GREEN.

## Self-Review

- Spec coverage: scripts, baseline documentation, email reset, persistent rate limiting, and verification are covered.
- Placeholder scan: no TBD/TODO/fill-in placeholders.
- Type consistency: route names and script names match the existing Express and npm structure.
