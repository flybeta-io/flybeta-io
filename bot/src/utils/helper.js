const axios = require("axios");

// Helper: Send Message
exports.sendWhatsAppMessage = async (to, text) => {
  try {
    await axios.post(
      `https://graph.facebook.com/v22.0/${process.env.PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: to,
        type: "text",
        text: { body: text },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        },
      }
    );
  } catch (err) {
    console.error(
      "WhatsApp API Error:",
      err.response ? err.response.data : err.message
    );
  }
};


// Helper: Send Interactive Button Message (Max 3 buttons)
exports.sendButtonMessage = async (to, bodyText, buttons) => {
    try {
        await axios.post(
            `https://graph.facebook.com/v22.0/${process.env.PHONE_NUMBER_ID}/messages`,
            {
                messaging_product: "whatsapp",
                to: to,
                type: "interactive",
                interactive: {
                    type: "button",
                    body: {
                        text: bodyText
                    },
                    action: {
                        // Map your simple array to the complex WhatsApp format
                        buttons: buttons.map((btn, index) => ({
                            type: "reply",
                            reply: {
                                id: btn.id,       // Unique ID for your code to track (e.g., "btn_yes")
                                title: btn.title  // Text user sees (Max 20 chars)
                            }
                        }))
                    }
                }
            },
            {
                headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` }
            }
        );
    } catch (err) {
        console.error('Button Error:', err.response ? err.response.data : err.message);
    }
};



// Generate sting
exports.schedulesFunction = async (flight) => {
  return `\nFlightID: ${flight.flightID}\nAirline Name: ${flight.airlineName}\nOrigin Airport: ${flight.originAirport} (${flight.originAirportIata}) \nDestination Airport: ${flight.destAirport} (${flight.destAirportIata})\nDeparture Time: ${flight.departureTime}`;
}
