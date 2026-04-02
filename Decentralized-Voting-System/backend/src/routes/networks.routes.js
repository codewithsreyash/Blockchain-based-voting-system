const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { getNetworkCatalog } = require("../lib/contract");

const router = express.Router();

function getPublicBaseUrl(req) {
  const forwardedProtocol = req.get("x-forwarded-proto");
  const protocol = forwardedProtocol ? forwardedProtocol.split(",")[0].trim() : req.protocol;
  return `${protocol}://${req.get("host")}`;
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(getNetworkCatalog(getPublicBaseUrl(req)));
  })
);

module.exports = router;
