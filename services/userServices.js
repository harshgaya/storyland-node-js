const { getDb } = require("../dbConfig/dbConnection");
const { ObjectId } = require("mongodb");

const jwt = require("jsonwebtoken");
const utils = require("../utils/utils");
const bcrypt = require("bcryptjs");

const JWT_SECRET = process.env.JWT_SECRET || "storyland-secret-key-change-me";
const JWT_EXPIRY = process.env.JWT_EXPIRY || "30d";

const toObjectId = (id) => {
  if (!id) return null;
  if (id instanceof ObjectId) return id;
  if (typeof id === "string" && ObjectId.isValid(id)) return new ObjectId(id);
  return null;
};

/* ============================================================
   AUTH HELPERS
   ============================================================ */

const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user._id.toString(),
      mobile: user.mobile,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY },
  );
};

const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, otp, otpExpiry, ...safe } = user;
  return safe;
};

/* ============================================================
   AUTH - SIGNUP / LOGIN / OTP
   ============================================================ */

const createUser = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!data.mobile || data.mobile.length !== 10) {
      return reject({
        status: 400,
        message: "Valid 10-digit mobile number required",
        data: [],
      });
    }

    db.collection("users")
      .findOne({ mobile: data.mobile })
      .then((existing) => {
        if (existing) {
          return reject({
            status: 409,
            message: "User already exists with this mobile",
            data: [],
          });
        }
        const user = {
          name: data.name || "",
          email: data.email || "",
          mobile: data.mobile,
          countryCode: data.countryCode || "+91",
          password: data.password ? bcrypt.hashSync(data.password, 10) : null,
          image: data.image || "",
          role: "Reader",
          status: "Active",
          isPremium: false,
          storiesPublished: 0,
          storiesRead: 0,
          favorites: [],
          readingHistory: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        return db
          .collection("users")
          .insertOne(user)
          .then((result) => {
            const newUser = { _id: result.insertedId, ...user };
            const token = generateToken(newUser);
            resolve({
              status: 200,
              message: "User created",
              data: [{ user: sanitizeUser(newUser), token }],
            });
          });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to create user",
          data: [],
          error: error.message,
        });
      });
  });
};

const sendOtp = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const mobile = data.mobile;

    if (!mobile || mobile.length !== 10) {
      return reject({
        status: 400,
        message: "Valid 10-digit mobile number required",
        data: [],
      });
    }

    db.collection("users")
      .findOne({ mobile: mobile })
      .then((result) => {
        if (result) {
          // Existing user - send OTP
          utils
            .sendOtp(mobile)
            .then((result1) => {
              console.log(
                "result of otp sending message",
                result1["sessionId"],
              );
              const token = jwt.sign(
                { user_id: result["_id"], mobile: mobile },
                process.env.JWT_KEY,
                { expiresIn: process.env.expiresIn },
              );
              resolve({
                status: 200,
                message: "OTP sent successfully!",
                data: [
                  {
                    token: token,
                    name: result["name"] || "",
                    user_id: result["_id"],
                    sessionId: result1["sessionId"],
                  },
                ],
              });
            })
            .catch((err) => {
              console.log("error sending OTP", err);
              reject({
                status: 400,
                message: "Unable to send OTP.",
                data: [],
              });
            });
        } else {
          // New user - create then send OTP
          db.collection("users")
            .insertOne({
              name: "",
              email: "",
              mobile: mobile,
              countryCode: data.countryCode || "+91",
              role: "Reader",
              status: "Active",
              isPremium: false,
              storiesPublished: 0,
              storiesRead: 0,
              favorites: [],
              readingHistory: [],
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .then((result1) => {
              utils
                .sendOtp(mobile)
                .then((result) => {
                  console.log(
                    "result of otp sending message",
                    result["sessionId"],
                  );
                  const token = jwt.sign(
                    {
                      user_id: result1["insertedId"],
                      mobile: mobile,
                    },
                    process.env.JWT_KEY,
                    { expiresIn: process.env.expiresIn },
                  );
                  resolve({
                    status: 200,
                    message: "OTP sent successfully!",
                    data: [
                      {
                        token: token,
                        name: "",
                        user_id: result1["insertedId"],
                        sessionId: result["sessionId"],
                      },
                    ],
                  });
                })
                .catch((err) => {
                  console.log("error sending OTP", err);
                  reject({
                    status: 400,
                    message: "Unable to send OTP.",
                    data: [],
                  });
                });
            })
            .catch((error) => {
              console.log("error creating user", error);
              reject({
                status: 500,
                message: "Unable to send OTP.",
                data: [],
              });
            });
        }
      })
      .catch((err) => {
        console.log("error finding user", err);
        reject({
          status: 400,
          message: "Unable to send OTP.",
          data: [],
        });
      });
  });
};

