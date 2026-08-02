const express = require("express");
const router = express.Router();
const path = require("path");

const MustAuth = require("../middleware/MustAuth");
const Customer = require("../Models/customersSchema");
const Delivery = require("../Models/DeliverSchema");
const Subscription = require("../Models/SubscriptionSchema");
const User = require("../Models/UserSchema");
const { allowRoles } = require("../middleware/roleAuth");
const logManagerAction = require("../middleware/logManagerAction");
const { validateCustomerPayload, getCustomerStatus, getDubaiDateKey } = require("../helpers/businessRules");
const { syncCustomerStatuses } = require("../helpers/deliveryScheduler");
router.use(MustAuth);
router.use(allowRoles(["Owner", "Manager", "Observer"]));
router.use(logManagerAction("customers-route"));

function normalizeActiveTillValue(activeTill) {
    return getDubaiDateKey(activeTill);
}

function getSubscriptionDaysFromActiveTill(activeTill) {
    const todayKey = getDubaiDateKey(new Date());
    const activeTillKey = normalizeActiveTillValue(activeTill);

    if (!todayKey || !activeTillKey) {
        return 30;
    }

    const todayDate = new Date(`${todayKey}T00:00:00Z`);
    const activeTillDate = new Date(`${activeTillKey}T23:59:59.999Z`);
    const diff = Math.ceil((activeTillDate.getTime() - todayDate.getTime()) / 86400000);

    return Math.max(1, diff);
}

// ==============================
// Customers Page
// ==============================
router.get("/",  (req, res) => {

    if (0) {
        return res.status(403).send("Access Denied");
    }

    res.sendFile(path.join(__dirname, "../public/customers.html"));

});

// ==============================
// Customers Data
// ==============================
router.get("/data",  async (req, res) => {

    try {

        await syncCustomerStatuses();

        if (0) {
            return res.status(403).json({
                success: false,
                message: "Access Denied"
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = 30;
        const skip = (page - 1) * limit;

        const rawSearch = (req.query.search || "").trim();
        const sanitizedSearch = rawSearch.replace(/[^a-zA-Z0-9\s]/g, "").trim();

        let query = {};

        if (sanitizedSearch !== "") {
            const escapedSearch = sanitizedSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            query = {
                $or: [
                    {
                        customers_name: {
                            $regex: escapedSearch,
                            $options: "i"
                        }
                    },
                    {
                        phone_number: {
                            $regex: escapedSearch,
                            $options: "i"
                        }
                    },
                    {
                        location: {
                            $regex: escapedSearch,
                            $options: "i"
                        }
                    }
                ]
            };
        }

        const total = await Customer.countDocuments(query);

        const customers = await Customer.find(query)
            .sort({ customers_id: 1 })
            .skip(skip)
            .limit(limit);

        res.status(200).json({
            success: true,
            customers,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalCustomers: total,
            role: req.user?.role || "Observer"
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });

    }

});

// ==============================
// Add Customer Page
// ==============================
router.get("/add",  (req, res) => {

    if (0) {
        return res.status(403).send("Access Denied");
    }

    res.sendFile(path.join(__dirname, "../public/add-customer.html"));

});

// ==============================
// Delivery Guys List (for the Add Customer form dropdown)
// ==============================
router.get("/delivery-guys",  async (req, res) => {

    try {

        const guys = await User.find(
            { role: "Delivery-Guy", is_active: true },
            "username"
        ).sort({ username: 1 });

        res.status(200).json({
            success: true,
            deliveryGuys: guys.map((u) => u.username)
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });

    }

});

// ==============================
// Add Customer
// ==============================
router.post("/add",  async (req, res) => {

    try {

        if (0) {
            return res.status(403).json({
                success: false,
                message: "Access Denied"
            });
        }

        const {
            customers_name,
            phone_number,
            location,
            diet_preference,
            active_till,
            meal_time,
            delivery_guy,
            comments
        } = req.body;

        const validation = validateCustomerPayload({
            customers_name,
            phone_number,
            location,
            diet_preference,
            active_till,
            meal_time,
            delivery_guy
        });

        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                message: validation.errors.join(" ")
            });
        }

        const normalizedActiveTill = validation.activeTill;

        if (!["Veg", "Non-Veg"].includes(diet_preference)) {
            return res.status(400).json({
                success: false,
                message: "diet_preference must be Veg or Non-Veg."
            });
        }

        const allowedMealTimes = ["Breakfast", "Lunch", "Dinner"];
        const validMealTimes = meal_time.every((m) => allowedMealTimes.includes(m));

        if (!validMealTimes) {
            return res.status(400).json({
                success: false,
                message: "meal_time can only contain Breakfast, Lunch and/or Dinner."
            });
        }

        // Confirm the chosen delivery guy is a real, active Delivery-Guy user
        const deliveryGuyExists = await User.exists({
            username: delivery_guy,
            role: "Delivery-Guy",
            is_active: true
        });

        if (!deliveryGuyExists) {
            return res.status(400).json({
                success: false,
                message: "Selected delivery guy is invalid."
            });
        }

        // Check duplicate phone number
        const existingPhone = await Customer.findOne({
            phone_number: phone_number.trim()
        });

        if (existingPhone) {
            return res.status(400).json({
                success: false,
                message: "Phone number already exists."
            });
        }

        // customers_id is auto-generated randomly by the schema default.
        // On the rare chance of a collision (duplicate key), retry a few times.
        let customer;
        let attempts = 0;

        while (!customer) {
            try {
               customer = await Customer.create({
                customers_id: Math.floor(100000 + Math.random() * 900000),
                customers_name: customers_name.trim(),
                phone_number: phone_number.trim(),
                location: location.trim(),
                diet_preference,
                active_till: normalizedActiveTill,
                status: getCustomerStatus(normalizedActiveTill),
                meal_time,
                delivery_guy,
                comments: (comments || "").trim()
                });
            } catch (createErr) {
                attempts += 1;
                const isDuplicateId = createErr.code === 11000 && createErr.keyPattern?.customers_id;

                if (!isDuplicateId || attempts >= 5) {
                    throw createErr;
                }
                // loop again — a fresh random customers_id will be generated
            }
        }

        const subscriptionStartDate = new Date();
        const subscriptionStopDate = new Date(`${normalizedActiveTill}T23:59:59.999Z`);
        const subscriptionDays = getSubscriptionDaysFromActiveTill(normalizedActiveTill);

        let subscription;
        let subscriptionAttempts = 0;

        while (!subscription) {
            try {
                subscription = await Subscription.create({
                    subscription_id: Math.floor(100000 + Math.random() * 900000),
                    client_id: customer.customers_id,
                    start_date: subscriptionStartDate,
                    stop_date: subscriptionStopDate,
                    subscription_type: "Daily",
                    active_for_days: subscriptionDays,
                    food_preference: diet_preference,
                    status: "Active"
                });
            } catch (subscriptionErr) {
                subscriptionAttempts += 1;
                const isDuplicateId = subscriptionErr.code === 11000 && subscriptionErr.keyPattern?.subscription_id;

                if (!isDuplicateId || subscriptionAttempts >= 5) {
                    throw subscriptionErr;
                }
            }
        }

        res.status(201).json({
            success: true,
            message: "Customer added successfully.",
            customer,
            subscription
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });

    }

});;

