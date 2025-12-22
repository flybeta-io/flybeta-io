const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

router.get("/webhook", webhookController.handleWebhookVerification);
router.post("/webhook", webhookController.handleIncomingMessages);


module.exports = router;
