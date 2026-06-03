import Razorpay from "razorpay";
import crypto from "crypto";
import { env } from "./env";

/** Razorpay client instance */
export const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID,
  key_secret: env.RAZORPAY_KEY_SECRET,
});

/** Create Razorpay order (amount in INR paise) */
export const createRazorpayOrder = async (amountInr: number, receipt: string) =>
  razorpay.orders.create({
    amount: Math.round(amountInr * 100),
    currency: "INR",
    receipt,
  });

/** Verify Razorpay payment signature */
export const verifyRazorpaySignature = (
  orderId: string,
  paymentId: string,
  signature: string,
) => {
  const body = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");
  return expected === signature;
};
