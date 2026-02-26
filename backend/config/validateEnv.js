const requiredEnvVars = [
  "JWT_SECRET",
  "SUPABASE_URL",
  "SUPABASE_KEY",
  "NODE_ENV"
];

requiredEnvVars.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required env variable: ${key}`);
  }
});

// Validate JWT_SECRET length (Min 32 characters for security)
if (process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters long for security.");
}

console.log("✅ Environment validation successful.");
