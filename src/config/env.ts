// import dotenv from "dotenv";

// dotenv.config();

// export const env = {
//   PORT: process.env.PORT || "5000",

//   DATABASE_URL: process.env.DATABASE_URL!,

//   REDIS_URL: process.env.REDIS_URL!,

//   JWT_SECRET: process.env.JWT_SECRET!,

//   JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET!,

//   RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID!,

//   RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET!,

//   NODE_ENV: process.env.NODE_ENV || "development",
// };

import dotenv from "dotenv";

dotenv.config();

console.log(process.env.DATABASE_URL);

export const env = {
  DATABASE_URL: process.env.DATABASE_URL!,
  PORT: process.env.PORT || "5000",
  REDIS_URL: process.env.REDIS_URL!,
};