require("dotenv").config();
const connectDB = require("../config/db");
const Disease = require("../models/Disease");
const seedData = require("./seedData");

async function run() {
  await connectDB();

  for (const entry of seedData) {
    await Disease.findOneAndUpdate({ slug: entry.slug }, entry, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
    console.log("Seeded:", entry.slug);
  }

  console.log("Done. Seeded", seedData.length, "diseases.");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
