const mongoose = require("mongoose");

function generateUserId() {
  return Math.floor(100000 + Math.random() * 900000);
}

const userSchema = new mongoose.Schema({
  user_id: {
    type: Number,
    required: true,
    unique: true,
    default: generateUserId
  },

  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },

  password: {
    type: String,
    required: true
  },

  role: {
    type: String,
    enum: [
      "Owner",
      "Manager",
      "Delivery-Guy",
      "Observer"
    ],
    default: "Observer",
    required: true
  },

  created_at: {
    type: Date,
    default: Date.now
  },

  last_login: {
    type: Date,
    default: null
  },

  is_active: {
    type: Boolean,
    default: true
  }
});

module.exports = mongoose.model("User", userSchema);