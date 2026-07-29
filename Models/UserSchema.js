const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  user_id: {
    type: Number,
    required: true,
    unique: true
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
  },

  photo_url: {
    type: String,
    default: ""
  }
});

module.exports = mongoose.model("User", userSchema);