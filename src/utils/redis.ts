import redisClient from "../config/redis";

/** Get string value from Redis */
export const redisGet = async (key: string) => {
  const v = await redisClient.get(key);
  return v ?? null;
};

/** Set string value with optional TTL seconds */
export const redisSet = async (key: string, value: string, ttlSeconds?: number) => {
  if (ttlSeconds) await redisClient.setEx(key, ttlSeconds, value);
  else await redisClient.set(key, value);
};

/** Delete Redis key */
export const redisDel = async (key: string) => redisClient.del(key);
