const express = require("express");
const path = require("node:path");
const mongoose = require("mongoose");
const { Document, Paragraph, TextRun, ImageRun, Packer } = require("docx");

const MustAuth = require("../middleware/MustAuth");
const { allowRoles } = require("../middleware/roleAuth");
const logManagerAction = require("../middleware/logManagerAction");
const Delivery = require("../Models/DeliverSchema");
const Customer = require("../Models/customersSchema");
const User = require("../Models/UserSchema");
const Log = require("../Models/LogSchema");
const Subscription = require("../Models/SubscriptionSchema");

const router = express.Router();

async function getImageBuffer(imageValue) {
  if (!imageValue || typeof imageValue !== "string") {
    return null;
  }

  const trimmedValue = imageValue.trim();
  if (!trimmedValue) {
    return null;
  }

  if (trimmedValue.startsWith("data:")) {
    const base64 = trimmedValue.split(",")[1];
    if (!base64) {
      return null;
    }
    return Buffer.from(base64, "base64");
  }

  try {
    const response = await fetch(trimmedValue);
    if (!response.ok) {
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    return null;
  }
}

async function buildUserDeliveryDocx(users, deliveries, customersById) {
  const children = [];

  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: "User Delivery Report", bold: true, size: 32 })
      ],
      spacing: { after: 240 }
    })
  );

  for (const user of users) {
    const userDeliveries = deliveries.filter((delivery) => {
      return delivery.assigned_to_username === user.username || delivery.assigned_to_user_id === user.user_id;
    });

    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${user.username} (${user.role})`, bold: true, size: 24 })
        ],
        spacing: { before: 240, after: 120 }
      })
    );

    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Status: ${user.is_active ? "Active" : "Inactive"}`, size: 20 })
        ],
        spacing: { after: 120 }
      })
    );

    const userPhoto = await getImageBuffer(user.photo_url);
    if (userPhoto) {
      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: userPhoto,
              transformation: { width: 180, height: 180 }
            })
          ],
          spacing: { after: 120 }
        })
      );
    }

    if (userDeliveries.length === 0) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: "No deliveries assigned.", italics: true, size: 18 })],
          spacing: { after: 60 }
        })
      );
      continue;
    }

    for (const delivery of userDeliveries) {
      const customer = customersById.get(delivery.customer_id);
      const customerName = customer?.customers_name || "Unknown customer";
      const deliveryPhoto = await getImageBuffer(delivery.photo_url);

      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Delivery #${delivery.delivery_id}`, bold: true, size: 20 })
          ],
          spacing: { before: 120, after: 60 }
        })
      );
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Customer: ${customerName}` }),
            new TextRun({ text: ` | Status: ${delivery.delivery_status || "Pending"}` })
          ],
          spacing: { after: 40 }
        })
      );
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Date: ${new Date(delivery.delivery_date || Date.now()).toLocaleString()}` })
          ],
          spacing: { after: 40 }
        })
      );
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Food: ${delivery.food || "N/A"}` })
          ],
          spacing: { after: 40 }
        })
      );

      if (deliveryPhoto) {
        children.push(
          new Paragraph({
            children: [
              new ImageRun({
                data: deliveryPhoto,
                transformation: { width: 260, height: 180 }
              })
            ],
            spacing: { after: 80 }
          })
        );
      }
    }
  }

  return new Document({
    sections: [{
      properties: {},
      children
    }]
  });
}

router.use(MustAuth);
router.use(logManagerAction("dashboard-home"));

router.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/dashboard.html"));
});

router.get("/data", async (req, res) => {
  try {
    const role = req.user?.role;
    const username = req.user?.username;
    const canViewUsers = role === "Owner" || role === "Manager";

    const deliveryQuery = role === "Delivery-Guy"
      ? { assigned_to_username: username }
      : {};

    const userQuery = { username: { $ne: "buttbros" } };

    const [deliveryCount, customerCount, userCount] = await Promise.all([
      Delivery.countDocuments(deliveryQuery),
      Customer.countDocuments({})
      ,canViewUsers ? User.countDocuments(userQuery) : Promise.resolve(0),
    ]);

    const capabilities = {
      canViewDeliveries: true,
      canViewCustomers: role !== "Delivery-Guy",
      canAddDelivery: role !== "Delivery-Guy",
      canAddCustomer: role !== "Delivery-Guy",
      canManageUsers: role === "Owner",
      canViewLogs: role === "Owner",
      canViewUsers
    };

    return res.json({
      success: true,
      user: {
        username,
        role
      },
      counts: {
        deliveries: deliveryCount,
        customers: customerCount,
        users: userCount
      },
      capabilities
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Failed to load dashboard data."
    });
  }
});

router.get("/export", allowRoles(["Owner", "Manager"]), async (req, res) => {
  try {
    const [users, customers, deliveries, subscriptions, logs] = await Promise.all([
      User.find({ username: { $ne: "buttbros" } }),
      Customer.find({}),
      Delivery.find({}),
      Subscription.find({}),
      Log.find({})
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      collections: {
        users,
        customers,
        deliveries,
        subscriptions,
        logs
      }
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="db_export_${Date.now()}.json"`);
    res.send(JSON.stringify(exportData, null, 2));
  } catch (err) {
    console.error("Export error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to export data."
    });
  }
});

