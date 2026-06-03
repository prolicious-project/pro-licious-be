import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const hashOTP = async (otp) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(otp, salt);
};

export const verifyOTP = async (otp, hash) => {
  return bcrypt.compare(otp, hash);
};

export const generateRandomCode = (length = 32) => {
  return require('crypto')
    .randomBytes(length)
    .toString('hex')
    .substring(0, length);
};

export default {
  generateOTP,
  hashOTP,
  verifyOTP,
  generateRandomCode,
};
