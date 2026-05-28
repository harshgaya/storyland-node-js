const express = require("express");
const router = express.Router();
let userController = require("../controllers/userController");
let adminController = require("../controllers/adminController");

const auth = require("../config/auth");
module.exports = router;

/* ============================================================
   ============================================================
                       USER ROUTES
   ============================================================
   ============================================================ */

/* ============== USER - PUBLIC (no token) ============== */
router.post("/signup", userController.createUser);
router.post("/send-otp", userController.sendOtp);
router.post("/verify-otp", userController.verifyOtp);
router.post("/login", userController.loginWithPassword);
router.get("/categories", userController.getCategories);

/* ============== USER - PROFILE ============== */
router.get("/profile", userController.getProfile);
router.put("/profile", userController.updateProfile);
router.put("/change-password", userController.changePassword);
router.delete("/delete-account", userController.deleteAccount);

/* ============== USER - STORIES (browse) ============== */
router.get("/home", userController.getHomeFeed);
router.get("/stories", userController.getStoriesByCategory);
router.get("/search-stories", userController.searchStories);
router.get("/story/:storyId", userController.getStoryDetails);

/* ============== USER - MY STORIES ============== */
router.get("/my-stories", userController.getMyStories);
router.post("/my-stories", userController.createMyStory);
router.put("/my-stories/:storyId", userController.updateMyStory);
router.delete("/my-stories/:storyId", userController.deleteMyStory);

/* ============== USER - FAVORITES ============== */
router.get("/favorites", userController.getFavorites);
router.post("/favorites/:storyId", userController.toggleFavorite);

/* ============== USER - READING PROGRESS ============== */
router.get("/reading-history/:userId", userController.getReadingHistory);
router.post("/save-reading-progress", userController.saveReadingProgress);

/* ============================================================
   ============================================================
                       ADMIN ROUTES
   ============================================================
   ============================================================ */

/* ============== ADMIN - AUTH (no token for login) ============== */
router.post("/admin/login", adminController.adminLogin);

/* ============== ADMIN - PROFILE ============== */
router.put("/admin/change-password", adminController.changeAdminPassword);
router.put("/admin/profile", adminController.updateAdminProfile);

/* ============== ADMIN - DASHBOARD ============== */
router.get("/admin/dashboard/overview", adminController.getDashboardOverview);
router.get("/admin/dashboard/recent-stories", adminController.getRecentStories);

/* ============== ADMIN - STORIES ============== */
router.post("/admin/add-story", adminController.addStory);
router.get("/admin/stories", adminController.getAllStories);
router.post(
  "/admin/generatePresignedUrl",
  adminController.generatePresignedUrl,
);
router.get("/admin/story/:storyId", adminController.getStoryById);
router.put("/admin/update-story/:storyId", adminController.updateStory);
router.delete("/admin/delete-story/:storyId", adminController.deleteStory);
router.patch("/admin/story-status/:storyId", adminController.changeStoryStatus);

/* ============== ADMIN - CATEGORIES ============== */
router.get("/admin/categories", adminController.getAllCategories);
router.get("/admin/category/:categoryId", adminController.getCategoryById);
router.post("/admin/add-category", adminController.addCategory);
router.post("/admin/category", adminController.addCategory);
router.put("/admin/category/:id", adminController.updateCategory);
router.delete("/admin/category/:id", adminController.deleteCategory);
router.get("/admin/category-details/:id", adminController.getCategoryDetails);

/* ============== ADMIN - SUBCATEGORIES (embedded in category) ============== */
router.post("/admin/category/:id/subcategory", adminController.addSubcategory);
router.put(
  "/admin/category/:id/subcategory/:subId",
  adminController.updateSubcategory,
);
router.delete(
  "/admin/category/:id/subcategory/:subId",
  adminController.deleteSubcategory,
);
router.post(
  "/admin/category/:id/subcategories-reorder",
  adminController.reorderSubcategories,
);

/* ============== ADMIN - USERS ============== */
router.get("/admin/users", adminController.getAllUsers);
router.get("/admin/user/:userId", adminController.getUserById);
router.patch("/admin/suspend-user/:userId", adminController.suspendUser);
router.delete("/admin/delete-user/:userId", adminController.deleteUser);
