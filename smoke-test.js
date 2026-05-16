require("dotenv").config();
const axios = require("axios");
const { MongoClient } = require("mongodb");

const BASE_URL = process.env.API_URL || "http://localhost:5000/api";
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.DB_NAME || "storyland";

// Test data
const TEST_MOBILE = "9999999999";
const TEST_ADMIN_ID = "admin";
const TEST_ADMIN_PASSWORD = "admin123";

// Tokens and IDs gathered during tests
let userToken = "";
let adminToken = "";
let createdStoryId = "";
let createdCategoryId = "";
let createdUserId = "";
let createdAdminStoryId = "";

// Results tracking
const results = [];
let passCount = 0;
let failCount = 0;

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
  bold: "\x1b[1m",
};

const log = {
  section: (msg) =>
    console.log(`\n${colors.cyan}═══ ${msg} ═══${colors.reset}`),
  pass: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  fail: (msg, err) =>
    console.log(
      `${colors.red}❌ ${msg}${colors.reset} ${colors.gray}${err}${colors.reset}`,
    ),
  info: (msg) => console.log(`${colors.blue}ℹ  ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠  ${msg}${colors.reset}`),
  skip: (msg) => console.log(`${colors.yellow}⊘ SKIP: ${msg}${colors.reset}`),
};

async function test(name, fn) {
  try {
    await fn();
    log.pass(name);
    results.push({ name, status: "PASS" });
    passCount++;
  } catch (err) {
    const errMsg =
      err.response?.data?.message ||
      err.response?.statusText ||
      err.message ||
      "Unknown error";
    const status = err.response?.status || "ERR";
    log.fail(name, `[${status}] ${errMsg}`);
    results.push({ name, status: "FAIL", error: errMsg });
    failCount++;
  }
}

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  validateStatus: (status) => status < 500,
});

const userAuth = () => ({ Authorization: `Bearer ${userToken}` });
const adminAuth = () => ({ Authorization: `Bearer ${adminToken}` });

/* ============================================================
   PRE-TEST SETUP: Seed the database directly
   ============================================================ */

async function seedDatabase() {
  log.section("PRE-TEST: Database Seeding");

  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);

    // 1. Ensure admin exists
    const existingAdmin = await db.collection("admins").findOne({
      id: TEST_ADMIN_ID,
    });

    if (existingAdmin) {
      log.info(`Admin '${TEST_ADMIN_ID}' already exists`);
      // Make sure password matches
      if (existingAdmin.password !== TEST_ADMIN_PASSWORD) {
        await db.collection("admins").updateOne(
          { id: TEST_ADMIN_ID },
          {
            $set: {
              password: TEST_ADMIN_PASSWORD,
              updatedAt: new Date(),
            },
          },
        );
        log.info(`Admin password updated to match test password`);
      }
    } else {
      await db.collection("admins").insertOne({
        id: TEST_ADMIN_ID,
        password: TEST_ADMIN_PASSWORD,
        name: "Smoke Test Admin",
        email: "admin@storyland.app",
        phone: "+91 99999 99999",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      log.pass(
        `Created admin: id="${TEST_ADMIN_ID}", password="${TEST_ADMIN_PASSWORD}"`,
      );
    }

    // 2. Clean up any leftover test data from previous runs
    const cleanup = await Promise.all([
      db.collection("users").deleteMany({ mobile: TEST_MOBILE }),
      db.collection("stories").deleteMany({
        title: {
          $in: [
            "Smoke Test Story",
            "Updated Smoke Test Story",
            "Admin Smoke Story",
            "Updated Admin Smoke Story",
          ],
        },
      }),
      db.collection("categories").deleteMany({
        name: { $in: ["Smoke Test Category", "Updated Smoke Category"] },
      }),
    ]);
    log.info(
      `Cleaned up old test data: ${cleanup[0].deletedCount} users, ${cleanup[1].deletedCount} stories, ${cleanup[2].deletedCount} categories`,
    );

    log.pass("Database seeding complete");
  } catch (err) {
    log.fail("Database seeding failed", err.message);
    throw err;
  } finally {
    await client.close();
  }
}

