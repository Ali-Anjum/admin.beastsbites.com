const mongoose = require("mongoose");

const logSchema = new mongoose.Schema({
  actor_username: {
    type: String,
    required: true
  },
  actor_role: {
    type: String,
    required: true
  },
  method: {
    type: String,
    required: true
  },
  route: {
    type: String,
    required: true
  },
  action: {
    type: String,
    default: ""
  },
  payload: {
    type: Object,
    default: {}
  },
  status_code: {
    type: Number,
    default: 200
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Log", logSchema);
