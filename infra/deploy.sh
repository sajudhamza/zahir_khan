#!/usr/bin/env bash
#
# Creates (or updates) everything the chef CMS needs:
#   - an S3 bucket for photos/videos + projects.json + recipes.json
#   - an IAM role for the Lambda
#   - the Lambda itself, exposed on a public Function URL
#
# Re-running is safe: every step is create-or-update.
#
#   AWS_REGION=us-east-1 \
#   BUCKET=zahir-khan-cms \
#   SITE_ORIGIN=https://www.chefzahirkhan.com \
#   ADMIN_PASSWORD='pick-a-strong-one' \
#   ./infra/deploy.sh
#
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
BUCKET="${BUCKET:-zahir-khan-cms}"
FUNCTION_NAME="${FUNCTION_NAME:-zahir-cms-api}"
ROLE_NAME="${ROLE_NAME:-${FUNCTION_NAME}-role}"
SITE_ORIGIN="${SITE_ORIGIN:-*}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
BUILD="$HERE/.build"

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

command -v aws >/dev/null || { echo "aws CLI not found. Install it first."; exit 1; }
command -v node >/dev/null || { echo "node not found."; exit 1; }

# SITE_ORIGIN accepts a comma-separated list; localhost is always included.
ORIGINS_JSON="$(node -e "
  const given = String(process.argv[1] || '*').split(',').map(s => s.trim()).filter(Boolean);
  const all = [...new Set([...given, 'http://localhost:5173'])];
  process.stdout.write(JSON.stringify(all));
" "$SITE_ORIGIN")"

if ! ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text 2>&1)"; then
  echo "Could not authenticate with AWS:" >&2
  echo "  $ACCOUNT_ID" >&2
  echo >&2
  echo "Run 'aws configure' with a valid access key, then try again." >&2
  exit 1
fi
echo "AWS account: $ACCOUNT_ID"
MEDIA_BASE="https://${BUCKET}.s3.${REGION}.amazonaws.com"

# ---------------------------------------------------------------- 1. bucket
say "S3 bucket: $BUCKET ($REGION)"
# Bucket names are globally unique. A 403 means it exists in someone else's
# account, which is a different problem from "doesn't exist yet".
HEAD_ERR="$(aws s3api head-bucket --bucket "$BUCKET" 2>&1 >/dev/null)" && HEAD_OK=1 || HEAD_OK=0
if [ "$HEAD_OK" = "0" ] && echo "$HEAD_ERR" | grep -q '403'; then
  echo "Bucket name '$BUCKET' is already taken by another AWS account." >&2
  echo "Re-run with a different one, e.g. BUCKET=${BUCKET}-$(node -e "process.stdout.write(require('crypto').randomBytes(3).toString('hex'))")" >&2
  exit 1
fi
if [ "$HEAD_OK" = "0" ]; then
  if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION"
  else
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
      --create-bucket-configuration "LocationConstraint=$REGION"
  fi
  echo "created"
else
  echo "already exists"
fi

# Media and the two JSON files are served straight to browsers, so objects
# under media/ and data/ must be publicly readable. Nothing else is.
aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false"