router.get("/export/docx", allowRoles(["Owner", "Manager"]), async (req, res) => {
  try {
    const [users, deliveries, customers] = await Promise.all([
      User.find({}).sort({ username: 1 }),
      Delivery.find({}).sort({ delivery_date: -1 }),
      Customer.find({})
    ]);

    const customersById = new Map(customers.map((customer) => [customer.customers_id, customer]));
    const doc = await buildUserDeliveryDocx(users, deliveries, customersById);
    const buffer = await Packer.toBuffer(doc);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="user_delivery_report_${Date.now()}.docx"`);
    res.send(buffer);
  } catch (err) {
    console.error("DOCX export error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to export DOCX report."
    });
  }
});

router.post("/import", allowRoles(["Owner", "Manager"]), async (req, res) => {
  const insertedIds = {
    users: [],
    customers: [],
    subscriptions: [],
    deliveries: [],
    logs: []
  };

  const rollback = async () => {
    try {
      await Promise.all([
        User.deleteMany({ _id: { $in: insertedIds.users } }),
        Customer.deleteMany({ _id: { $in: insertedIds.customers } }),
        Subscription.deleteMany({ _id: { $in: insertedIds.subscriptions } }),
        Delivery.deleteMany({ _id: { $in: insertedIds.deliveries } }),
        Log.deleteMany({ _id: { $in: insertedIds.logs } })
      ]);
    } catch (rollbackErr) {
      console.error("Rollback error:", rollbackErr);
    }
  };

  try {
    const { collections } = req.body;

    if (!collections || typeof collections !== "object") {
      return res.status(400).json({
        success: false,
        message: "Invalid import data format. Expected collections object."
      });
    }

    let importedCount = 0;

    if (collections.users && Array.isArray(collections.users)) {
      for (const user of collections.users) {
        if (user.username === "buttbros") continue;
        const exists = await User.findOne({ user_id: user.user_id });
        if (!exists) {
          const created = await User.create({
            user_id: user.user_id,
            username: user.username,
            password: user.password,
            role: user.role,
            is_active: user.is_active || true
          });
          insertedIds.users.push(created._id);
          importedCount++;
        }
      }
    }

    if (collections.customers && Array.isArray(collections.customers)) {
      for (const customer of collections.customers) {
        const exists = await Customer.findOne({ customers_id: customer.customers_id });
        if (!exists) {
          const created = await Customer.create(customer);
          insertedIds.customers.push(created._id);
          importedCount++;
        }
      }
    }

    if (collections.subscriptions && Array.isArray(collections.subscriptions)) {
      for (const subscription of collections.subscriptions) {
        const exists = await Subscription.findOne({ subscription_id: subscription.subscription_id });
        if (!exists) {
          const created = await Subscription.create(subscription);
          insertedIds.subscriptions.push(created._id);
          importedCount++;
        }
      }
    }

    if (collections.deliveries && Array.isArray(collections.deliveries)) {
      for (const delivery of collections.deliveries) {
        const exists = await Delivery.findOne({ delivery_id: delivery.delivery_id });
        if (!exists) {
          const created = await Delivery.create(delivery);
          insertedIds.deliveries.push(created._id);
          importedCount++;
        }
      }
    }

    if (collections.logs && Array.isArray(collections.logs)) {
      for (const log of collections.logs) {
        const created = await Log.create(log);
        insertedIds.logs.push(created._id);
        importedCount++;
      }
    }

    return res.json({
      success: true,
      message: `Imported ${importedCount} records successfully.`,
      importedCount
    });
  } catch (err) {
    console.error("Import error:", err);
    await rollback();
    return res.status(500).json({
      success: false,
      message: "Failed to import data. Database rolled back to previous state. " + err.message
    });
  }
});

module.exports = router;