const verifyOtp = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const { mobile, otp, sessionId } = data;

    if (!mobile || !otp || !sessionId) {
      return reject({
        status: 400,
        message: "Mobile, OTP and sessionId are required",
        data: [],
      });
    }

    utils
      .verifyOtp(data)
      .then((result) => {
        console.log("result of otp match", result);

        return db.collection("users").findOne({ mobile: mobile });
      })
      .then((user) => {
        if (!user) {
          return reject({
            status: 404,
            message: "User not found. Please request OTP first.",
            data: [],
          });
        }
        if (user.status === "Suspended") {
          return reject({
            status: 403,
            message: "Your account has been suspended.",
            data: [],
          });
        }

        return db
          .collection("users")
          .updateOne(
            { _id: user._id },
            { $set: { lastLogin: new Date(), updatedAt: new Date() } },
          )
          .then(() => {
            const token = jwt.sign(
              { user_id: user._id, mobile: mobile },
              process.env.JWT_KEY,
              { expiresIn: process.env.expiresIn },
            );
            const { password, ...safeUser } = user;
            resolve({
              status: 200,
              message: "OTP verified successfully!",
              data: [{ ...safeUser, token }],
            });
          });
      })
      .catch((err) => {
        console.log("error verify OTP", err);
        if (err && err.status) {
          return reject(err);
        }
        reject({
          status: 400,
          message: "OTP incorrect.",
          data: [],
        });
      });
  });
};

const loginWithPassword = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const { email, mobile, password } = data;
    if (!password || (!email && !mobile)) {
      return reject({
        status: 400,
        message: "Email/mobile and password are required",
        data: [],
      });
    }

    const filter = email ? { email } : { mobile };
    db.collection("users")
      .findOne(filter)
      .then((user) => {
        if (!user || !user.password) {
          return reject({
            status: 404,
            message: "Invalid credentials",
            data: [],
          });
        }
        if (user.status === "Suspended") {
          return reject({
            status: 403,
            message: "Your account has been suspended.",
            data: [],
          });
        }
        const matches = bcrypt.compareSync(password, user.password);
        if (!matches) {
          return reject({
            status: 401,
            message: "Invalid credentials",
            data: [],
          });
        }
        return db
          .collection("users")
          .updateOne(
            { _id: user._id },
            { $set: { lastLogin: new Date(), updatedAt: new Date() } },
          )
          .then(() => {
            const token = generateToken(user);
            resolve({
              status: 200,
              message: "Login successful",
              data: [{ user: sanitizeUser(user), token }],
            });
          });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to login",
          data: [],
          error: error.message,
        });
      });
  });
};

/* ============================================================
   PROFILE
   ============================================================ */