aws s3api put-bucket-policy --bucket "$BUCKET" --policy "$(cat <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadMedia",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": ["arn:aws:s3:::$BUCKET/media/*", "arn:aws:s3:::$BUCKET/data/*"]
  }]
}
POLICY
)"

# Browsers PUT photo/video bytes directly to S3 using a presigned URL.
aws s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration "$(cat <<CORS
{
  "CORSRules": [{
    "AllowedOrigins": $ORIGINS_JSON,
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }]
}
CORS
)"
echo "policy + CORS applied"

# ------------------------------------------------------------------ 2. seed
say "Seeding data/projects.json + data/recipes.json"
seed_json() {
  local key="$1" src="$2"
  if aws s3api head-object --bucket "$BUCKET" --key "$key" >/dev/null 2>&1; then
    echo "$key already present — left untouched"
  else
    aws s3 cp "$src" "s3://$BUCKET/$key" \
      --content-type application/json \
      --cache-control "no-cache, max-age=0, must-revalidate"
    echo "$key seeded from $(basename "$src")"
  fi
}
seed_json data/projects.json "$ROOT/public/projects/projects.json"
seed_json data/recipes.json "$ROOT/public/recipes/recipes.json"

# ------------------------------------------------------------------ 3. role
say "IAM role: $ROLE_NAME"
if ! aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  aws iam create-role --role-name "$ROLE_NAME" --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }' >/dev/null
  echo "created"
else
  echo "already exists"
fi

aws iam attach-role-policy --role-name "$ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

aws iam put-role-policy --role-name "$ROLE_NAME" --policy-name "${FUNCTION_NAME}-s3" \
  --policy-document "$(cat <<IAM
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::$BUCKET/*"
    },
    {
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::$BUCKET"
    }
  ]
}
IAM
)"
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"
echo "$ROLE_ARN"

# ---------------------------------------------------------------- 4. bundle
say "Bundling Lambda"
rm -rf "$BUILD"
mkdir -p "$BUILD"
cp "$HERE/lambda/index.mjs" "$HERE/lambda/package.json" "$BUILD/"
( cd "$BUILD" && npm install --omit=dev --no-audit --no-fund --silent )
( cd "$BUILD" && zip -qr function.zip . -x '*.map' )
echo "$(du -h "$BUILD/function.zip" | cut -f1) zip"

# ---------------------------------------------------------------- 5. lambda
say "Lambda: $FUNCTION_NAME"
if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" >/dev/null 2>&1; then
  aws lambda update-function-code --function-name "$FUNCTION_NAME" --region "$REGION" \
    --zip-file "fileb://$BUILD/function.zip" >/dev/null
  aws lambda wait function-updated --function-name "$FUNCTION_NAME" --region "$REGION"
  echo "code updated"
else
  echo "creating (waiting ~10s for the new role to propagate)"
  sleep 10
  aws lambda create-function --function-name "$FUNCTION_NAME" --region "$REGION" \
    --runtime nodejs20.x --handler index.handler --role "$ROLE_ARN" \
    --timeout 30 --memory-size 512 \
    --zip-file "fileb://$BUILD/function.zip" >/dev/null
  aws lambda wait function-active --function-name "$FUNCTION_NAME" --region "$REGION"
fi

# Keep an existing password/secret unless a new one was passed in.
CURRENT_ENV="$(aws lambda get-function-configuration --function-name "$FUNCTION_NAME" \
  --region "$REGION" --query 'Environment.Variables' --output json 2>/dev/null || echo '{}')"

TOKEN_SECRET="$(node -e "
  const cur = JSON.parse(process.argv[1] || '{}') || {};
  process.stdout.write(cur.ADMIN_TOKEN_SECRET || require('crypto').randomBytes(32).toString('hex'));
" "$CURRENT_ENV")"

RESOLVED_PASSWORD="$ADMIN_PASSWORD"
if [ -z "$RESOLVED_PASSWORD" ]; then
  RESOLVED_PASSWORD="$(node -e "
    const cur = JSON.parse(process.argv[1] || '{}') || {};
    process.stdout.write(cur.ZAHIR_ADMIN_PASSWORD || '');
  " "$CURRENT_ENV")"
fi
if [ -z "$RESOLVED_PASSWORD" ]; then
  echo "ADMIN_PASSWORD is required the first time you deploy." >&2
  exit 1
fi

# Built as JSON so passwords containing commas or "=" survive intact.
ENV_JSON="$(node -e "
  process.stdout.write(JSON.stringify({Variables: {
    BUCKET: process.argv[1],
    PUBLIC_MEDIA_BASE: process.argv[2],
    ZAHIR_ADMIN_PASSWORD: process.argv[3],
    ADMIN_TOKEN_SECRET: process.argv[4],
  }}));
" "$BUCKET" "$MEDIA_BASE" "$RESOLVED_PASSWORD" "$TOKEN_SECRET")"

aws lambda update-function-configuration --function-name "$FUNCTION_NAME" --region "$REGION" \
  --environment "$ENV_JSON" >/dev/null
aws lambda wait function-updated --function-name "$FUNCTION_NAME" --region "$REGION"
echo "config updated"

# ------------------------------------------------------------ 6. public URL
say "Function URL"
CORS_CONFIG="$(node -e "
  process.stdout.write(JSON.stringify({
    AllowOrigins: JSON.parse(process.argv[1]),
    AllowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    AllowHeaders: ['content-type', 'authorization'],
    MaxAge: 3600,
  }));
" "$ORIGINS_JSON")"
if aws lambda get-function-url-config --function-name "$FUNCTION_NAME" --region "$REGION" >/dev/null 2>&1; then
  aws lambda update-function-url-config --function-name "$FUNCTION_NAME" --region "$REGION" \
    --auth-type NONE --cors "$CORS_CONFIG" >/dev/null
else
  aws lambda create-function-url-config --function-name "$FUNCTION_NAME" --region "$REGION" \
    --auth-type NONE --cors "$CORS_CONFIG" >/dev/null
fi

# Since October 2025 a public function URL needs BOTH statements. With only
# the first, every request comes back 403 AccessDeniedException.
# "already exists" is the only error worth ignoring here.
add_perm() {
  local sid="$1"; shift
  local out
  if out="$(aws lambda add-permission --function-name "$FUNCTION_NAME" --region "$REGION" \
    --statement-id "$sid" --principal '*' "$@" 2>&1)"; then
    echo "  granted $sid"
  elif echo "$out" | grep -q 'ResourceConflictException'; then
    echo "  $sid already present"
  else
    echo "$out" >&2
    exit 1
  fi
}

add_perm FunctionURLAllowPublicAccess --action lambda:InvokeFunctionUrl --function-url-auth-type NONE
# InvokedViaFunctionUrl keeps this from becoming a general invoke grant.
add_perm UrlPolicyInvokeFunction --action lambda:InvokeFunction --invoked-via-function-url

API_URL="$(aws lambda get-function-url-config --function-name "$FUNCTION_NAME" \
  --region "$REGION" --query FunctionUrl --output text)"
API_URL="${API_URL%/}"

say "Checking the deployed endpoint"
for attempt in 1 2 3; do
  CODE="$(curl -s -o /dev/null -w '%{http_code}' "${API_URL}/api/projects" || echo 000)"
  [ "$CODE" = "200" ] && break
  echo "  attempt $attempt: HTTP $CODE — retrying"
  sleep 5
done
if [ "$CODE" = "200" ]; then
  echo "  HTTP 200 — API is live"
else
  echo "  WARNING: endpoint returned HTTP $CODE, not 200." >&2
  echo "  Check: aws lambda get-policy --function-name $FUNCTION_NAME --region $REGION" >&2
fi

say "Done"
cat <<SUMMARY

Put these two values in public/config.js and redeploy the site:

  window.ZK_CONFIG = {
    apiBase: '$API_URL',
    mediaBase: '$MEDIA_BASE',
  }

Admin password: ${ADMIN_PASSWORD:+(the one you just passed in)}${ADMIN_PASSWORD:-(unchanged)}

SUMMARY
