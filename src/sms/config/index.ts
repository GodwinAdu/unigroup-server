import axios from "axios";
import { log } from "../../libs/utils/logger";
import config from "../../config/config";

interface MsgProps {
  text: string;
  destinations: string[];
}

const sms_key = config.sms_token;
const endPoint = `https://api.smsonlinegh.com/v5/message/sms/send`;

const headers = {
  "Content-Type": "application/json",
  Accept: "application/json",
  Authorization: `Key ${sms_key}`,
};

// 🧠 Helper function to auto-format Ghana numbers
function formatGhanaNumber(num: string): string {
  // Remove spaces, plus signs, and non-numeric characters
  let cleanNum = num.replace(/\D/g, "");

  if (cleanNum.startsWith("0")) {
    // Convert local number (e.g., 0551234567 → 233551234567)
    cleanNum = "233" + cleanNum.slice(1);
  } else if (cleanNum.startsWith("233")) {
    // Already correct
    cleanNum = cleanNum;
  } else if (cleanNum.startsWith("+233")) {
    // Remove +
    cleanNum = cleanNum.slice(1);
  }

  return cleanNum;
}

export async function smsConfig(values: MsgProps) {
  try {
    const { text, destinations } = values;

    // Format all numbers correctly
    const formattedNumbers = destinations.map((num) => formatGhanaNumber(num));

    const msgData = {
      text,
      type: 0,
      sender: "HWS Tech", // ✅ Use an approved sender name
      destinations: formattedNumbers,
    };

    const response = await axios.post(endPoint, msgData, { headers });

    if (response.status === 200 || response.status === 201) {
      log.info(`✅ SMS Sent Successfully: ${JSON.stringify(response.data)}`);
    } else {
      log.error(`❌ SMS Failed: ${JSON.stringify(response.data)}`);
    }

    return response.data;
  } catch (error: any) {
    log.error(`❌ SMS Error: ${error.message || error}`);
    throw error;
  }
}
