const { getDb } = require("../dbConfig/dbConnection");
const { ObjectId } = require("mongodb");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

/* ============================================================
   AUTH
   ============================================================ */

const generatePresignedUrl = async (data) => {
  return new Promise((resolve, reject) => {
    const s3Client = new S3Client({
      // endpoint:
      //   "https://91ec2d9461fbfd2dd2f24df18ac5cb16.r2.cloudflarestorage.com",
      credentials: {
        accessKeyId: process.env.awsAccessKeyId,
        secretAccessKey: process.env.awsAccessKey,
      },
      region: "ap-south-1",
    });

    // Define the parameters for the PutObjectCommand
    const command = new PutObjectCommand({
      Bucket: "happy-tokens",
      Key: `story-land/${data.fileName}`,
      ContentType: `${data.contentType}`,
    });
    getSignedUrl(s3Client, command, { expiresIn: 3600 })
      .then((result) => {
        resolve({
          status: 200,
          message: "generated signed url",
          data: [{ result }],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: `Unable to generate signed url ${error}`,
          data: [],
        });
      });
  });
};

const adminLogin = (data) => {
  const id = data.id;
  const password = data.password;
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("admins")
      .findOne({ id: id, password: password })
      .then((result) => {
        if (!result) {
          return reject({
            status: 404,
            message: "Invalid admin ID or password",
            data: [],
          });
        }
        const { password: _, ...safeAdmin } = result;
        resolve({
          status: 200,
          message: "Admin logged in",
          data: [safeAdmin],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to login admin",
          data: [],
          error: error.message,
        });
      });
  });
};

