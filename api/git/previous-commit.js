// /api/git/previous-commit.js
// Returns the deployed git commit hash plus an approximate build/start time so the
// Data Pipeline page (public/bulk-simple.html) can show a version banner, mirroring
// the GAIO Audit dashboard. Commit hash comes from VERCEL_GIT_COMMIT_SHA, which Vercel
// sets automatically on every deployment (no extra config required).

// Captured once per serverless instance (≈ deploy/cold-start time).
const INSTANCE_STARTED_AT = new Date().toISOString();

export default function handler(req, res) {
  const fullHash = process.env.VERCEL_GIT_COMMIT_SHA || null;
  const commitHash = fullHash ? fullHash.substring(0, 7) : 'unknown';

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    status: 'ok',
    commitHash,
    fullHash,
    deploymentTimestamp: INSTANCE_STARTED_AT,
    source: fullHash ? 'vercel_env' : 'fallback'
  });
}
