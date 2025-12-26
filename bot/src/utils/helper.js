const axios = require("axios");

const ITEMS_PER_PAGE = 2; // We use 2 items so the 3rd button can be "Next"

// Helper: Send Message
const sendWhatsAppMessage = async (to, text) => {
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
const sendButtonMessage = async (to, bodyText, buttons) => {
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


const sendPaginatedOptions = async (to, text, items, page, type) => {

  try {
    if (!Array.isArray(items)) {
    console.error("❌ Error: items is not an array:", items);
    return;
  }

  const uniqueItems = [...new Set(items)];

  if (uniqueItems.length === 0) {
    console.log(`⚠️ No items found for ${type}. Sending text warning.`);
    await sendWhatsAppMessage(
      to,
      `⚠️ No options available for this selection.`
    );
    return; // STOP EXECUTION HERE
  }

    const start = page * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const currentItems = items.slice(start, end);

    const buttons = currentItems.map((item) => ({
      id: `sel_${type}_${item}`, // e.g. sel_origin_Lagos
      title: item.length >= 20 ? item.substring(0, 16) + "...": item,
    }));

  // If there are more items left, add a "Next" button
  if (end < items.length) {
    buttons.push({
      id: `next_${type}_${page + 1}`, // e.g. next_origin_1
      title: "Next ➡️",
    });
  }

  await sendButtonMessage(to, text, buttons);
  } catch (error) {

  }

};


module.exports = {
  sendButtonMessage,
  sendWhatsAppMessage,
  sendPaginatedOptions
}
