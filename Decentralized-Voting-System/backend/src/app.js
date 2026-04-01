const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { ZodError } = require("zod");
const { corsOrigin, frontendUrl } = require("./config/env");
const authRoutes = require("./routes/auth.routes");
const usersRoutes = require("./routes/users.routes");
const adminRoutes = require("./routes/admin.routes");
const electionsRoutes = require("./routes/elections.routes");

const app = express();
const allowedOrigins = Array.from(
  new Set(
    [frontendUrl, corsOrigin, "http://localhost:3000"]
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter(Boolean)
  )
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/elections", electionsRoutes);

app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((error, _req, res, _next) => {
  if (error instanceof ZodError) {
    return res.status(400).json({
      message: "Validation failed",
      details: error.flatten(),
    });
  }

  const statusCode = error.statusCode || 500;
  return res.status(statusCode).json({
    message: error.message || "Internal server error",
    details: error.details,
  });
});

module.exports = app;
