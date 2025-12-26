const {
  sendWhatsAppMessage,
  sendButtonMessage,
  sendPaginatedOptions,
} = require("../utils/helper");
const { getUserState, setUserState } = require("../utils/userState");
const {
  citiesToArr,
  getAirlines,
  fetchDatewithAirline,
  fetchUserQuery,
} = require("../utils/database");
const { USER_STATE_MANAGEMENT_IN_SECONDS } = require("../../config/env");

// ==========================================
// CONFIGURATION & DATA
// ==========================================

// const CITIES = ["Lagos", "Abuja", "Kano", "Port Harcourt", "Enugu", "Owerri", "Ibadan", "Benin"];
// const AIRLINES = ["Air Peace", "Ibom Air", "Arik Air", "Dana Air", "Green Africa", "Overland"];
// const TIMES = [
//   "Morning (6am-11am)",
//   "Afternoon (12pm-4pm)",
//   "Evening (5pm-9pm)",
// ];
let CITIES;
let AIRLINES;
let TIMES;

// ========================================
// WEBHOOKS
// ========================================

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
        }, USER_STATE_MANAGEMENT_IN_SECONDS * 1000); //

        const session = await getUserState(from);
        const currentStep = session.step;

        // =====================================================
        // SCENARIO A: TEXT MESSAGES
        // =====================================================
        if (message.type === "text") {
          const text = message.text.body.toLowerCase().trim();
          console.log(`Received text message: ${text} from ${from}`);

          // Send "Welcome" Text
          await sendWhatsAppMessage(
            from,
            "Welcome to FlyBeta! ✈️\nWe predict flight delays."
          );

          // Send "Would you like to get started?" with Buttons
          await sendButtonMessage(from, "Would you like to get started?", [
            { id: "btn_yes", title: "Yes" },
            { id: "btn_no", title: "No" },
          ]);

          // =====================================================
          // SCENARIO B: BUTTON CLICKS
          // =====================================================
        } else if (message.type === "interactive") {
          const buttonReply = message.interactive.button_reply;
          const buttonId = buttonReply.id;

          console.log(`Received button click: ${buttonId} from ${from}`);

          // ===========================
          //  YES OR NO (START)
          // ===========================
          if (buttonId === "btn_yes") {
            await setUserState(from, "SELECTING_ORIGIN");
            CITIES = await citiesToArr();
            await sendWhatsAppMessage(
              from,
              "Where are you flying from? (e.g., Lagos, Abuja)."
            );
            await sendPaginatedOptions(
              from,
              "Select your Origin City:",
              CITIES,
              0,
              "origin"
            );
          } else if (buttonId === "btn_no") {
            await setUserState(from, "IDLE");
            await sendWhatsAppMessage(from, "No worries! Text us anytime.");

            // ===========================
            //  PAGINATION (NEXT)
            // ===========================
          } else if (buttonId.startsWith("next_")) {
            // Format: next_TYPE_PAGE (e.g., next_origin_1)
            const [_, type, pageStr] = buttonId.split("_");
            const page = parseInt(pageStr);

            let list = [];
            let prompt = "";

            if (type === "origin") {
              list = CITIES;
              prompt = "Select Origin:";
            } else if (type === "dest") {
              list = CITIES;
              prompt = "Select Destination:";
            } else if (type === "airline") {
              userData = session.data;
              AIRLINES = await getAirlines(
                userData.origin,
                userData.destination
              );
              list = AIRLINES;
              prompt = "Select Airline:";
            } else if (type === "time") {
              userData = session.data;
              TIMES = await fetchDatewithAirline(
                userData.origin,
                userData.destination,
                userData.airline
              );
              list = TIMES;
              prompt = "Select Time:";
            }

            await sendPaginatedOptions(from, prompt, list, page, type);

            // --- 3. SELECTION HANDLER (User picked an item) ---
          } else if (buttonId.startsWith("sel_")) {
            // Format: sel_TYPE_VALUE (e.g., sel_origin_Lagos)
            const parts = buttonId.split("_");
            const type = parts[1]; // origin, dest, airline, time
            const value = parts.slice(2).join(" "); // "New York" (handles spaces)

            // ===========================
            //  SELECT ORIGIN
            // ===========================
            if (type === "origin") {
              await setUserState(from, "SELECTING_DESTINATION", {
                origin: value,
              });
              await sendWhatsAppMessage(from, `✅ Origin set to ${value}`);
              await sendWhatsAppMessage(from, `Where are you flying to`);
              // Trigger Next Step: Destination
              await sendPaginatedOptions(
                from,
                "Select your Destination:",
                CITIES,
                0,
                "dest"
              );

              // ===========================
              //  SELECT DESTINATION
              // ===========================
            } else if (type === "dest") {
              await setUserState(from, "SELECTING_AIRLINE", {
                destination: value,
              });
              await sendWhatsAppMessage(from, `✅ Destination set to ${value}`);
              // Trigger Next Step: Airline
              AIRLINES = await getAirlines(session.data.origin, value);
              await sendPaginatedOptions(
                from,
                "Select your Airline:",
                AIRLINES,
                0,
                "airline"
              );

              // ===========================
              // SELECT AIRLINE
              // ===========================
            } else if (type === "airline") {
              await setUserState(from, "SELECTING_TIME", { airline: value });
              await sendWhatsAppMessage(from, `✅ Airline set to ${value}`);
              // Trigger Next Step: Time
              userData = session.data;
              TIMES = await fetchDatewithAirline(
                userData.origin,
                userData.destination,
                value
              );
              console.log(TIMES);
              await sendPaginatedOptions(
                from,
                "Select Departure Time:",
                TIMES,
                0,
                "time"
              );

              // ===========================
              // SELECT TIME
              // ===========================
            } else if (type === "time") {
              const finalData = { ...session.data, time: value };

              await sendWhatsAppMessage(
                from,
                `📝 Summary:\nFrom: ${finalData.origin}\nTo: ${finalData.destination}\nAirline: ${finalData.airline}\nTime: ${value}\n\nFetching predictions... ⏳`
              );

              // ===========================
              // PREDICTION LOGIC
              // ===========================
              userData = session.data;
              const [userQuery, prediction] = await fetchUserQuery(
                userData.origin,
                userData.destination,
                userData.airline,
                value
              );
              // console.log(results)

              await sendWhatsAppMessage(
                from,
                `Flight ID: ${userQuery.flightID} \nAirline Name: ${userQuery.airlineName} \nOrigin Airport: ${userQuery.originAirport} (${userQuery.originAirportIata}) \nDestination Airport: ${userQuery.destAirport} (${userQuery.destAirportIata}) \nDeparture Time: ${userQuery.scheduledDepartureTime}`
              );

              if (prediction === null) {
                await sendWhatsAppMessage(
                  from,
                  `⚠️ No predictions available for this selection.`
                );
                return;
              }

              // await sendWhatsAppMessage(from, results);

              // Example:
              // const schedules = await mergeSchedules(finalData.origin, finalData.destination, ...);
              // ... rest of your logic

              await setUserState(from, "IDLE", { time: value }); // Reset state
            }
          }
        }
        res.sendStatus(200);
      } else {
        res.sendStatus(404);
      }
    }
  } catch (error) {
    console.error("ERROR in Webhook:", error);
    res.sendStatus(500);
  }
};
