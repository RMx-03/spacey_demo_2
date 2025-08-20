// Centralized configuration helper

function parseOrigins(envValue) {
  if (!envValue || typeof envValue !== 'string') return [];
  return envValue
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

const nodeEnv = process.env.NODE_ENV || 'development';
const port = Number(process.env.PORT || 5000);
const corsOrigins = parseOrigins(process.env.CORS_ORIGINS);
const enableOrchestratorTest = String(process.env.ENABLE_ORCHESTRATOR_TEST || '').toLowerCase() === 'true';

module.exports = {
  nodeEnv,
  port,
  corsOrigins,
  enableOrchestratorTest,
};


