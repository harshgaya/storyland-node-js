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
      credentials: {
        accessKeyId: process.env.awsAccessKeyId,
        secretAccessKey: process.env.awsAccessKey,
      },
      region: "ap-south-1",
    });

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
      subcategoryId: data.subcategoryId || null,
      subcategoryName: data.subcategoryName || "",
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
    if (data.subcategoryId !== undefined)
      updates.subcategoryId = data.subcategoryId;
    if (data.subcategoryName !== undefined)
      updates.subcategoryName = data.subcategoryName;
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
   CATEGORIES (subcategories stored as embedded array)
   ============================================================ */

// Create a top-level category
const addCategory = (data) => {
  return new Promise(async (resolve, reject) => {
    const db = getDb();

    if (!data.name || data.name.trim().length === 0) {
      return reject({
        status: 400,
        message: "Category name is required",
        data: [],
      });
    }

    try {
      const count = await db.collection("categories").countDocuments({});

      const category = {
        name: data.name.trim(),
        imageUrl: data.imageUrl || "",
        description: data.description || "",
        isActive: data.isActive !== undefined ? data.isActive : true,
        order: count,
        subcategories: [], // embedded array
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await db.collection("categories").insertOne(category);
      resolve({
        status: 200,
        message: "Category created",
        data: [{ ...category, _id: result.insertedId }],
      });
    } catch (err) {
      reject({
        status: 400,
        message: "Could not create category",
        data: [],
        error: err.message,
      });
    }
  });
};

// Update category fields (name, image, description, active)
const updateCategory = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const categoryId = data.categoryId || data._id;

    if (!categoryId || !ObjectId.isValid(categoryId)) {
      return reject({
        status: 400,
        message: "Valid category ID is required",
        data: [],
      });
    }

    const updateFields = { updatedAt: new Date() };
    if (data.name !== undefined) updateFields.name = data.name.trim();
    if (data.imageUrl !== undefined) updateFields.imageUrl = data.imageUrl;
    if (data.description !== undefined) {
      updateFields.description = data.description;
    }
    if (data.isActive !== undefined) updateFields.isActive = data.isActive;

    db.collection("categories")
      .updateOne({ _id: new ObjectId(categoryId) }, { $set: updateFields })
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
      .catch((err) => {
        reject({
          status: 400,
          message: "Could not update category",
          data: [],
          error: err.message,
        });
      });
  });
};

// Delete a whole category
const deleteCategory = (data) => {
  return new Promise(async (resolve, reject) => {
    const db = getDb();
    const categoryId = data.categoryId || data._id;

    if (!categoryId || !ObjectId.isValid(categoryId)) {
      return reject({
        status: 400,
        message: "Valid category ID is required",
        data: [],
      });
    }

    try {
      const result = await db.collection("categories").deleteOne({
        _id: new ObjectId(categoryId),
      });
      if (result.deletedCount === 0) {
        return reject({
          status: 404,
          message: "Category not found",
          data: [],
        });
      }
      resolve({
        status: 200,
        message: "Category deleted",
        data: [],
      });
    } catch (err) {
      reject({
        status: 400,
        message: "Could not delete category",
        data: [],
        error: err.message,
      });
    }
  });
};

// Get one category with its subcategories + story count
const getCategoryDetails = (data) => {
  return new Promise(async (resolve, reject) => {
    const db = getDb();
    const categoryId = data.categoryId;

    if (!categoryId || !ObjectId.isValid(categoryId)) {
      return reject({
        status: 400,
        message: "Valid category ID is required",
        data: [],
      });
    }

    try {
      const category = await db.collection("categories").findOne({
        _id: new ObjectId(categoryId),
      });

      if (!category) {
        return reject({
          status: 404,
          message: "Category not found",
          data: [],
        });
      }

      const storyCount = await db.collection("stories").countDocuments({
        categoryId: new ObjectId(categoryId),
        status: "published",
      });

      // Sort embedded subcategories by order
      const subs = (category.subcategories || []).sort(
        (a, b) => (a.order || 0) - (b.order || 0),
      );

      resolve({
        status: 200,
        message: "Category fetched",
        data: [{ ...category, subcategories: subs, storyCount }],
      });
    } catch (err) {
      reject({
        status: 400,
        message: "Could not fetch category",
        data: [],
        error: err.message,
      });
    }
  });
};

