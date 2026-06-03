import bcrypt from "bcrypt";

const ROUNDS = 10;

/** Hash password for storage */
export const hashPassword = (password: string) => bcrypt.hash(password, ROUNDS);

/** Compare plain password with hash */
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);