const getProfile = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const userObjId = toObjectId(data.userId);
    if (!userObjId) {
      return reject({
        status: 400,
        message: "Invalid user ID",
        data: [],
      });
    }
    db.collection("users")
      .findOne({ _id: userObjId })
      .then((user) => {
        if (!user) {
          return reject({
            status: 404,
            message: "User not found",
            data: [],
          });
        }
        resolve({
          status: 200,
          message: "Profile fetched",
          data: [sanitizeUser(user)],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to fetch profile",
          data: [],
          error: error.message,
        });
      });
  });
};

const updateProfile = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const updates = { updatedAt: new Date() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.email !== undefined) updates.email = data.email;
    if (data.image !== undefined) updates.image = data.image;
    if (data.quote !== undefined) updates.quote = data.quote;

    db.collection("users")
      .updateOne({ _id: new ObjectId(data.userId) }, { $set: updates })
      .then((result) => {
        if (result.matchedCount === 0) {
          return reject({
            status: 404,
            message: "User not found",
            data: [],
          });
        }
        resolve({
          status: 200,
          message: "Profile updated",
          data: [],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to update profile",
          data: [],
          error: error.message,
        });
      });
  });
};

const changePassword = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const { userId, oldPassword, newPassword } = data;
    if (!newPassword || newPassword.length < 6) {
      return reject({
        status: 400,
        message: "New password must be at least 6 characters",
        data: [],
      });
    }

    db.collection("users")
      .findOne({ _id: new ObjectId(userId) })
      .then((user) => {
        if (!user) {
          return reject({
            status: 404,
            message: "User not found",
            data: [],
          });
        }
        if (user.password) {
          const matches = bcrypt.compareSync(oldPassword || "", user.password);
          if (!matches) {
            return reject({
              status: 401,
              message: "Old password is incorrect",
              data: [],
            });
          }
        }
        const hashed = bcrypt.hashSync(newPassword, 10);
        return db
          .collection("users")
          .updateOne(
            { _id: new ObjectId(userId) },
            { $set: { password: hashed, updatedAt: new Date() } },
          );
      })
      .then(() => {
        resolve({
          status: 200,
          message: "Password updated",
          data: [],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to change password",
          data: [],
          error: error.message,
        });
      });
  });
};

const deleteAccount = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("users")
      .deleteOne({ _id: new ObjectId(data.userId) })
      .then((result) => {
        if (result.deletedCount === 0) {
          return reject({
            status: 404,
            message: "User not found",
            data: [],
          });
        }
        resolve({
          status: 200,
          message: "Account deleted",
          data: [],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to delete account",
          data: [],
          error: error.message,
        });
      });
  });
};

/* ============================================================
   STORIES - USER FACING (read, browse, search)
   ============================================================ */

const getHomeFeed = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    Promise.all([
      // Featured/recent published stories
      db
        .collection("stories")
        .find({ status: "published" })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray(),
      // All active categories
      db.collection("categories").find({ isActive: true }).toArray(),
      // User's reading history if userId provided
      data && data.userId
        ? db.collection("users").findOne({ _id: new ObjectId(data.userId) })
        : Promise.resolve(null),
    ])
      .then(([stories, categories, user]) => {
        let resumeStories = [];
        let continueReading = null;
        if (user && user.readingHistory && user.readingHistory.length > 0) {
          const inProgressIds = user.readingHistory
            .filter((h) => h.progress < 1)
            .map((h) => new ObjectId(h.storyId));
          // We'll just send the IDs; client can fetch details if needed
          resumeStories = user.readingHistory.filter((h) => h.progress < 1);
          if (resumeStories.length > 0) {
            continueReading = resumeStories[0];
          }
        }
        resolve({
          status: 200,
          message: "Home feed fetched",
          data: [
            {
              totalStories: stories.length,
              storiesCompleted:
                user && user.readingHistory
                  ? user.readingHistory.filter((h) => h.progress >= 1).length
                  : 0,
              resumeStoriesCount: resumeStories.length,
              continueReading,
              featuredStories: stories,
              categories,
            },
          ],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to fetch home feed",
          data: [],
          error: error.message,
        });
      });
  });
};

