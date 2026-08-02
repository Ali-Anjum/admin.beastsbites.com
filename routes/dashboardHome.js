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
      canViewUsers,
      canBackup: role === "Owner" || role === "Manager"
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
  // Validate structure quickly
  const { collections } = req.body || {};

  if (!collections || typeof collections !== "object") {
    return res.status(400).json({ success: false, message: "Invalid import data format. Expected collections object." });
  }

  // Simple per-collection validators (lightweight)
  const validate = async () => {
    if (collections.users && !Array.isArray(collections.users)) throw new Error("collections.users must be an array");
    if (collections.customers && !Array.isArray(collections.customers)) throw new Error("collections.customers must be an array");
    if (collections.subscriptions && !Array.isArray(collections.subscriptions)) throw new Error("collections.subscriptions must be an array");
    if (collections.deliveries && !Array.isArray(collections.deliveries)) throw new Error("collections.deliveries must be an array");
    if (collections.logs && !Array.isArray(collections.logs)) throw new Error("collections.logs must be an array");

    // Basic field checks for critical items (users)
    if (collections.users) {
      for (const u of collections.users) {
        if (!u.username || !u.password || !u.role) throw new Error("Each user must have username, password and role");
        if (!["Owner", "Manager", "Delivery-Guy", "Observer"].includes(u.role)) throw new Error("Invalid user role: " + u.role);
      }
    }

    // Validate documents against Mongoose schemas without saving
    const validateDocs = async (Model, docs = []) => {
      for (const doc of docs) {
        const instance = new Model(doc);
        await instance.validate();
      }
    };

    await validateDocs(User, collections.users || []);
    await validateDocs(Customer, collections.customers || []);
    await validateDocs(Subscription, collections.subscriptions || []);
    await validateDocs(Delivery, collections.deliveries || []);
    // logs are free-form in this app; skip deep validation
  };

  try {
    await validate();
  } catch (err) {
    return res.status(400).json({ success: false, message: "Import validation failed: " + err.message });
  }

  // Try to perform the import inside a MongoDB transaction if available
  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    // Remove all existing documents
    await Promise.all([
      User.deleteMany({}, { session }),
      Customer.deleteMany({}, { session }),
      Subscription.deleteMany({}, { session }),
      Delivery.deleteMany({}, { session }),
      Log.deleteMany({}, { session })
    ]);

    // Insert new documents (preserve payload order)
    let importedCount = 0;

    if (collections.users && collections.users.length) {
      const usersToInsert = collections.users.filter(u => u.username !== 'buttbros');
      if (usersToInsert.length) {
        await User.insertMany(usersToInsert, { session });
        importedCount += usersToInsert.length;
      }
    }

    if (collections.customers && collections.customers.length) {
      await Customer.insertMany(collections.customers, { session });
      importedCount += collections.customers.length;
    }

    if (collections.subscriptions && collections.subscriptions.length) {
      await Subscription.insertMany(collections.subscriptions, { session });
      importedCount += collections.subscriptions.length;
    }

    if (collections.deliveries && collections.deliveries.length) {
      await Delivery.insertMany(collections.deliveries, { session });
      importedCount += collections.deliveries.length;
    }

    if (collections.logs && collections.logs.length) {
      await Log.insertMany(collections.logs, { session });
      importedCount += collections.logs.length;
    }

    await session.commitTransaction();
    session.endSession();

    return res.json({ success: true, message: `Imported ${importedCount} records successfully.`, importedCount });
  } catch (txnErr) {
    if (session) {
      try { await session.abortTransaction(); } catch (e) { /* ignore */ }
      session.endSession();
    }

    // If transactions are not supported or failed, fallback to safe backup+restore flow
    console.warn('Transaction import failed, falling back to safe backup-restore:', txnErr.message || txnErr);

    // Backup current data
    const backup = {
      users: await User.find({}).lean(),
      customers: await Customer.find({}).lean(),
      subscriptions: await Subscription.find({}).lean(),
      deliveries: await Delivery.find({}).lean(),
      logs: await Log.find({}).lean()
    };

    try {
      // Delete all existing documents
      await Promise.all([
        User.deleteMany({}),
        Customer.deleteMany({}),
        Subscription.deleteMany({}),
        Delivery.deleteMany({}),
        Log.deleteMany({})
      ]);

      // Insert new documents using create (runs validation)
      let importedCount = 0;

      if (collections.users && collections.users.length) {
        const usersToInsert = collections.users.filter(u => u.username !== 'buttbros');
        if (usersToInsert.length) {
          await User.create(usersToInsert);
          importedCount += usersToInsert.length;
        }
      }

      if (collections.customers && collections.customers.length) {
        await Customer.create(collections.customers);
        importedCount += collections.customers.length;
      }

      if (collections.subscriptions && collections.subscriptions.length) {
        await Subscription.create(collections.subscriptions);
        importedCount += collections.subscriptions.length;
      }

      if (collections.deliveries && collections.deliveries.length) {
        await Delivery.create(collections.deliveries);
        importedCount += collections.deliveries.length;
      }

      if (collections.logs && collections.logs.length) {
        await Log.create(collections.logs);
        importedCount += collections.logs.length;
      }

      return res.json({ success: true, message: `Imported ${importedCount} records successfully.`, importedCount });
    } catch (errDuringInsert) {
      console.error('Import failed after deletion, attempting restore from backup:', errDuringInsert);

      // Try to restore backup
      try {
        await Promise.all([
          User.deleteMany({}),
          Customer.deleteMany({}),
          Subscription.deleteMany({}),
          Delivery.deleteMany({}),
          Log.deleteMany({})
        ]);

        // Re-insert backup (use insertMany to include original _id fields)
        if (backup.users.length) await User.insertMany(backup.users);
        if (backup.customers.length) await Customer.insertMany(backup.customers);
        if (backup.subscriptions.length) await Subscription.insertMany(backup.subscriptions);
        if (backup.deliveries.length) await Delivery.insertMany(backup.deliveries);
        if (backup.logs.length) await Log.insertMany(backup.logs);

        return res.status(500).json({ success: false, message: 'Import failed and the original data has been restored. Error: ' + errDuringInsert.message });
      } catch (restoreErr) {
        console.error('Restore after failed import also failed:', restoreErr);
        return res.status(500).json({ success: false, message: 'Import failed and restore also failed. Manual intervention required.' });
      }
    }
  }
});

module.exports = router;
