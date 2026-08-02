const express = require("express");
const path = require("node:path");
const bcrypt = require("bcrypt");

const MustAuth = require("../middleware/MustAuth");
const { allowRoles } = require("../middleware/roleAuth");
const logManagerAction = require("../middleware/logManagerAction");
const User = require("../Models/UserSchema");

const router = express.Router();

router.use(MustAuth);
router.use(allowRoles(["Owner", "Manager"]));
router.use(logManagerAction("users-route"));

router.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/users.html"));
});

router.get("/data", async (req, res) => {
  try {
    const users = await User.find({ username: { $ne: "buttbros" } })
      .sort({ username: 1 })
      .select("username role is_active last_login created_at -_id")
      .lean();

    return res.json({
      success: true,
      users,
      capabilities: {
        canManageUsers: req.user?.role === "Owner"
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Failed to load users."
    });
  }
});

router.post("/add", allowRoles(["Owner"]), async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const allowedRoles = ["Owner", "Manager", "Delivery-Guy", "Observer"];

    if (!username || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "username, password and role are required."
      });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role."
      });
    }

    const existingByUsername = await User.findOne({ username: username.trim() });
    if (existingByUsername) {
      return res.status(400).json({
        success: false,
        message: "username already exists."
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const createdUser = await User.create({
      username: username.trim(),
      password: hashedPassword,
      role,
      is_active: true
    });

    return res.status(201).json({
      success: true,
      message: "User created successfully.",
      user: {
        username: createdUser.username,
        role: createdUser.role,
        is_active: createdUser.is_active
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Failed to create user."
    });
  }
});

router.post("/password", allowRoles(["Owner"]), async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "username and password are required."
      });
    }

    const targetUser = await User.findOne({ username: username.trim() });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.updateOne({ _id: targetUser._id }, { password: hashedPassword });

    return res.json({
      success: true,
      message: "Password updated successfully."
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Failed to update password."
    });
  }
});

module.exports = router;