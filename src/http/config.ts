export const port = process.env.PORT || 3000;

export const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim())
  : [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "https://dossier-ai.azurewebsites.net",
      "https://dossier.worksforme.tech"
    ];