const getStoriesByCategory = (filters) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const query = { status: "published" };

    if (filters.categoryId) {
      try {
        query.categoryId = new ObjectId(filters.categoryId);
      } catch (e) {
        return reject({
          status: 400,
          message: "Invalid category id",
          data: [],
        });
      }
    }

    if (filters.lastId) {
      query._id = { $lt: new ObjectId(filters.lastId) };
    }

    const limit = parseInt(filters.limit) || 20;
    const sortField =
      filters.sort === "views" ? { views: -1, _id: -1 } : { _id: -1 };

    db.collection("stories")
      .find(query)
      .sort(sortField)
      .limit(limit)
      .toArray()
      .then((stories) => {
        const hasMore = stories.length === limit;
        const lastId =
          stories.length > 0
            ? stories[stories.length - 1]._id.toString()
            : null;
        resolve({
          status: 200,
          message: "Stories fetched",
          data: stories,
          pagination: { hasMore, lastId, limit },
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Could not fetch stories",
          data: [],
          error: error.message,
        });
      });
  });
};

const getStoryDetails = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const storyId = data.storyId;
    db.collection("stories")
      .findOneAndUpdate(
        { _id: new ObjectId(storyId), status: "published" },
        { $inc: { views: 1 } },
        { returnDocument: "after" },
      )
      .then((result) => {
        const story = result.value || result;
        if (!story) {
          return reject({
            status: 404,
            message: "Story not found",
            data: [],
          });
        }
        resolve({
          status: 200,
          message: "Story fetched",
          data: [story],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to fetch story",
          data: [],
          error: error.message,
        });
      });
  });
};

const searchStories = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const query = data.query || "";
    if (!query.trim()) {
      return resolve({
        status: 200,
        message: "Search results",
        data: [],
      });
    }
    db.collection("stories")
      .find({
        status: "published",
        $or: [
          { title: { $regex: query, $options: "i" } },
          { author: { $regex: query, $options: "i" } },
          { summary: { $regex: query, $options: "i" } },
          { categoryName: { $regex: query, $options: "i" } },
        ],
      })
      .toArray()
      .then((result) => {
        resolve({
          status: 200,
          message: "Search results",
          data: result,
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Search failed",
          data: [],
          error: error.message,
        });
      });
  });
};

/* ============================================================
   MY STORIES - user's own stories (drafts + published)
   ============================================================ */

const getMyStories = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const userObjId = toObjectId(data.userId);

    console.log("getMyStories - userId:", data.userId);
    console.log("getMyStories - userObjId:", userObjId);

    const filter = { authorId: userObjId };
    if (data.tab && data.tab !== "All") {
      if (data.tab === "Ongoing") filter.status = "ongoing";
      if (data.tab === "Completed") filter.status = "published";
      if (data.tab === "Drafts") filter.status = "draft";
    }

    console.log("getMyStories - filter:", JSON.stringify(filter));

    db.collection("stories")
      .find(filter)
      .sort({ updatedAt: -1 })
      .toArray()
      .then((result) => {
        console.log("getMyStories - found", result.length, "stories");
        resolve({
          status: 200,
          message: "My stories fetched",
          data: result,
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to fetch your stories",
          data: [],
          error: error.message,
        });
      });
  });
};

const createMyStory = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!data.title || !data.content) {
      return reject({
        status: 400,
        message: "Title and content are required",
        data: [],
      });
    }
    const story = {
      title: data.title,
      authorId: new ObjectId(data.userId),
      author: data.authorName || "",
      coverImage: data.coverImage || "",
      coverImageUrl: data.coverImageUrl || "",
      categoryId: data.categoryId ? new ObjectId(data.categoryId) : null,
      categoryName: data.categoryName || "",
      summary: data.summary || "",
      content: data.content,
      status: data.status || "draft",
      views: 0,
      likes: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    db.collection("stories")
      .insertOne(story)
      .then((result) => {
        // Bump user's storiesPublished count if published
        if (story.status === "published") {
          db.collection("users").updateOne(
            { _id: new ObjectId(data.userId) },
            { $inc: { storiesPublished: 1 } },
          );
        }
        resolve({
          status: 200,
          message: "Story created",
          data: [{ _id: result.insertedId, ...story }],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to create story",
          data: [],
          error: error.message,
        });
      });
  });
};

