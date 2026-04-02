const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { ZodError } = require("zod");
const { allowedCorsOrigins } = require("./config/env");
const authRoutes = require("./routes/auth.routes");
const usersRoutes = require("./routes/users.routes");
const adminRoutes = require("./routes/admin.routes");
const electionsRoutes = require("./routes/elections.routes");
const networksRoutes = require("./routes/networks.routes");
const { asyncHandler } = require("./utils/asyncHandler");
const { forwardLocalDemoRpcRequest } = require("./lib/contract");

const app = express();
app.set("trust proxy", true);

function getRpcMethodLabels(body) {
  if (Array.isArray(body)) {
    return body.map((entry) => entry?.method || "unknown");
  }

  if (body && typeof body === "object") {
    return [body.method || "unknown"];
  }

  return ["unknown"];
}

function logRpcBridgeErrors(methodLabels, payload) {
  try {
    const parsedPayload = JSON.parse(payload);
    const responses = Array.isArray(parsedPayload) ? parsedPayload : [parsedPayload];
    const errors = responses.filter((response) => response?.error);

    if (!errors.length) {
      return;
    }

    for (const errorResponse of errors) {
      console.error(`[rpc/local] upstream error for ${methodLabels.join(", ")}:`, errorResponse.error);
    }
  } catch {
    // Preserve the upstream payload exactly as received even if it is not JSON.
  }
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedCorsOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/networks", networksRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/elections", electionsRoutes);
app.post(
  "/rpc/local",
  asyncHandler(async (req, res) => {
    const methodLabels = getRpcMethodLabels(req.body);
    console.log(`[rpc/local] forwarding ${methodLabels.join(", ")}`);

    try {
      const rpcResponse = await forwardLocalDemoRpcRequest(req.body);
      logRpcBridgeErrors(methodLabels, rpcResponse.payload);
      res.status(rpcResponse.status);
      res.set("Content-Type", rpcResponse.contentType);
      res.send(rpcResponse.payload);
    } catch (error) {
      console.error(`[rpc/local] bridge failure for ${methodLabels.join(", ")}:`, error);
      throw error;
    }
  })
);
app.all("/rpc/local", (_req, res) => {
  res.status(405).json({ message: "Use POST for JSON-RPC requests to /rpc/local." });
});

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

  const statusCode = error.statusCode || error.status || 500;
  return res.status(statusCode).json({
    message: error.message || "Internal server error",
    details: error.details,
  });
});

module.exports = app;
