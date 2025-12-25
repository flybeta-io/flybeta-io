const { sendWhatsAppMessage, sendButtonMessage, schedulesFunction} = require("../utils/helper");
const { getUserState, setUserState } = require("../utils/userState");
const {
  getAirportsbyCity,
  mergeSchedules,
} = require("../utils/database");




exports.handleWebhookVerification = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
};



const processedMessages = new Set();

exports.handleIncomingMessages = async (req, res) => {
  const body = req.body;

  try {
    if (body.object) {
      if (
        body.entry &&
        body.entry[0].changes &&
        body.entry[0].changes[0].value.messages &&
        body.entry[0].changes[0].value.messages[0]
      ) {
        const message = body.entry[0].changes[0].value.messages[0];
        const messageId = message.id;
        const from = message.from; // User's phone number

        if (processedMessages.has(messageId)) return;
        processedMessages.add(messageId);

        setTimeout(() => {
          processedMessages.delete(messageId);
        }, 5 * 60 * 1000); // 5 minute

        const session = await getUserState(from);
        const currentStep = session.step;

        // =====================================================
        // SCENARIO A: TEXT MESSAGES
        // =====================================================
        if (message.type === "text") {
          const text = message.text.body.toLowerCase().trim();
          console.log(`Received text message: ${text} from ${from}`);

          // --- Logic: Check State BEFORE replying ---
          if (currentStep === "WAITING_ORIGIN") {
            const resultOrigin = await getAirportsbyCity(text);
            // console.log(resultOrigin);

            if (!resultOrigin) {
              await sendWhatsAppMessage(
                from,
                `Unable to determine the city: ${text}.\nPlease enter a valid city`
              );
              return;
            }
            await setUserState(from, "WAITING_DESTINATION", { origin: text });
            await sendWhatsAppMessage(from, `Got it! Flying from ${text}.`);
            await sendWhatsAppMessage(
              from,
              "Where are you flying to? (e.g., New York, London)."
            );
          } else if (currentStep === "WAITING_DESTINATION") {
            const resultDest = await getAirportsbyCity(text);
            // console.log(resultDest);

            if (!resultDest) {
              await sendWhatsAppMessage(
                from,
                `Unable to determine the city: ${text}.\nPlease enter a valid city`
              );
              return;
            }

            await setUserState(from, "WAITING_DEPARTURE_DATE", {
              destination: text,
            });
            await sendWhatsAppMessage(from, `Okay, flying to ${text}.`);
            await sendWhatsAppMessage(
              from,
              "When is your flight? (e.g., DD/MM/YYYY)"
            );
          } else if (currentStep === "WAITING_DEPARTURE_DATE") {
            // User is answering "Date"
            await setUserState(from, "RETRIEVE_FLIGHT_DELAY_PREDICTION", {
              departure_date: text,
            });

            // Get the final data we just saved
            const finalData = { ...session.data, departure_date: text };

            await sendWhatsAppMessage(
              from,
              `All set! ✈️\nOrigin: ${finalData.origin}\nDestination: ${finalData.destination}\nDeparture Date: ${text}`
            );
            await sendWhatsAppMessage(from, "Retrieving flight schedules...");

            const originCity = session.data.origin;
            const destCity = session.data.destination;

            // Flight Schedules
            const schedules = await mergeSchedules(
              originCity,
              destCity,
              text
            );
            console.log(`Retrieved ${schedules.length} flight schedules`);
            await sendWhatsAppMessage(
              from,
              `Retrieved ${schedules.length} flight schedules`
            );

            for (let i = 0; i < schedules.length; i++) {
              const flight = schedules[i];
              await sendWhatsAppMessage(
                from,
                `------------${i + 1}------------ ${await schedulesFunction(flight)}`
              );
            }

            await sendWhatsAppMessage(
              from,
              "Enter the number corresponding to a flight to get the delay prediction"
            );

          } else if (currentStep === "RETRIEVE_FLIGHT_DELAY_PREDICTION") {
            await setUserState(from, "IDLE");


          } else {
            // Step A: Send "Welcome" Text
            await sendWhatsAppMessage(
              from,
              "Welcome to FlyBeta! ✈️\nWe do predict flight delays."
            );

            // Step B: Send "Would you like to get started?" with Buttons
            await sendButtonMessage(from, "Would you like to get started?", [
              { id: "btn_yes", title: "Yes" },
              { id: "btn_no", title: "No" },
            ]);
          }

          // =====================================================
          // SCENARIO B: BUTTON CLICKS
          // =====================================================
        } else if (message.type === "interactive") {
          const buttonReply = message.interactive.button_reply;
          const buttonId = buttonReply.id;
          console.log(`Received button click: ${buttonId} from ${from}`);

          if (buttonId === "btn_yes") {
            await setUserState(from, "WAITING_ORIGIN");
            await sendWhatsAppMessage(
              from,
              "Great! To get started, please provide your flight details."
            );
            await sendWhatsAppMessage(
              from,
              "Where are you flying from? (e.g., Lagos, Abuja)."
            );
          } else if (buttonId === "btn_no") {
            await setUserState(from, "IDLE");
            await sendWhatsAppMessage(
              from,
              "No worries! If you change your mind, just let us know."
            );
          }
        }
      }
      res.sendStatus(200);
    } else {
      res.sendStatus(404);
    }
  } catch (error) {
    console.error("ERROR in Webhook:", error);
    res.sendStatus(500);
  }
};
