import dotenv from "dotenv";

dotenv.config();

export default {
  schema: "./src/db/schema/index.js",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
};