// ==============================
// Get Customer By ID (detail view)
// ==============================
router.get("/:id", async (req, res) => {

    try {
        await syncCustomerStatuses();
        const customerId = parseInt(req.params.id, 10);
        const wantsJson = req.query.format === "json" || req.headers.accept?.includes("application/json");

        const customer = await Customer.findOne({
            customers_id: customerId
        });

        if (!customer) {
            if (wantsJson) {
                return res.status(404).json({ success: false, message: "Customer not found." });
            }
            return res.status(404).send("Customer not found.");
        }

        const deliveries = await Delivery.find({ customer_id: customer.customers_id }).sort({ delivery_date: -1 });
        const subscription = await Subscription.findOne({ client_id: customer.customers_id });

        if (wantsJson) {
            return res.json({ success: true, customer, deliveries, subscription });
        }

        res.sendFile(path.join(__dirname, "../public/customer-details.html"));

    } catch (err) {
        console.error(err);

        if (req.query.format === "json" || req.headers.accept?.includes("application/json")) {
            return res.status(500).json({ success: false, message: "Internal Server Error" });
        }

        res.status(500).send("Internal Server Error");
    }

});

router.patch("/:id", async (req, res) => {
    try {
        const customerId = parseInt(req.params.id, 10);
        const customer = await Customer.findOne({ customers_id: customerId });

        if (!customer) {
            return res.status(404).json({ success: false, message: "Customer not found." });
        }

        const { customers_name, phone_number, location, diet_preference, active_till, meal_time, delivery_guy, comments } = req.body;

        if (!customers_name || !phone_number || !location || !diet_preference || !active_till || !Array.isArray(meal_time) || meal_time.length === 0 || !delivery_guy) {
            return res.status(400).json({ success: false, message: "Customer name, phone number, veg/non-veg, active till, at least one meal time and delivery guy are required." });
        }

        const normalizedActiveTill = normalizeActiveTillValue(active_till);

        if (!normalizedActiveTill) {
            return res.status(400).json({ success: false, message: "active_till must be a valid date." });
        }

        if (!["Veg", "Non-Veg"].includes(diet_preference)) {
            return res.status(400).json({ success: false, message: "diet_preference must be Veg or Non-Veg." });
        }

        const allowedMealTimes = ["Breakfast", "Lunch", "Dinner"];
        const validMealTimes = meal_time.every((m) => allowedMealTimes.includes(m));

        if (!validMealTimes) {
            return res.status(400).json({ success: false, message: "meal_time can only contain Breakfast, Lunch and/or Dinner." });
        }

        const deliveryGuyExists = await User.exists({ username: delivery_guy, role: "Delivery-Guy", is_active: true });

        if (!deliveryGuyExists) {
            return res.status(400).json({ success: false, message: "Selected delivery guy is invalid." });
        }

        const normalizedPhone = phone_number.trim();
        const duplicatePhone = await Customer.findOne({ phone_number: normalizedPhone, customers_id: { $ne: customer.customers_id } });

        if (duplicatePhone) {
            return res.status(400).json({ success: false, message: "Phone number already exists." });
        }

        const updatedCustomer = await Customer.findOneAndUpdate(
            { customers_id: customerId },
            {
                $set: {
                    customers_name: customers_name.trim(),
                    phone_number: normalizedPhone,
                    location: (location || "").trim(),
                    diet_preference,
                    active_till: normalizedActiveTill,
                    status: getCustomerStatus(normalizedActiveTill),
                    meal_time,
                    delivery_guy,
                    comments: (comments || "").trim()
                }
            },
            { new: true }
        );

        const updatedSubscriptionStopDate = new Date(`${normalizedActiveTill}T23:59:59.999Z`);
        const updatedSubscriptionDays = getSubscriptionDaysFromActiveTill(normalizedActiveTill);

        await Subscription.findOneAndUpdate(
            { client_id: customer.customers_id },
            {
                $set: {
                    stop_date: updatedSubscriptionStopDate,
                    active_for_days: updatedSubscriptionDays,
                    status: "Active"
                }
            }
        );

        res.json({ success: true, message: "Customer updated successfully.", customer: updatedCustomer });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});

module.exports = router;