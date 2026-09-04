# Chef CMS backend (Lambda + S3)

Adding projects and recipes from the live site needs somewhere to put the
photos/videos and the two lists. That's one Lambda and one S3 bucket — same
setup as the Shaila Rizvi studio CMS, no database, no containers.

```
Browser ──1── POST /api/admin/upload-url ──► Lambda ──► presigned S3 URL
        ──2── PUT photo/video bytes ───────────────────► S3  (direct, no size cap)
        ──3── POST /api/admin/{projects,recipes} ─► Lambda ──► s3://…/data/*.json
Visitors ───── GET data/projects.json + data/recipes.json ──► S3  (no Lambda, no cold start)
```

Files go browser→S3 directly, so Lambda's 6 MB request limit never applies —
that's what makes recipe **videos** workable.

## One-time setup

You need the AWS CLI signed in (`aws configure`) with rights to create an S3
bucket, an IAM role, and a Lambda. If your IAM user isn't an administrator,
attach [`deploy-policy.json`](deploy-policy.json) to it first — it grants
exactly these actions and nothing else. Replace `<YOUR_ACCOUNT_ID>` in it with
your AWS account ID (`aws sts get-caller-identity --query Account --output text`).
The ARNs are pinned to the default bucket/role/function names, so edit those too
if you change `BUCKET`.

```bash
AWS_REGION=us-east-1 \
BUCKET=zahir-khan-cms \
SITE_ORIGIN=https://www.chefzahirkhan.com \
ADMIN_PASSWORD='choose-a-strong-password' \
./infra/deploy.sh
```

`SITE_ORIGIN` is a comma-separated list of the exact origins the site is served
from — it's baked into the S3 CORS rule and the Function URL CORS rule, and
requests from anywhere else are rejected by the browser. `localhost:5173` is
always allowed alongside them.

The script is safe to re-run; use it to ship code changes to the Lambda too.
Re-running without `ADMIN_PASSWORD` keeps the existing password. It seeds
`data/projects.json` and `data/recipes.json` from the JSON files in `public/`
the first time, and leaves them alone after that.

## Then wire the site to it

The script prints an API URL and a media URL. Put them in
[`public/config.js`](../public/config.js):

```js
window.ZK_CONFIG = {
  apiBase: 'https://xxxxxxxx.lambda-url.us-east-1.on.aws',
  mediaBase: 'https://zahir-khan-cms.s3.us-east-1.amazonaws.com',
}
```

Note: deleting and recreating the Function URL assigns a **new** hostname, so
if you ever do that, update `apiBase` to match.

Commit and push — Amplify rebuilds automatically.

## Amplify Console settings

**Rewrites and redirects** — this is a React Router single-page app, so every
route must fall through to `index.html`. Add the rule in
[`amplify-rewrites.json`](amplify-rewrites.json) (a `404 (Rewrite)` of
`/<*>` → `/index.html`).

**Build settings** — [`amplify.yml`](../amplify.yml) in the repo root does
`npm ci && npm run build` and publishes `dist`.

## Changing the password later

```bash
aws lambda update-function-configuration \
  --function-name zahir-cms-api \
  --region us-east-1 \
  --environment "$(aws lambda get-function-configuration \
      --function-name zahir-cms-api --region us-east-1 \
      --query 'Environment' --output json \
    | python3 -c 'import sys,json;e=json.load(sys.stdin);e["Variables"]["ZAHIR_ADMIN_PASSWORD"]="new-password";print(json.dumps(e))')"
```

Everyone's existing sessions stay valid for up to 12 hours. To cut them off
immediately, change `ADMIN_TOKEN_SECRET` in the same call.

## Cost

Well inside the AWS free tier for a personal site: Lambda is only invoked when
someone logs in or publishes, and S3 charges pennies per GB-month. Visitors
read two static JSON files and media straight from S3. Recipe videos are the
only thing that could ever add up — at ~$0.023/GB-month, even 50 videos of
100 MB each is about 11 cents a month.

## Local development

Nothing here is needed for `npm run dev`. With `config.js` left blank on
localhost, the Vite plugin in [`server/recipeAdmin.js`](../server/recipeAdmin.js)
serves the same endpoints and writes into `public/projects/` and
`public/recipes/` instead of S3.

Because both sides implement the same contract, the admin UI has one code path.
