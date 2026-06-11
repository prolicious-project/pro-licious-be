import Razorpay from "razorpay";
import crypto from "crypto";
import { env } from "./env";

console.log("RAZORPAY_KEY_ID:", env.RAZORPAY_KEY_ID);
console.log(
  "RAZORPAY_KEY_SECRET:",
  env.RAZORPAY_KEY_SECRET ? "Loaded" : "Missing"
);

if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
  throw new Error(
    "Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET in .env"
  );
}

export const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID,
  key_secret: env.RAZORPAY_KEY_SECRET,
});

export const createRazorpayOrder = async (
  amountInr: number,
  receipt: string
) =>
  razorpay.orders.create({
    amount: Math.round(amountInr * 100),
    currency: "INR",
    receipt,
  });

export const verifyRazorpaySignature = (
  orderId: string,
  paymentId: string,
  signature: string
) => {
  const body = `${orderId}|${paymentId}`;

  const expected = crypto
    .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");

  return expected === signature;
};