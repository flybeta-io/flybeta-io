require("dotenv").config();
const express = require("express");
const sequelize = require("../config/sequelize");
const PORT = process.env.WHATSAPP_BOT_PORT || 5000;


// Middleware
const app = express();
app.use(express.json());

// Routes
const webhookRouter = require("./routes/webhookRouter");
app.use(webhookRouter);




app.listen(PORT, async () => {
  try {
        await sequelize.sync();
        console.log("(WhatsApp Bot to Database connection successfully established.)");
        console.log(`WhatsApp Bot Server is listening on port ${PORT}`);
    } catch (error) {
        console.error("Unable to connect to the database:", error);
    }
});
