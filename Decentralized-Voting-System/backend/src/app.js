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

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedCorsOrigins.includes(origin)) {
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

app.use("/api/networks", networksRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/elections", electionsRoutes);
app.post(
  "/rpc/local",
  asyncHandler(async (req, res) => {
    const rpcResponse = await forwardLocalDemoRpcRequest(req.body);
    res.status(rpcResponse.status);
    res.set("Content-Type", rpcResponse.contentType);
    res.send(rpcResponse.payload);
  })
);

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
