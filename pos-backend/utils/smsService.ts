import config from "../config/config";

/**
 * Send an OTP SMS via Fast2SMS.
 * If FAST2SMS_API_KEY is not set (dev/UAT), logs to console instead.
 */
export async function sendOtpSms(phone: string, otp: string): Promise<void> {
  if (!config.fast2smsApiKey) {
    console.log(`[OTP DEV] Phone: ${phone} | OTP: ${otp}`);
    return;
  }

  const resp = await fetch("https://www.fast2sms.com/dev/bulkV2", {
    method: "POST",
    headers: {
      authorization: config.fast2smsApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      route: "otp",
      variables_values: otp,
      numbers: phone,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`SMS send failed: ${err}`);
  }
}
