# LogLens — AI Test-Log Triage for Cellular QA

LogLens helps cellular (LTE / 5G) QA engineers triage failed test logs. Upload a log and LogLens will:

1. **Redact** device and subscriber identifiers (IMEI, IMSI, ICCID, MSISDN, serial numbers, phone numbers) before anything is stored or sent to AI.
2. **Extract** the window of the log around the first failure signal, so it doesn't send the whole log.
3. **Analyze** the excerpt with the **Claude API** and return structured output: failure category, defect type, failing step, root cause, confidence, cause codes, evidence line numbers, and next steps. Every response is validated with Zod.
4. Let an **engineer confirm or correct** the result, find **similar past failures**, and generate a **draft bug report**.
5. Show a **dashboard** of failures by category and build, plus the AI agreement rate.

If no API key is set, or the AI call fails, LogLens falls back to a built-in **rules engine** that recognizes common 3GPP failure signatures, so the app keeps working.

> Built for IWU AIML-515 Workshop 5 (App #2). Built with Claude Code using spec-first prompting.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 18, Vite 6, Tailwind CSS 4, React Router, Recharts |
| Backend | Node.js, Express 4, Multer (uploads), Zod (validation), Helmet |
| Database | SQLite via better-sqlite3 (local); PostgreSQL / RDS planned for production |
| AI | Anthropic Claude API with tool use for structured JSON output |
| Hosting | AWS Elastic Beanstalk, Node.js 22 on Amazon Linux 2023 (App Runner is closed to new customers) |

## Project structure

```
loglens/
├── client/                 React + Vite frontend
│   └── src/
│       ├── pages/          Triage, History, Run detail, Dashboard
│       ├── components/     Shared UI (badges, log viewer, etc.)
│       └── api.js          Fetch wrapper with readable errors
├── server/                 Express API
│   ├── src/
│   │   ├── routes/logs.js  Upload, list, detail, review, bug report
│   │   ├── services/       redact, extract, aiAnalyzer, rulesAnalyzer, similarity, bugReport, schema
│   │   ├── db.js           SQLite schema and queries
│   │   └── index.js        App setup, security headers, error handler
│   └── test/               Node test runner unit tests
├── sample-logs/            Demo LTE / NR logs (fake identifiers)
└── .env.example
```

## Getting started

Requires **Node.js 20+**.

```bash
# 1. Install all dependencies (root, server, client)
npm run setup

# 2. Create your environment file and add your Claude API key
cp .env.example server/.env
#    then edit server/.env and set ANTHROPIC_API_KEY=sk-ant-...

# 3. Start the API (port 3001) and the React app (port 5173) together
npm run dev
```

Open http://localhost:5173. The header shows **Claude AI connected** when the key is loaded, or **Rules mode** without one.

Run the unit tests with `npm test`.

## Live demo

http://loglens-aiml515.us-east-1.elasticbeanstalk.com/

## Deploying to AWS Elastic Beanstalk

1. Run `prepare-deploy.command` (macOS) or `npm run build` and zip `server/`, `client/dist/`, `sample-logs/` with a root `package.json` whose start script is `node server/src/index.js`. The script writes `deploy/loglens-eb-*.zip`.
2. In the Elastic Beanstalk console, create a Node.js 22 web server environment (single instance, t3.micro) and upload the zip.
3. Set environment properties: `NODE_ENV=production`, `ANTHROPIC_MODEL=claude-sonnet-5-5`, and `ANTHROPIC_API_KEY` (never commit the key).
4. **Continuous deployment (current setup):** AWS CodePipeline `loglens-aiml515-pipeline` watches the `main` branch of this repository through a GitHub App connection. Every `git push` to `main` automatically creates a new application version and deploys it to `loglens-aiml515-env` (no build stage, because `client/dist/` is committed). Manual zip upload is only a fallback.

Production hardening: per-IP rate limit on analyses (`RATE_LIMIT_PER_HOUR`, default 20), Helmet headers configured for an HTTP endpoint, and `trust proxy` for the Elastic Beanstalk proxy.

## API

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Server status and AI mode |
| POST | `/api/logs` | Upload a log (`logFile`, `testCaseId`, `build`, `device`) and triage it |
| GET | `/api/logs?q=&category=` | List / search triaged runs |
| GET | `/api/logs/:id` | Run detail with log excerpt and similar failures |
| PATCH | `/api/logs/:id/review` | Confirm or correct the triage |
| GET | `/api/logs/:id/bug-report` | Draft bug report text |
| DELETE | `/api/logs/:id` | Delete a run |
| GET | `/api/stats` | Dashboard numbers |

## Security and responsible AI

- The API key lives only in `server/.env`, which is git-ignored. It is never sent to the browser.
- Identifiers are redacted **before** storage and before the AI call.
- Uploads are limited to `.log` / `.txt` files, 2 MB maximum. Binary files are rejected.
- All inputs are validated with Zod. Database queries use prepared statements.
- The prompt tells Claude to treat log text as untrusted data (prompt-injection defense). It also tells Claude to cite evidence lines and to report low confidence instead of guessing.
- AI output must match a strict schema. Evidence line numbers are checked against the excerpt.
- Every result is a suggestion: an engineer confirms or corrects it, and those corrections are tracked.