const changeAdminPassword = (data) => {
  const { adminId, oldPassword, newPassword } = data;
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("admins")
      .findOne({ _id: new ObjectId(adminId), password: oldPassword })
      .then((admin) => {
        if (!admin) {
          return reject({
            status: 404,
            message: "Old password is incorrect",
            data: [],
          });
        }
        return db
          .collection("admins")
          .updateOne(
            { _id: new ObjectId(adminId) },
            { $set: { password: newPassword, updatedAt: new Date() } },
          );
      })
      .then(() => {
        resolve({
          status: 200,
          message: "Password updated successfully",
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

const updateAdminProfile = (data) => {
  const { adminId, name, email, phone } = data;
  return new Promise((resolve, reject) => {
    const db = getDb();
    const updates = { updatedAt: new Date() };
    if (name) updates.name = name;
    if (email) updates.email = email;
    if (phone) updates.phone = phone;

    db.collection("admins")
      .updateOne({ _id: new ObjectId(adminId) }, { $set: updates })
      .then((result) => {
        if (result.matchedCount === 0) {
          return reject({
            status: 404,
            message: "Admin not found",
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

/* ============================================================
   STORIES
   ============================================================ */

const addStory = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const story = {
      title: data.title,
      author: data.author,
      coverImage: data.coverImage || "",
      coverImageUrl: data.coverImageUrl || "",
      audioUrl: data.audioUrl || "",
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
    if (!story.title || !story.content) {
      return reject({
        status: 400,
        message: "Title and content are required",
        data: [],
      });
    }

    db.collection("stories")
      .insertOne(story)
      .then((result) => {
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

const getAllStories = (filters) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const query = {};

    if (filters.status) {
      query.status = filters.status.toLowerCase();
    }
    if (filters.categoryId) {
      query.categoryId = new ObjectId(filters.categoryId);
    }
    if (filters.search) {
      const safe = filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { title: { $regex: safe, $options: "i" } },
        { author: { $regex: safe, $options: "i" } },
        { categoryName: { $regex: safe, $options: "i" } },
      ];
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
          pagination: {
            hasMore,
            lastId,
            limit,
          },
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

const getStoryById = (data) => {
  const storyId = data.storyId;
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("stories")
      .findOne({ _id: new ObjectId(storyId) })
      .then((result) => {
        if (!result) {
          return reject({
            status: 404,
            message: "Story not found",
            data: [],
          });
        }
        resolve({
          status: 200,
          message: "Story fetched",
          data: [result],
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

const updateStory = (data) => {
  const storyId = data.storyId;
  return new Promise((resolve, reject) => {
    const db = getDb();
    const updates = { updatedAt: new Date() };
    if (data.title) updates.title = data.title;
    if (data.author) updates.author = data.author;
    if (data.coverImage !== undefined) updates.coverImage = data.coverImage;
    if (data.coverImageUrl !== undefined)
      updates.coverImageUrl = data.coverImageUrl;
    if (data.audioUrl !== undefined) updates.audioUrl = data.audioUrl;
    if (data.categoryId) {
      updates.categoryId = new ObjectId(data.categoryId);
      updates.categoryName = data.categoryName || "";
    }
    if (data.summary !== undefined) updates.summary = data.summary;
    if (data.content) updates.content = data.content;
    if (data.status) updates.status = data.status;

    db.collection("stories")
      .updateOne({ _id: new ObjectId(storyId) }, { $set: updates })
      .then((result) => {
        if (result.matchedCount === 0) {
          return reject({
            status: 404,
            message: "Story not found",
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

const deleteStory = (data) => {
  const storyId = data.storyId;
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("stories")
      .deleteOne({ _id: new ObjectId(storyId) })
      .then((result) => {
        if (result.deletedCount === 0) {
          return reject({
            status: 404,
            message: "Story not found",
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

const changeStoryStatus = (data) => {
  const { storyId, status } = data;
  return new Promise((resolve, reject) => {
    const validStatuses = ["draft", "published", "archived"];
    if (!validStatuses.includes(status)) {
      return reject({
        status: 400,
        message: "Invalid status",
        data: [],
      });
    }
    const db = getDb();
    db.collection("stories")
      .updateOne(
        { _id: new ObjectId(storyId) },
        { $set: { status: status, updatedAt: new Date() } },
      )
      .then((result) => {
        if (result.matchedCount === 0) {
          return reject({
            status: 404,
            message: "Story not found",
            data: [],
          });
        }
        resolve({
          status: 200,
          message: `Story marked as ${status}`,
          data: [],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to change status",
          data: [],
          error: error.message,
        });
      });
  });
};

/* ============================================================
   CATEGORIES
   ============================================================ */

const addCategory = (data) => {
  return new Promise((resolve, reject) => {
    if (!data.name) {
      return reject({
        status: 400,
        message: "Category name is required",
        data: [],
      });
    }
    const db = getDb();
    const category = {
      name: data.name,
      emoji: data.emoji || "📚",
      description: data.description || "",
      isActive: data.isActive !== undefined ? data.isActive : true,
      storyCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    db.collection("categories")
      .insertOne(category)
      .then((result) => {
        resolve({
          status: 200,
          message: "Category created",
          data: [{ _id: result.insertedId, ...category }],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to create category",
          data: [],
          error: error.message,
        });
      });
  });
};

const getAllCategories = () => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("categories")
      .find({})
      .sort({ createdAt: -1 })
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

const getCategoryById = (data) => {
  const categoryId = data.categoryId;
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("categories")
      .findOne({ _id: new ObjectId(categoryId) })
      .then((result) => {
        if (!result) {
          return reject({
            status: 404,
            message: "Category not found",
            data: [],
          });
        }
        resolve({
          status: 200,
          message: "Category fetched",
          data: [result],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to fetch category",
          data: [],
          error: error.message,
        });
      });
  });
};

const updateCategory = (data) => {
  const categoryId = data.categoryId;
  return new Promise((resolve, reject) => {
    const db = getDb();
    const updates = { updatedAt: new Date() };
    if (data.name) updates.name = data.name;
    if (data.emoji) updates.emoji = data.emoji;
    if (data.description !== undefined) updates.description = data.description;
    if (data.isActive !== undefined) updates.isActive = data.isActive;

    db.collection("categories")
      .updateOne({ _id: new ObjectId(categoryId) }, { $set: updates })
      .then((result) => {
        if (result.matchedCount === 0) {
          return reject({
            status: 404,
            message: "Category not found",
            data: [],
          });
        }
        resolve({
          status: 200,
          message: "Category updated",
          data: [],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to update category",
          data: [],
          error: error.message,
        });
      });
  });
};

const deleteCategory = (data) => {
  const categoryId = data.categoryId;
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("categories")
      .deleteOne({ _id: new ObjectId(categoryId) })
      .then((result) => {
        if (result.deletedCount === 0) {
          return reject({
            status: 404,
            message: "Category not found",
            data: [],
          });
        }
        // Also clear categoryId from stories so they don't break
        return db
          .collection("stories")
          .updateMany(
            { categoryId: new ObjectId(categoryId) },
            { $set: { categoryId: null, categoryName: "" } },
          );
      })
      .then(() => {
        resolve({
          status: 200,
          message: "Category deleted",
          data: [],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to delete category",
          data: [],
          error: error.message,
        });
      });
  });
};

/* ============================================================
   USERS
   ============================================================ */

const getAllUsers = (filters) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const query = {};

    if (filters.status) {
      const s = filters.status.toLowerCase();
      if (s === "active") {
        query.status = "Active";
      } else if (s === "suspended") {
        query.status = "Suspended";
      } else if (s === "premium") {
        query.isPremium = true;
      }
    }

    if (filters.search) {
      const safe = filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { name: { $regex: safe, $options: "i" } },
        { email: { $regex: safe, $options: "i" } },
        { mobile: { $regex: safe, $options: "i" } },
      ];
    }

    if (filters.lastId) {
      query._id = { $lt: new ObjectId(filters.lastId) };
    }

    const limit = parseInt(filters.limit) || 20;

    db.collection("users")
      .find(query)
      .sort({ _id: -1 })
      .limit(limit)
      .toArray()
      .then((users) => {
        const hasMore = users.length === limit;
        const lastId =
          users.length > 0 ? users[users.length - 1]._id.toString() : null;
        resolve({
          status: 200,
          message: "Users fetched",
          data: users,
          pagination: {
            hasMore,
            lastId,
            limit,
          },
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Could not fetch users",
          data: [],
          error: error.message,
        });
      });
  });
};

const getUserById = (data) => {
  const userId = data.userId;
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("users")
      .findOne({ _id: new ObjectId(userId) })
      .then((result) => {
        if (!result) {
          return reject({
            status: 404,
            message: "User not found",
            data: [],
          });
        }
        resolve({
          status: 200,
          message: "User fetched",
          data: [result],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to fetch user",
          data: [],
          error: error.message,
        });
      });
  });
};

const suspendUser = (data) => {
  const { userId, suspend } = data;
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("users")
      .updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            status: suspend ? "Suspended" : "Active",
            updatedAt: new Date(),
          },
        },
      )
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
          message: suspend ? "User suspended" : "User reactivated",
          data: [],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to update user status",
          data: [],
          error: error.message,
        });
      });
  });
};

const deleteUser = (data) => {
  const userId = data.userId;
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("users")
      .deleteOne({ _id: new ObjectId(userId) })
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
          message: "User deleted",
          data: [],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to delete user",
          data: [],
          error: error.message,
        });
      });
  });
};

/* ============================================================
   DASHBOARD / ANALYTICS
   ============================================================ */

const getDashboardOverview = () => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    Promise.all([
      db.collection("stories").countDocuments({}),
      db.collection("stories").countDocuments({ status: "published" }),
      db.collection("users").countDocuments({}),
      db.collection("users").countDocuments({ status: "Active" }),
      db.collection("users").countDocuments({ isPremium: true }),
      db.collection("categories").countDocuments({}),
      db.collection("stories").countDocuments({
        createdAt: { $gte: sevenDaysAgo },
      }),
    ])
      .then(
        ([
          totalStories,
          publishedStories,
          totalUsers,
          activeUsers,
          premiumUsers,
          totalCategories,
          storiesLast7Days,
        ]) => {
          resolve({
            status: 200,
            message: "Dashboard overview fetched",
            data: [
              {
                totalStories,
                publishedStories,
                totalUsers,
                activeUsers,
                premiumUsers,
                totalCategories,
                storiesLast7Days,
              },
            ],
          });
        },
      )
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to fetch dashboard overview",
          data: [],
          error: error.message,
        });
      });
  });
};

const getRecentStories = (data) => {
  return new Promise((resolve, reject) => {
    const limit = (data && data.limit) || 5;
    const db = getDb();
    db.collection("stories")
      .find({})
      .sort({ updatedAt: -1 })
      .limit(limit)
      .toArray()
      .then((result) => {
        resolve({
          status: 200,
          message: "Recent stories fetched",
          data: result,
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to fetch recent stories",
          data: [],
          error: error.message,
        });
      });
  });
};

/* ============================================================
   EXPORTS - wrapped in same pattern as your original
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
  adminLogin: wrap(adminLogin),
  changeAdminPassword: wrap(changeAdminPassword),
  updateAdminProfile: wrap(updateAdminProfile),

  // Stories
  addStory: wrap(addStory),
  getAllStories: wrap(getAllStories),
  getStoryById: wrap(getStoryById),
  updateStory: wrap(updateStory),
  deleteStory: wrap(deleteStory),
  changeStoryStatus: wrap(changeStoryStatus),

  // Categories
  addCategory: wrap(addCategory),
  getAllCategories: wrap(getAllCategories),
  getCategoryById: wrap(getCategoryById),
  updateCategory: wrap(updateCategory),
  deleteCategory: wrap(deleteCategory),

  // Users
  getAllUsers: wrap(getAllUsers),
  getUserById: wrap(getUserById),
  suspendUser: wrap(suspendUser),
  deleteUser: wrap(deleteUser),

  // Dashboard
  getDashboardOverview: wrap(getDashboardOverview),
  getRecentStories: wrap(getRecentStories),
  generatePresignedUrl: wrap(generatePresignedUrl),
};
