const bcrypt = require("bcryptjs");
const { connectToDatabase } = require("../lib/db");
const User = require("../models/User");

async function seedAdmin() {
  const fullName = process.env.ADMIN_SEED_NAME;
  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;

  if (!fullName || !email || !password) {
    throw new Error("ADMIN_SEED_NAME, ADMIN_SEED_EMAIL, and ADMIN_SEED_PASSWORD must be set");
  }

  await connectToDatabase();

  const existingAdmin = await User.findOne({ email: email.toLowerCase() });
  if (existingAdmin) {
    console.log(`Admin already exists for ${email}`);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await User.create({
    fullName,
    email: email.toLowerCase(),
    passwordHash,
    role: "admin",
    verificationStatus: "verified",
  });

  console.log(`Admin seeded for ${email}`);
  process.exit(0);
}

seedAdmin().catch((error) => {
  console.error("Failed to seed admin", error);
  process.exit(1);
});
