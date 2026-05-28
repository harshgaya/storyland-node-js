let adminService = require("../services/adminServices");

module.exports = {
  /* ============================================================
     AUTH
     ============================================================ */

  adminLogin: (req, res, next) => {
    adminService
      .adminLogin(req.body)
      .then((result) => {
        res.status(result.status || 200).send(result);
      })
      .catch((err) => {
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message ? err.message : "Internal server error.",
          data: err.data || [],
        });
      });
  },

  generatePresignedUrl: (req, res, next) => {
    adminService
      .generatePresignedUrl(req.body)
      .then((result) => {
        if (result && result.status === 200) {
          res.status(result.status || 200).send(result);
        } else {
          res.status(result.status || 400).send(result);
        }
      })
      .catch((err) => {
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message ? err.message : "Internal server error.",
          data: [],
        });
      });
  },

  changeAdminPassword: (req, res, next) => {
    adminService
      .changeAdminPassword(req.body)
      .then((result) => {
        res.status(result.status || 200).send(result);
      })
      .catch((err) => {
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message ? err.message : "Internal server error.",
          data: err.data || [],
        });
      });
  },

  updateAdminProfile: (req, res, next) => {
    adminService
      .updateAdminProfile(req.body)
      .then((result) => {
        res.status(result.status || 200).send(result);
      })
      .catch((err) => {
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message ? err.message : "Internal server error.",
          data: err.data || [],
        });
      });
  },

  /* ============================================================
     STORIES
     ============================================================ */

  addStory: (req, res, next) => {
    adminService
      .addStory(req.body)
      .then((result) => {
        res.status(result.status || 200).send(result);
      })
      .catch((err) => {
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message ? err.message : "Internal server error.",
          data: err.data || [],
        });
      });
  },

  getAllStories: (req, res) => {
    adminService
      .getAllStories({
        status: req.query.status,
        categoryId: req.query.categoryId,
        search: req.query.search,
        sort: req.query.sort,
        limit: req.query.limit,
        lastId: req.query.lastId,
      })
      .then((r) => res.status(r.status || 200).send(r))
      .catch((e) =>
        res.status(e.status || 500).send({
          status: e.status || 500,
          message: e.message,
          data: e.data || [],
        }),
      );
  },

  getStoryById: (req, res, next) => {
    adminService
      .getStoryById({ storyId: req.params.storyId })
      .then((result) => {
        res.status(result.status || 200).send(result);
      })
      .catch((err) => {
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message ? err.message : "Internal server error.",
          data: err.data || [],
        });
      });
  },

  updateStory: (req, res, next) => {
    adminService
      .updateStory({ storyId: req.params.storyId, ...req.body })
      .then((result) => {
        res.status(result.status || 200).send(result);
      })
      .catch((err) => {
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message ? err.message : "Internal server error.",
          data: err.data || [],
        });
      });
  },

  deleteStory: (req, res, next) => {
    adminService
      .deleteStory({ storyId: req.params.storyId })
      .then((result) => {
        res.status(result.status || 200).send(result);
      })
      .catch((err) => {
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message ? err.message : "Internal server error.",
          data: err.data || [],
        });
      });
  },

  changeStoryStatus: (req, res, next) => {
    adminService
      .changeStoryStatus({
        storyId: req.params.storyId,
        status: req.body.status,
      })
      .then((result) => {
        res.status(result.status || 200).send(result);
      })
      .catch((err) => {
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message ? err.message : "Internal server error.",
          data: err.data || [],
        });
      });
  },

  /* ============================================================
     CATEGORIES
     ============================================================ */

  addCategory: (req, res, next) => {
    adminService
      .addCategory(req.body)
      .then((result) => res.status(result.status || 200).send(result))
      .catch((err) =>
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message || "Internal server error.",
          data: err.data || [],
        }),
      );
  },

  updateCategory: (req, res, next) => {
    adminService
      .updateCategory({
        ...req.body,
        categoryId: req.params.id || req.body.categoryId,
      })
      .then((result) => res.status(result.status || 200).send(result))
      .catch((err) =>
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message || "Internal server error.",
          data: err.data || [],
        }),
      );
  },

  deleteCategory: (req, res, next) => {
    adminService
      .deleteCategory({ categoryId: req.params.id })
      .then((result) => res.status(result.status || 200).send(result))
      .catch((err) =>
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message || "Internal server error.",
          data: err.data || [],
        }),
      );
  },

  getCategoryDetails: (req, res, next) => {
    adminService
      .getCategoryDetails({ categoryId: req.params.id })
      .then((result) => res.status(result.status || 200).send(result))
      .catch((err) =>
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message || "Internal server error.",
          data: err.data || [],
        }),
      );
  },

  getAllCategories: (req, res, next) => {
    adminService
      .getAllCategories()
      .then((result) => {
        res.status(result.status || 200).send(result);
      })
      .catch((err) => {
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message ? err.message : "Internal server error.",
          data: err.data || [],
        });
      });
  },

  getCategoryById: (req, res, next) => {
    adminService
      .getCategoryById({ categoryId: req.params.categoryId })
      .then((result) => {
        res.status(result.status || 200).send(result);
      })
      .catch((err) => {
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message ? err.message : "Internal server error.",
          data: err.data || [],
        });
      });
  },

  /* ============================================================
     SUBCATEGORIES (embedded in parent category)
     ============================================================ */

  addSubcategory: (req, res, next) => {
    adminService
      .addSubcategory({
        categoryId: req.params.id,
        name: req.body.name,
      })
      .then((result) => res.status(result.status || 200).send(result))
      .catch((err) =>
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message || "Internal server error.",
          data: err.data || [],
        }),
      );
  },

  updateSubcategory: (req, res, next) => {
    adminService
      .updateSubcategory({
        categoryId: req.params.id,
        subcategoryId: req.params.subId,
        name: req.body.name,
      })
      .then((result) => res.status(result.status || 200).send(result))
      .catch((err) =>
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message || "Internal server error.",
          data: err.data || [],
        }),
      );
  },

  deleteSubcategory: (req, res, next) => {
    adminService
      .deleteSubcategory({
        categoryId: req.params.id,
        subcategoryId: req.params.subId,
      })
      .then((result) => res.status(result.status || 200).send(result))
      .catch((err) =>
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message || "Internal server error.",
          data: err.data || [],
        }),
      );
  },

  reorderSubcategories: (req, res, next) => {
    adminService
      .reorderSubcategories({
        categoryId: req.params.id,
        orderedIds: req.body.orderedIds,
      })
      .then((result) => res.status(result.status || 200).send(result))
      .catch((err) =>
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message || "Internal server error.",
          data: err.data || [],
        }),
      );
  },

  /* ============================================================
     USERS
     ============================================================ */

  getAllUsers: (req, res) => {
    adminService
      .getAllUsers({
        status: req.query.status,
        search: req.query.search,
        limit: req.query.limit,
        lastId: req.query.lastId,
      })
      .then((r) => res.status(r.status || 200).send(r))
      .catch((e) =>
        res.status(e.status || 500).send({
          status: e.status || 500,
          message: e.message,
          data: e.data || [],
        }),
      );
  },

  getUserById: (req, res, next) => {
    adminService
      .getUserById({ userId: req.params.userId })
      .then((result) => {
        res.status(result.status || 200).send(result);
      })
      .catch((err) => {
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message ? err.message : "Internal server error.",
          data: err.data || [],
        });
      });
  },

  suspendUser: (req, res, next) => {
    adminService
      .suspendUser({ userId: req.params.userId, suspend: req.body.suspend })
      .then((result) => {
        res.status(result.status || 200).send(result);
      })
      .catch((err) => {
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message ? err.message : "Internal server error.",
          data: err.data || [],
        });
      });
  },

  deleteUser: (req, res, next) => {
    adminService
      .deleteUser({ userId: req.params.userId })
      .then((result) => {
        res.status(result.status || 200).send(result);
      })
      .catch((err) => {
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message ? err.message : "Internal server error.",
          data: err.data || [],
        });
      });
  },

  /* ============================================================
     DASHBOARD / ANALYTICS
     ============================================================ */

  getDashboardOverview: (req, res, next) => {
    adminService
      .getDashboardOverview()
      .then((result) => {
        res.status(result.status || 200).send(result);
      })
      .catch((err) => {
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message ? err.message : "Internal server error.",
          data: err.data || [],
        });
      });
  },

  getRecentStories: (req, res, next) => {
    adminService
      .getRecentStories(req.query)
      .then((result) => {
        res.status(result.status || 200).send(result);
      })
      .catch((err) => {
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message ? err.message : "Internal server error.",
          data: err.data || [],
        });
      });
  },
};
