const express = require("express");
const path = require("node:path");

const MustAuth = require("../middleware/MustAuth");
const { allowRoles } = require("../middleware/roleAuth");
const Log = require("../Models/LogSchema");

const router = express.Router();

router.use(MustAuth);

router.get("/", allowRoles(["Owner", "Manager"]), (req, res) => {
  res.sendFile(path.join(__dirname, "../public/logs.html"));
});

router.get("/data", allowRoles(["Owner", "Manager"]), async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = 30;
    const skip = (page - 1) * limit;

    const total = await Log.countDocuments({});
    const logs = await Log.find({})
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    return res.json({
      success: true,
      logs,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalLogs: total
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch logs."
    });
  }
});

module.exports = router;
