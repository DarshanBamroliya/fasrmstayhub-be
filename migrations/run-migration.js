/**
 * Database Migration Script
 * Makes farmhouseId and address columns nullable in locations table
 *
 * Run with:
 * node migrations/run-migration.js
 */

require("dotenv").config();
const mysql = require("mysql2/promise");

async function runMigration() {
  let connection;

  try {
    console.log("🔄 Connecting to database...");
    console.log("   Host     :", process.env.DB_HOST);
    console.log("   Port     :", process.env.DB_PORT);
    console.log("   User     :", process.env.DB_USERNAME);
    console.log("   Password :", process.env.DB_PASSWORD);
    console.log("   Database :", process.env.DB_NAME);

    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      connectTimeout: 20000, // 20s timeout
    });

    console.log("✅ Connected to database");
    console.log("🔄 Running migration...\n");

    // Make farmhouseId nullable
    console.log("➡ Altering farmhouseId column...");
    await connection.query(`
      ALTER TABLE locations
      MODIFY COLUMN farmhouseId INT NULL
    `);
    console.log("✅ farmhouseId is now nullable");

    // Make address nullable
    console.log("➡ Altering address column...");
    await connection.query(`
      ALTER TABLE locations
      MODIFY COLUMN address TEXT NULL
    `);
    console.log("✅ address is now nullable");

    console.log("\n🎉 Migration completed successfully!");

  } catch (error) {
    console.error("❌ Migration failed!");
    console.error("   Code   :", error.code);
    console.error("   Message:", error.message);

    if (error.code === "ECONNREFUSED") {
      console.log("\n⚠️ MySQL server refused connection");
    }

    if (error.code === "ETIMEDOUT") {
      console.log("\n⚠️ MySQL server not reachable (network / firewall issue)");
    }

    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log("\n🔌 Database connection closed");
    }
  }
}

runMigration();
