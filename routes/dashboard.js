const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const path = require('node:path');
const MustAuth = require('../middleware/MustAuth');
const Delivery = require("../Models/DeliverSchema");
const Customer = require("../Models/customersSchema");
const User = require("../Models/UserSchema");
const { allowRoles } = require("../middleware/roleAuth");
const logManagerAction = require("../middleware/logManagerAction");
router.use(MustAuth);
router.use(logManagerAction("delivery-route"));

router.get("/", (req, res) => {
    if (req.user?.role === "Delivery-Guy") {
        return res.sendFile(path.join(__dirname, "../public", "deliveries.html"), (err) => {
            if (err) {
                console.error(err);
            }
        });
    }

    return res.sendFile(path.join(__dirname, "../public", "deliveries.html"), (err) => {
        if (err) {
            console.error(err);
        }
    });
});

router.get("/data", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 30;
        const skip = (page - 1) * limit;
        const role = req.user?.role;
        const username = req.user?.username;

        const query = role === "Delivery-Guy" ? { assigned_to_username: username } : {};

        const total = await Delivery.countDocuments(query);
        const deliveries = await Delivery.find(query).sort({ delivery_date: -1 }).skip(skip).limit(limit);

        res.json({
            success: true,
            deliveries,
            role,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalDeliveries: total
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to fetch deliveries." });
    }
});

router.get("/agents", allowRoles(["Owner", "Manager", "Observer"]), async (req, res) => {
    try {
        const agents = await User.find({ role: "Delivery-Guy", is_active: true })
            .sort({ username: 1 })
            .select("user_id username role -_id");

        return res.json({ success: true, agents });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Failed to fetch delivery guys." });
    }
});

router.get("/add", allowRoles(["Owner", "Manager", "Observer"]), (req, res) => {
    res.sendFile(path.join(__dirname, "../public/adddelivery.html"));
});

router.get("/customers-list", allowRoles(["Owner", "Manager", "Observer"]), async (req, res) => {
    try {
        const customers = await Customer.find({}).sort({ customers_name: 1 }).select("customers_name customers_id").lean();
        return res.json({ success: true, customers });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Failed to load customers." });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const wantsJson = req.query.format === "json" || req.headers.accept?.includes("application/json");
        const id = req.params.id;
        const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { delivery_id: parseInt(id, 10) };
        const delivery = await Delivery.findOne(query);

        if (!delivery) {
            if (wantsJson) {
                return res.status(404).json({ success: false, message: "Delivery not found." });
            }
            return res.status(404).send("Delivery not found.");
        }

        const customer = await Customer.findOne({ customers_id: delivery.customer_id });
        const role = req.user?.role;
        const username = req.user?.username;
        const isDeliveryGuy = role === "Delivery-Guy";
        const isDelivered = delivery.delivery_status === "Delivered";
        const isOwnDelivery = !isDeliveryGuy || delivery.assigned_to_username === username;

        if (!isOwnDelivery) {
            if (wantsJson) {
                return res.status(403).json({ success: false, message: "Access denied." });
            }
            return res.status(403).send("Access denied.");
        }

        const restrictedView = isDeliveryGuy && isDelivered;

        if (wantsJson) {
            return res.json({
                success: true,
                delivery,
                customer: restrictedView ? null : customer,
                restrictedView
            });
        }

        res.sendFile(path.join(__dirname, "../public/delivery-details.html"));
    } catch (err) {
        console.error(err);
        if (req.query.format === "json" || req.headers.accept?.includes("application/json")) {
            return res.status(500).json({ success: false, message: "Internal server error." });
        }
        res.status(500).send("Internal Server Error");
    }
});

router.patch("/:id/status", async (req, res) => {
    try {
        const { id } = req.params;
        const { delivery_status, photo } = req.body;
        const role = req.user?.role;
        const username = req.user?.username;

        const allowedStatuses = ["Pending", "Delivered", "Cancelled"];

        if (!allowedStatuses.includes(delivery_status)) {
            return res.status(400).json({ success: false, message: "Invalid delivery status." });
        }

        const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { delivery_id: parseInt(id, 10) };
        if (role === "Delivery-Guy") {
            query.assigned_to_username = username;
        }

        const delivery = await Delivery.findOne(query);

        if (!delivery) {
            return res.status(404).json({ success: false, message: role === "Delivery-Guy" ? "Assigned delivery not found." : "Delivery not found." });
        }

        if (delivery.delivery_status === "Delivered") {
            return res.status(400).json({ success: false, message: "This delivery is already marked as delivered and cannot be changed." });
        }

        if (delivery_status === "Delivered") {
            if (!photo || typeof photo !== "string" || photo.trim() === "") {
                return res.status(400).json({ success: false, message: "A photo is required before marking this delivery as delivered." });
            }
        }

        const updatedDelivery = await Delivery.findOneAndUpdate(
            query,
            {
                delivery_status,
                ...(delivery_status === "Delivered" ? { photo_url: photo, photo_uploaded_at: new Date() } : {})
            },
            { new: true }
        );

        res.json({ success: true, message: "Delivery status updated successfully.", delivery: updatedDelivery });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
});

router.post("/add", allowRoles(["Owner", "Manager", "Observer"]), async (req, res) => {
    try {
        const {
            customer_name,
            customer_id,
            assigned_to_user_id,
            delivery_date,
            diet_preference,
            delivery_status,
            meal_time,
            comments
        } = req.body;

        const deliveryGuy = assigned_to_user_id
            ? await User.findOne({ user_id: Number(assigned_to_user_id), role: "Delivery-Guy", is_active: true })
            : await User.findOne({ role: "Delivery-Guy", is_active: true });

        if (!deliveryGuy) {
            return res.status(400).json({ success: false, message: "Assigned delivery guy is invalid." });
        }

        const customer = customer_id
            ? await Customer.findOne({ customers_id: Number(customer_id) })
            : await Customer.findOne({ customers_name: new RegExp(`^${customer_name.trim()}$`, 'i') });

        if (!customer) {
            return res.status(404).json({ success: false, message: "Customer not found. Please add the customer first." });
        }

        const delivery = await Delivery.create({
            customer_id: customer.customers_id,
            assigned_to_user_id: Number(deliveryGuy.user_id),
            assigned_to_username: deliveryGuy.username,
            delivery_date,
            food: "Combined Meal",
            meal_time: Array.isArray(meal_time) ? meal_time : [],
            delivery_status,
            comments: comments || ""
        });

        res.json({ success: true, message: "Delivery added successfully.", delivery });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;