// Get all top-level categories
const getAllCategories = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();

    db.collection("categories")
      .find({})
      .sort({ order: 1, name: 1 })
      .toArray()
      .then(async (categories) => {
        const enriched = await Promise.all(
          categories.map(async (cat) => {
            const storyCount = await db.collection("stories").countDocuments({
              categoryId: cat._id,
              status: "published",
            });
            return {
              ...cat,
              storyCount,
              subcategoryCount: (cat.subcategories || []).length,
            };
          }),
        );

        resolve({
          status: 200,
          message: "Categories fetched",
          data: enriched,
        });
      })
      .catch((err) => {
        reject({
          status: 400,
          message: "Could not fetch categories",
          data: [],
          error: err.message,
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

/* ----------- SUBCATEGORIES (operate on embedded array) ----------- */

// Add a subcategory to a category's array
const addSubcategory = (data) => {
  return new Promise(async (resolve, reject) => {
    const db = getDb();
    const { categoryId, name } = data;

    if (!categoryId || !ObjectId.isValid(categoryId)) {
      return reject({
        status: 400,
        message: "Valid category ID is required",
        data: [],
      });
    }
    if (!name || name.trim().length === 0) {
      return reject({
        status: 400,
        message: "Subcategory name is required",
        data: [],
      });
    }

    try {
      const category = await db.collection("categories").findOne({
        _id: new ObjectId(categoryId),
      });
      if (!category) {
        return reject({
          status: 404,
          message: "Category not found",
          data: [],
        });
      }

      const subcategory = {
        _id: new ObjectId(),
        name: name.trim(),
        order: (category.subcategories || []).length,
      };

      await db.collection("categories").updateOne(
        { _id: new ObjectId(categoryId) },
        {
          $push: { subcategories: subcategory },
          $set: { updatedAt: new Date() },
        },
      );

      resolve({
        status: 200,
        message: "Subcategory added",
        data: [subcategory],
      });
    } catch (err) {
      reject({
        status: 400,
        message: "Could not add subcategory",
        data: [],
        error: err.message,
      });
    }
  });
};

// Update a subcategory's name (positional $)
const updateSubcategory = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const { categoryId, subcategoryId, name } = data;

    if (!ObjectId.isValid(categoryId) || !ObjectId.isValid(subcategoryId)) {
      return reject({
        status: 400,
        message: "Valid category and subcategory IDs are required",
        data: [],
      });
    }
    if (!name || name.trim().length === 0) {
      return reject({
        status: 400,
        message: "Subcategory name is required",
        data: [],
      });
    }

    db.collection("categories")
      .updateOne(
        {
          _id: new ObjectId(categoryId),
          "subcategories._id": new ObjectId(subcategoryId),
        },
        {
          $set: {
            "subcategories.$.name": name.trim(),
            updatedAt: new Date(),
          },
        },
      )
      .then((result) => {
        if (result.matchedCount === 0) {
          return reject({
            status: 404,
            message: "Subcategory not found",
            data: [],
          });
        }
        resolve({
          status: 200,
          message: "Subcategory updated",
          data: [],
        });
      })
      .catch((err) => {
        reject({
          status: 400,
          message: "Could not update subcategory",
          data: [],
          error: err.message,
        });
      });
  });
};

// Delete a subcategory from the array ($pull)
const deleteSubcategory = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const { categoryId, subcategoryId } = data;

    if (!ObjectId.isValid(categoryId) || !ObjectId.isValid(subcategoryId)) {
      return reject({
        status: 400,
        message: "Valid category and subcategory IDs are required",
        data: [],
      });
    }

    db.collection("categories")
      .updateOne(
        { _id: new ObjectId(categoryId) },
        {
          $pull: { subcategories: { _id: new ObjectId(subcategoryId) } },
          $set: { updatedAt: new Date() },
        },
      )
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
          message: "Subcategory deleted",
          data: [],
        });
      })
      .catch((err) => {
        reject({
          status: 400,
          message: "Could not delete subcategory",
          data: [],
          error: err.message,
        });
      });
  });
};

// Reorder subcategories - replace array in the new order
const reorderSubcategories = (data) => {
  return new Promise(async (resolve, reject) => {
    const db = getDb();
    const { categoryId, orderedIds } = data;

    if (!ObjectId.isValid(categoryId) || !Array.isArray(orderedIds)) {
      return reject({
        status: 400,
        message: "Valid categoryId and orderedIds array are required",
        data: [],
      });
    }

    try {
      const category = await db.collection("categories").findOne({
        _id: new ObjectId(categoryId),
      });
      if (!category) {
        return reject({
          status: 404,
          message: "Category not found",
          data: [],
        });
      }

      const subs = category.subcategories || [];
      const reordered = orderedIds
        .map((id, index) => {
          const sub = subs.find((s) => s._id.toString() === id.toString());
          if (!sub) return null;
          return { ...sub, order: index };
        })
        .filter(Boolean);

      await db
        .collection("categories")
        .updateOne(
          { _id: new ObjectId(categoryId) },
          { $set: { subcategories: reordered, updatedAt: new Date() } },
        );

      resolve({
        status: 200,
        message: "Order updated",
        data: [],
      });
    } catch (err) {
      reject({
        status: 400,
        message: "Could not reorder subcategories",
        data: [],
        error: err.message,
      });
    }
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
          pagination: { hasMore, lastId, limit },
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
  adminLogin: wrap(adminLogin),
  changeAdminPassword: wrap(changeAdminPassword),
  updateAdminProfile: wrap(updateAdminProfile),
  generatePresignedUrl: wrap(generatePresignedUrl),

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
  getCategoryDetails: wrap(getCategoryDetails),
  updateCategory: wrap(updateCategory),
  deleteCategory: wrap(deleteCategory),

  // Subcategories
  addSubcategory: wrap(addSubcategory),
  updateSubcategory: wrap(updateSubcategory),
  deleteSubcategory: wrap(deleteSubcategory),
  reorderSubcategories: wrap(reorderSubcategories),

  // Users
  getAllUsers: wrap(getAllUsers),
  getUserById: wrap(getUserById),
  suspendUser: wrap(suspendUser),
  deleteUser: wrap(deleteUser),

  // Dashboard
  getDashboardOverview: wrap(getDashboardOverview),
  getRecentStories: wrap(getRecentStories),
};