const updateMyStory = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const { userId, storyId } = data;
    const updates = { updatedAt: new Date() };
    if (data.title) updates.title = data.title;
    if (data.coverImage !== undefined) updates.coverImage = data.coverImage;
    if (data.coverImageUrl !== undefined)
      updates.coverImageUrl = data.coverImageUrl;
    if (data.categoryId) {
      updates.categoryId = new ObjectId(data.categoryId);
      updates.categoryName = data.categoryName || "";
    }
    if (data.summary !== undefined) updates.summary = data.summary;
    if (data.content) updates.content = data.content;
    if (data.status) updates.status = data.status;

    db.collection("stories")
      .updateOne(
        { _id: new ObjectId(storyId), authorId: new ObjectId(userId) },
        { $set: updates },
      )
      .then((result) => {
        if (result.matchedCount === 0) {
          return reject({
            status: 404,
            message: "Story not found or not yours",
            data: [],
          });
        }
        resolve({
          status: 200,
          message: "Story updated",
          data: [],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to update story",
          data: [],
          error: error.message,
        });
      });
  });
};

const deleteMyStory = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("stories")
      .deleteOne({
        _id: new ObjectId(data.storyId),
        authorId: new ObjectId(data.userId),
      })
      .then((result) => {
        if (result.deletedCount === 0) {
          return reject({
            status: 404,
            message: "Story not found or not yours",
            data: [],
          });
        }
        resolve({
          status: 200,
          message: "Story deleted",
          data: [],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to delete story",
          data: [],
          error: error.message,
        });
      });
  });
};

/* ============================================================
   FAVORITES / LIKES
   ============================================================ */

const toggleFavorite = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const { userId, storyId } = data;
    db.collection("users")
      .findOne({ _id: new ObjectId(userId) })
      .then((user) => {
        if (!user) {
          return reject({
            status: 404,
            message: "User not found",
            data: [],
          });
        }
        const favorites = user.favorites || [];
        const exists = favorites.some((id) => id.toString() === storyId);
        const operation = exists
          ? { $pull: { favorites: new ObjectId(storyId) }, $inc: {} }
          : { $addToSet: { favorites: new ObjectId(storyId) }, $inc: {} };
        return db
          .collection("users")
          .updateOne({ _id: new ObjectId(userId) }, operation)
          .then(() => {
            // Update story's like count
            return db
              .collection("stories")
              .updateOne(
                { _id: new ObjectId(storyId) },
                { $inc: { likes: exists ? -1 : 1 } },
              );
          })
          .then(() => {
            resolve({
              status: 200,
              message: exists ? "Removed from favorites" : "Added to favorites",
              data: [{ favorited: !exists }],
            });
          });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to toggle favorite",
          data: [],
          error: error.message,
        });
      });
  });
};

const getFavorites = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("users")
      .findOne({ _id: new ObjectId(data.userId) })
      .then((user) => {
        if (!user) {
          return reject({
            status: 404,
            message: "User not found",
            data: [],
          });
        }
        const favIds = user.favorites || [];
        if (favIds.length === 0) {
          return resolve({
            status: 200,
            message: "Favorites fetched",
            data: [],
          });
        }
        return db
          .collection("stories")
          .find({ _id: { $in: favIds } })
          .toArray()
          .then((stories) => {
            resolve({
              status: 200,
              message: "Favorites fetched",
              data: stories,
            });
          });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to fetch favorites",
          data: [],
          error: error.message,
        });
      });
  });
};