/* ============================================================
   MAIN TEST RUNNER
   ============================================================ */

async function runTests() {
  console.log(
    `\n${colors.cyan}${colors.bold}╔══════════════════════════════════════════╗${colors.reset}`,
  );
  console.log(
    `${colors.cyan}${colors.bold}║   StoryLand API - Full Smoke Test        ║${colors.reset}`,
  );
  console.log(
    `${colors.cyan}${colors.bold}║   Target: ${BASE_URL.padEnd(30)}║${colors.reset}`,
  );
  console.log(
    `${colors.cyan}${colors.bold}║   DB:     ${DB_NAME.padEnd(30)}║${colors.reset}`,
  );
  console.log(
    `${colors.cyan}${colors.bold}╚══════════════════════════════════════════╝${colors.reset}`,
  );

  // Seed the DB first
  await seedDatabase();

  // Health check
  log.section("HEALTH CHECK");
  await test("Server is reachable", async () => {
    try {
      await api.get("/categories");
    } catch (err) {
      if (err.code === "ECONNREFUSED") {
        throw new Error(`Server not running at ${BASE_URL}`);
      }
      throw err;
    }
  });

  /* ============================================================
     USER - PUBLIC ROUTES
     ============================================================ */
  log.section("USER - Public Routes");

  await test("GET  /categories (public, list)", async () => {
    const res = await api.get("/categories");
    if (res.status !== 200) throw new Error(`Got ${res.status}`);
    if (!Array.isArray(res.data.data))
      throw new Error("Expected data to be an array");
  });

  await test("POST /send-otp", async () => {
    const res = await api.post("/send-otp", { mobile: TEST_MOBILE });
    if (res.status !== 200)
      throw new Error(`Got ${res.status}: ${res.data.message}`);
    if (!res.data.data?.[0]?.otp && process.env.NODE_ENV !== "production") {
      log.warn("OTP not returned in response - set NODE_ENV != production");
    }
  });

  await test("POST /verify-otp -> get user token", async () => {
    const otpRes = await api.post("/send-otp", { mobile: TEST_MOBILE });
    const otp = otpRes.data?.data?.[0]?.otp;
    if (!otp) throw new Error("OTP not returned (set NODE_ENV != production)");

    const res = await api.post("/verify-otp", { mobile: TEST_MOBILE, otp });
    if (res.status !== 200)
      throw new Error(`Got ${res.status}: ${res.data.message}`);

    userToken = res.data.data[0].token;
    createdUserId = res.data.data[0].user?._id;
    if (!userToken) throw new Error("No token in response");
    if (!createdUserId) throw new Error("No userId in response");
    log.info(`User token: ${userToken.slice(0, 20)}...`);
    log.info(`User ID: ${createdUserId}`);
  });

  await test("POST /send-otp + verify-otp (wrong OTP should fail)", async () => {
    await api.post("/send-otp", { mobile: TEST_MOBILE });
    const res = await api.post("/verify-otp", {
      mobile: TEST_MOBILE,
      otp: "000000",
    });
    if (res.status === 200) throw new Error("Wrong OTP should be rejected");
  });

  /* ============================================================
     USER - PROTECTED ROUTES
     ============================================================ */
  if (!userToken) {
    log.skip("All user-protected routes (no token)");
  } else {
    log.section("USER - Profile");

    await test("GET  /profile", async () => {
      const res = await api.get("/profile", { headers: userAuth() });
      if (res.status !== 200) throw new Error(`Got ${res.status}`);
      if (!res.data.data?.[0]) throw new Error("No profile in response");
    });

    await test("PUT  /profile (update name)", async () => {
      const newName = "Smoke Test User " + Date.now();
      const res = await api.put(
        "/profile",
        { name: newName, email: "smoke@test.com" },
        { headers: userAuth() },
      );
      if (res.status !== 200)
        throw new Error(`Got ${res.status}: ${res.data.message}`);

      // Verify the change persisted
      const check = await api.get("/profile", { headers: userAuth() });
      if (check.data.data[0].name !== newName)
        throw new Error("Name was not updated in DB");
    });

    log.section("USER - Stories Browse");

    await test("GET  /home (feed)", async () => {
      const res = await api.get("/home", { headers: userAuth() });
      if (res.status !== 200) throw new Error(`Got ${res.status}`);
    });

    await test("GET  /stories", async () => {
      const res = await api.get("/stories", { headers: userAuth() });
      if (res.status !== 200) throw new Error(`Got ${res.status}`);
      if (!Array.isArray(res.data.data))
        throw new Error("Expected stories array");
    });

    await test("GET  /search-stories?query=test", async () => {
      const res = await api.get("/search-stories?query=test", {
        headers: userAuth(),
      });
      if (res.status !== 200) throw new Error(`Got ${res.status}`);
    });

    log.section("USER - My Stories CRUD");

    await test("POST /my-stories (CREATE)", async () => {
      const res = await api.post(
        "/my-stories",
        {
          title: "Smoke Test Story",
          content: "This is a test story content.",
          summary: "Test summary",
          status: "draft",
        },
        { headers: userAuth() },
      );
      if (res.status !== 200)
        throw new Error(`Got ${res.status}: ${res.data.message}`);
      createdStoryId = res.data.data[0]._id;
      if (!createdStoryId) throw new Error("No story ID in response");
      log.info(`Created story ID: ${createdStoryId}`);
    });

    await test("GET  /my-stories (READ list)", async () => {
      const res = await api.get("/my-stories", { headers: userAuth() });
      if (res.status !== 200) throw new Error(`Got ${res.status}`);

      // Verify our created story is in the list
      const found = res.data.data.find(
        (s) => s._id?.toString() === createdStoryId,
      );
      if (!found) throw new Error("Created story not in list");
    });

    await test("GET  /my-stories?tab=Drafts (filtered)", async () => {
      const res = await api.get("/my-stories?tab=Drafts", {
        headers: userAuth(),
      });
      if (res.status !== 200) throw new Error(`Got ${res.status}`);
    });

    await test("PUT  /my-stories/:storyId (UPDATE)", async () => {
      const newTitle = "Updated Smoke Test Story";
      const res = await api.put(
        `/my-stories/${createdStoryId}`,
        { title: newTitle },
        { headers: userAuth() },
      );
      if (res.status !== 200)
        throw new Error(`Got ${res.status}: ${res.data.message}`);

      // Verify the update persisted by listing again
      const check = await api.get("/my-stories", { headers: userAuth() });
      const updated = check.data.data.find(
        (s) => s._id?.toString() === createdStoryId,
      );
      if (!updated || updated.title !== newTitle)
        throw new Error("Title was not updated in DB");
    });

    log.section("USER - Favorites & Reading");

    await test("POST /favorites/:storyId (add favorite)", async () => {
      const res = await api.post(
        `/favorites/${createdStoryId}`,
        {},
        { headers: userAuth() },
      );
      if (res.status !== 200)
        throw new Error(`Got ${res.status}: ${res.data.message}`);
    });

    await test("GET  /favorites (verify added)", async () => {
      const res = await api.get("/favorites", { headers: userAuth() });
      if (res.status !== 200) throw new Error(`Got ${res.status}`);

      const found = res.data.data.find(
        (s) => s._id?.toString() === createdStoryId,
      );
      if (!found) throw new Error("Story not in favorites after adding");
    });

    await test("POST /favorites/:storyId (toggle off)", async () => {
      const res = await api.post(
        `/favorites/${createdStoryId}`,
        {},
        { headers: userAuth() },
      );
      if (res.status !== 200)
        throw new Error(`Got ${res.status}: ${res.data.message}`);

      // Verify removed
      const check = await api.get("/favorites", { headers: userAuth() });
      const stillThere = check.data.data.find(
        (s) => s._id?.toString() === createdStoryId,
      );
      if (stillThere)
        throw new Error("Story still in favorites after toggle off");
    });

    await test("POST /reading-progress (save)", async () => {
      const res = await api.post(
        "/reading-progress",
        {
          storyId: createdStoryId,
          currentPage: 5,
          totalPages: 10,
          progress: 0.5,
        },
        { headers: userAuth() },
      );
      if (res.status !== 200)
        throw new Error(`Got ${res.status}: ${res.data.message}`);
    });

    await test("GET  /reading-history (verify saved)", async () => {
      const res = await api.get("/reading-history", { headers: userAuth() });
      if (res.status !== 200) throw new Error(`Got ${res.status}`);

      const found = res.data.data.find(
        (h) => h.storyId?.toString() === createdStoryId?.toString(),
      );
      if (!found) throw new Error("Reading progress not saved in DB");
      if (found.progress !== 0.5)
        throw new Error(`Wrong progress: got ${found.progress}, expected 0.5`);
    });

    await test("DELETE /my-stories/:storyId (DELETE)", async () => {
      const res = await api.delete(`/my-stories/${createdStoryId}`, {
        headers: userAuth(),
      });
      if (res.status !== 200)
        throw new Error(`Got ${res.status}: ${res.data.message}`);

      // Verify deletion
      const check = await api.get("/my-stories", { headers: userAuth() });
      const stillThere = check.data.data.find(
        (s) => s._id?.toString() === createdStoryId,
      );
      if (stillThere) throw new Error("Story still exists after delete");
    });
  }

  /* ============================================================
     ADMIN - LOGIN
     ============================================================ */
  log.section("ADMIN - Auth");

  await test("POST /admin/login -> get admin token", async () => {
    const res = await api.post("/admin/login", {
      id: TEST_ADMIN_ID,
      password: TEST_ADMIN_PASSWORD,
    });
    if (res.status !== 200)
      throw new Error(`Got ${res.status}: ${res.data.message}`);

    adminToken = res.data.data[0].token;
    if (!adminToken) throw new Error("No admin token in response");
    log.info(`Admin token: ${adminToken.slice(0, 20)}...`);
  });

  await test("POST /admin/login (wrong password rejected)", async () => {
    const res = await api.post("/admin/login", {
      id: TEST_ADMIN_ID,
      password: "wrong-password",
    });
    if (res.status === 200)
      throw new Error("Wrong password should not succeed");
  });

  await test("POST /admin/login (unknown ID rejected)", async () => {
    const res = await api.post("/admin/login", {
      id: "nobody",
      password: "whatever",
    });
    if (res.status === 200) throw new Error("Unknown ID should not succeed");
  });

  /* ============================================================
     ADMIN - PROTECTED ROUTES
     ============================================================ */
  if (!adminToken) {
    log.skip("All admin-protected routes (no token)");
  } else {
    log.section("ADMIN - Dashboard");

    await test("GET  /admin/dashboard/overview", async () => {
      const res = await api.get("/admin/dashboard/overview", {
        headers: adminAuth(),
      });
      if (res.status !== 200) throw new Error(`Got ${res.status}`);

      const overview = res.data.data[0];
      if (overview.totalUsers === undefined)
        throw new Error("Missing totalUsers in overview");
    });

    await test("GET  /admin/dashboard/recent-stories", async () => {
      const res = await api.get("/admin/dashboard/recent-stories", {
        headers: adminAuth(),
      });
      if (res.status !== 200) throw new Error(`Got ${res.status}`);
      if (!Array.isArray(res.data.data))
        throw new Error("Expected stories array");
    });

    log.section("ADMIN - Categories CRUD");

    await test("POST /admin/add-category (CREATE)", async () => {
      const res = await api.post(
        "/admin/add-category",
        {
          name: "Smoke Test Category",
          emoji: "🧪",
          description: "Category for smoke testing",
          isActive: true,
        },
        { headers: adminAuth() },
      );
      if (res.status !== 200)
        throw new Error(`Got ${res.status}: ${res.data.message}`);
      createdCategoryId = res.data.data[0]._id;
      if (!createdCategoryId) throw new Error("No category ID in response");
      log.info(`Created category ID: ${createdCategoryId}`);
    });

    await test("GET  /admin/categories (READ list, verify created)", async () => {
      const res = await api.get("/admin/categories", { headers: adminAuth() });
      if (res.status !== 200) throw new Error(`Got ${res.status}`);

      const found = res.data.data.find(
        (c) => c._id?.toString() === createdCategoryId,
      );
      if (!found) throw new Error("Created category not in list");
    });

    await test("GET  /admin/category/:categoryId (READ one)", async () => {
      const res = await api.get(`/admin/category/${createdCategoryId}`, {
        headers: adminAuth(),
      });
      if (res.status !== 200) throw new Error(`Got ${res.status}`);
      if (res.data.data[0]._id?.toString() !== createdCategoryId)
        throw new Error("Wrong category returned");
    });

    await test("PUT  /admin/update-category/:categoryId (UPDATE)", async () => {
      const res = await api.put(
        `/admin/update-category/${createdCategoryId}`,
        { name: "Updated Smoke Category" },
        { headers: adminAuth() },
      );
      if (res.status !== 200)
        throw new Error(`Got ${res.status}: ${res.data.message}`);

      // Verify update
      const check = await api.get(`/admin/category/${createdCategoryId}`, {
        headers: adminAuth(),
      });
      if (check.data.data[0].name !== "Updated Smoke Category")
        throw new Error("Category name not updated");
    });

    log.section("ADMIN - Stories CRUD");

    await test("POST /admin/add-story (CREATE)", async () => {
      const res = await api.post(
        "/admin/add-story",
        {
          title: "Admin Smoke Story",
          author: "Admin Tester",
          content: "Test content for admin-created story.",
          summary: "Admin test summary",
          status: "draft",
          categoryId: createdCategoryId,
          categoryName: "Updated Smoke Category",
        },
        { headers: adminAuth() },
      );
      if (res.status !== 200)
        throw new Error(`Got ${res.status}: ${res.data.message}`);
      createdAdminStoryId = res.data.data[0]._id;
      if (!createdAdminStoryId) throw new Error("No story ID in response");
      log.info(`Created admin story ID: ${createdAdminStoryId}`);
    });

    await test("GET  /admin/stories (READ list, verify created)", async () => {
      const res = await api.get("/admin/stories", { headers: adminAuth() });
      if (res.status !== 200) throw new Error(`Got ${res.status}`);

      const found = res.data.data.find(
        (s) => s._id?.toString() === createdAdminStoryId,
      );
      if (!found) throw new Error("Created story not in list");
    });

    await test("GET  /admin/stories?status=draft (filter)", async () => {
      const res = await api.get("/admin/stories?status=draft", {
        headers: adminAuth(),
      });
      if (res.status !== 200) throw new Error(`Got ${res.status}`);

      const found = res.data.data.find(
        (s) => s._id?.toString() === createdAdminStoryId,
      );
      if (!found) throw new Error("Draft story not in filter results");

      // Verify all results have status=draft
      const wrongStatus = res.data.data.find((s) => s.status !== "draft");
      if (wrongStatus)
        throw new Error(
          `Filter broken: found story with status=${wrongStatus.status}`,
        );
    });

    await test("GET  /admin/story/:storyId (READ one)", async () => {
      const res = await api.get(`/admin/story/${createdAdminStoryId}`, {
        headers: adminAuth(),
      });
      if (res.status !== 200) throw new Error(`Got ${res.status}`);
      if (res.data.data[0]._id?.toString() !== createdAdminStoryId)
        throw new Error("Wrong story returned");
    });

    await test("PUT  /admin/update-story/:storyId (UPDATE)", async () => {
      const res = await api.put(
        `/admin/update-story/${createdAdminStoryId}`,
        { title: "Updated Admin Smoke Story" },
        { headers: adminAuth() },
      );
      if (res.status !== 200)
        throw new Error(`Got ${res.status}: ${res.data.message}`);

      // Verify
      const check = await api.get(`/admin/story/${createdAdminStoryId}`, {
        headers: adminAuth(),
      });
      if (check.data.data[0].title !== "Updated Admin Smoke Story")
        throw new Error("Story title not updated");
    });

    await test("PATCH /admin/story-status/:storyId (publish)", async () => {
      const res = await api.patch(
        `/admin/story-status/${createdAdminStoryId}`,
        { status: "published" },
        { headers: adminAuth() },
      );
      if (res.status !== 200)
        throw new Error(`Got ${res.status}: ${res.data.message}`);

      // Verify
      const check = await api.get(`/admin/story/${createdAdminStoryId}`, {
        headers: adminAuth(),
      });
      if (check.data.data[0].status !== "published")
        throw new Error(
          `Status not changed: got ${check.data.data[0].status}, expected published`,
        );
    });

    log.section("ADMIN - Users");

    await test("GET  /admin/users (READ list, find test user)", async () => {
      const res = await api.get("/admin/users", { headers: adminAuth() });
      if (res.status !== 200) throw new Error(`Got ${res.status}`);

      const testUser = res.data.data.find((u) => u.mobile === TEST_MOBILE);
      if (!testUser) throw new Error("Test user not found in admin list");
    });

    await test("GET  /admin/users?status=Active (filter)", async () => {
      const res = await api.get("/admin/users?status=Active", {
        headers: adminAuth(),
      });
      if (res.status !== 200) throw new Error(`Got ${res.status}`);
    });

    if (createdUserId) {
      await test("GET  /admin/user/:userId (READ one)", async () => {
        const res = await api.get(`/admin/user/${createdUserId}`, {
          headers: adminAuth(),
        });
        if (res.status !== 200) throw new Error(`Got ${res.status}`);
        if (res.data.data[0]._id?.toString() !== createdUserId)
          throw new Error("Wrong user returned");
      });

      await test("PATCH /admin/suspend-user/:userId (suspend)", async () => {
        const res = await api.patch(
          `/admin/suspend-user/${createdUserId}`,
          { suspend: true },
          { headers: adminAuth() },
        );
        if (res.status !== 200)
          throw new Error(`Got ${res.status}: ${res.data.message}`);

        // Verify
        const check = await api.get(`/admin/user/${createdUserId}`, {
          headers: adminAuth(),
        });
        if (check.data.data[0].status !== "Suspended")
          throw new Error("User not suspended");
      });

      await test("PATCH /admin/suspend-user/:userId (reactivate)", async () => {
        const res = await api.patch(
          `/admin/suspend-user/${createdUserId}`,
          { suspend: false },
          { headers: adminAuth() },
        );
        if (res.status !== 200)
          throw new Error(`Got ${res.status}: ${res.data.message}`);

        const check = await api.get(`/admin/user/${createdUserId}`, {
          headers: adminAuth(),
        });
        if (check.data.data[0].status !== "Active")
          throw new Error("User not reactivated");
      });
    }

    log.section("ADMIN - Cleanup (DELETE operations)");

    if (createdAdminStoryId) {
      await test("DELETE /admin/delete-story/:storyId", async () => {
        const res = await api.delete(
          `/admin/delete-story/${createdAdminStoryId}`,
          { headers: adminAuth() },
        );
        if (res.status !== 200)
          throw new Error(`Got ${res.status}: ${res.data.message}`);

        // Verify
        const check = await api.get(`/admin/story/${createdAdminStoryId}`, {
          headers: adminAuth(),
        });
        if (check.status === 200)
          throw new Error("Story still exists after delete");
      });
    }

    if (createdCategoryId) {
      await test("DELETE /admin/delete-category/:categoryId", async () => {
        const res = await api.delete(
          `/admin/delete-category/${createdCategoryId}`,
          { headers: adminAuth() },
        );
        if (res.status !== 200)
          throw new Error(`Got ${res.status}: ${res.data.message}`);

        // Verify
        const check = await api.get(`/admin/category/${createdCategoryId}`, {
          headers: adminAuth(),
        });
        if (check.status === 200)
          throw new Error("Category still exists after delete");
      });
    }
  }

  /* ============================================================
     SECURITY CHECKS - tokens should not be interchangeable
     ============================================================ */
  log.section("Security Checks");

  if (userToken) {
    await test("User token should NOT access admin route", async () => {
      const res = await api.get("/admin/dashboard/overview", {
        headers: userAuth(),
      });
      if (res.status === 200)
        throw new Error("User token should be rejected on admin route");
    });
  }

  if (adminToken) {
    await test("Admin token should NOT access user route", async () => {
      const res = await api.get("/profile", { headers: adminAuth() });
      if (res.status === 200)
        throw new Error("Admin token should be rejected on user route");
    });
  }

  await test("No token should fail on protected route", async () => {
    const res = await api.get("/profile");
    if (res.status === 200) throw new Error("Missing token should not succeed");
  });

  await test("Invalid token should fail", async () => {
    const res = await api.get("/profile", {
      headers: { Authorization: "Bearer invalid-token-xyz" },
    });
    if (res.status === 200) throw new Error("Invalid token should not succeed");
  });

  await test("Malformed Authorization header should fail", async () => {
    const res = await api.get("/profile", {
      headers: { Authorization: "NotBearer xyz" },
    });
    if (res.status === 200) throw new Error("Bad header should not succeed");
  });

  /* ============================================================
     FINAL CLEANUP - Remove test user from DB
     ============================================================ */
  log.section("FINAL CLEANUP");

  try {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const result = await db
      .collection("users")
      .deleteMany({ mobile: TEST_MOBILE });
    log.info(`Cleaned up ${result.deletedCount} test user(s)`);
    await client.close();
    log.pass("Final cleanup complete");
  } catch (err) {
    log.warn(`Cleanup failed: ${err.message}`);
  }

  /* ============================================================
     SUMMARY
     ============================================================ */
  console.log(
    `\n${colors.cyan}${colors.bold}╔══════════════════════════════════════════╗${colors.reset}`,
  );
  console.log(
    `${colors.cyan}${colors.bold}║              SUMMARY                      ║${colors.reset}`,
  );
  console.log(
    `${colors.cyan}${colors.bold}╚══════════════════════════════════════════╝${colors.reset}`,
  );
  console.log(`Total:   ${passCount + failCount}`);
  console.log(`${colors.green}Passed:  ${passCount}${colors.reset}`);
  console.log(`${colors.red}Failed:  ${failCount}${colors.reset}`);

  if (failCount > 0) {
    console.log(`\n${colors.red}Failed tests:${colors.reset}`);
    results
      .filter((r) => r.status === "FAIL")
      .forEach((r) => console.log(`  - ${r.name}: ${r.error}`));
    process.exit(1);
  } else {
    console.log(
      `\n${colors.green}${colors.bold}🎉 All tests passed!${colors.reset}\n`,
    );
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error(
    `\n${colors.red}Test runner crashed:${colors.reset}`,
    err.message,
  );
  if (err.code === "ECONNREFUSED") {
    console.error(
      `${colors.yellow}Hint: Is your server running? Try 'npm start' in another terminal.${colors.reset}`,
    );
  }
  if (err.message?.includes("MONGO")) {
    console.error(
      `${colors.yellow}Hint: Check MONGO_URI in your .env file. Is MongoDB running?${colors.reset}`,
    );
  }
  process.exit(1);
});
