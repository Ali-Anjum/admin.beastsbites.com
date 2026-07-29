const mongoose = require("mongoose");

const customersSchema = new mongoose.Schema({
    customers_id: {
        type: Number,
        required: true,
        unique: false,
        default: () => Math.floor(100000 + Math.random() * 900000) // random 6-digit id
    },

    customers_name: {
        type: String,
        required: true
    },

    phone_number: {
        type: String,
        required: true
    },

    location: {
        type: String,
        required: true,
        default: ""
    },

    diet_preference: {
        type: String,
        enum: ["Veg", "Non-Veg"],
        required: true
    },

    plan: {
        type: String,
        enum: ["Trial", "Weekly", "Monthly"],
        required: true
    },

    active_for_days: {
        type: Number,
        enum: [7, 20, 30],
        required: true,
        default: 30
    },

    meal_time: {
        type: [String],
        enum: ["Breakfast", "Lunch", "Dinner"],
        required: true,
        validate: {
            validator: function (arr) {
                return Array.isArray(arr) && arr.length > 0;
            },
            message: "At least one meal time (Breakfast, Lunch, Dinner) is required."
        }
    },

    delivery_guy: {
        type: String,
        required: true
    },

    comments: {
        type: String,
        default: ""
    },

    purchase_proof: {
        type: String,
        default: "",
        description: "Optional URL or file reference to purchase proof/receipt"
    }
}, {
    timestamps: true
});

module.exports = mongoose.model("Customer", customersSchema);