/* ============================================================
   READING PROGRESS
   ============================================================ */

const saveReadingProgress = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const { userId, storyId, currentPage, totalPages, progress } = data;
    db.collection("users")
      .updateOne(
        {
          _id: new ObjectId(userId),
          "readingHistory.storyId": storyId,
        },
        {
          $set: {
            "readingHistory.$.currentPage": currentPage,
            "readingHistory.$.totalPages": totalPages,
            "readingHistory.$.progress": progress,
            "readingHistory.$.lastReadAt": new Date(),
          },
        },
      )
      .then((result) => {
        if (result.matchedCount === 0) {
          // First time reading - push new entry
          return db.collection("users").updateOne(
            { _id: new ObjectId(userId) },
            {
              $push: {
                readingHistory: {
                  storyId,
                  currentPage,
                  totalPages,
                  progress,
                  lastReadAt: new Date(),
                },
              },
            },
          );
        }
      })
      .then(() => {
        resolve({
          status: 200,
          message: "Progress saved",
          data: [],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to save progress",
          data: [],
          error: error.message,
        });
      });
  });
};

const getReadingHistory = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("users")
      .findOne({ _id: new ObjectId(data.userId) })
      .then((user) => {
        if (!user) {
          return reject({
            status: 404,
            message: "User not found",
            data: [],
          });
        }
        resolve({
          status: 200,
          message: "Reading history fetched",
          data: user.readingHistory || [],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to fetch reading history",
          data: [],
          error: error.message,
        });
      });
  });
};

/* ============================================================
   CATEGORIES (read-only for users)
   ============================================================ */

const getCategories = () => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("categories")
      .find({ isActive: true })
      .toArray()
      .then((result) => {
        resolve({
          status: 200,
          message: "Categories fetched",
          data: result,
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to fetch categories",
          data: [],
          error: error.message,
        });
      });
  });
};

/* ============================================================
   JWT MIDDLEWARE (export for use in routes)
   ============================================================ */

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({
      status: 401,
      message: "No token provided",
      data: [],
    });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.userMobile = decoded.mobile;
    req.userEmail = decoded.email;
    next();
  } catch (error) {
    return res.status(401).send({
      status: 401,
      message: "Invalid or expired token",
      data: [],
    });
  }
};

/* ============================================================
   EXPORTS
   ============================================================ */

const wrap = (fn) => (data) =>
  new Promise((resolve, reject) => {
    return fn(data)
      .then((result) => {
        if (result && result.status == 200) {
          resolve(result);
        } else {
          reject(result);
        }
      })
      .catch((err) => {
        reject(err);
      });
  });

module.exports = {
  // Auth
  createUser: wrap(createUser),
  sendOtp: wrap(sendOtp),
  verifyOtp: wrap(verifyOtp),
  loginWithPassword: wrap(loginWithPassword),

  // Profile
  getProfile: wrap(getProfile),
  updateProfile: wrap(updateProfile),
  changePassword: wrap(changePassword),
  deleteAccount: wrap(deleteAccount),

  // Stories - browse
  getHomeFeed: wrap(getHomeFeed),
  getStoriesByCategory: wrap(getStoriesByCategory),
  getStoryDetails: wrap(getStoryDetails),
  searchStories: wrap(searchStories),

  // My Stories - user's own
  getMyStories: wrap(getMyStories),
  createMyStory: wrap(createMyStory),
  updateMyStory: wrap(updateMyStory),
  deleteMyStory: wrap(deleteMyStory),

  // Favorites
  toggleFavorite: wrap(toggleFavorite),
  getFavorites: wrap(getFavorites),

  // Reading progress
  saveReadingProgress: wrap(saveReadingProgress),
  getReadingHistory: wrap(getReadingHistory),

  // Categories
  getCategories: wrap(getCategories),

  // Middleware (export for routes)
  verifyToken,
};
