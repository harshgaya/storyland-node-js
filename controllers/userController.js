let userService = require("../services/userServices");

module.exports = {
  /* ============================================================
     AUTH
     ============================================================ */

  createUser: (req, res, next) => {
    userService
      .createUser(req.body)
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

  sendOtp: (req, res, next) => {
    userService
      .sendOtp(req.body)
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

  verifyOtp: (req, res, next) => {
    userService
      .verifyOtp(req.body)
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

  loginWithPassword: (req, res, next) => {
    userService
      .loginWithPassword(req.body)
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
     PROFILE
     ============================================================ */

  getProfile: (req, res, next) => {
    userService
      .getProfile({ userId: req.userId })
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

  updateProfile: (req, res, next) => {
    userService
      .updateProfile({ userId: req.userId, ...req.body })
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

  changePassword: (req, res, next) => {
    userService
      .changePassword({ userId: req.userId, ...req.body })
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

  deleteAccount: (req, res, next) => {
    userService
      .deleteAccount({ userId: req.userId })
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
     STORIES - BROWSE
     ============================================================ */

  getHomeFeed: (req, res, next) => {
    userService
      .getHomeFeed({ userId: req.userId })
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

  getStoriesByCategory: (req, res) => {
    userService
      .getStoriesByCategory({
        categoryId: req.query.categoryId,
        categoryName: req.query.categoryName,
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

  getStoryDetails: (req, res, next) => {
    userService
      .getStoryDetails({ storyId: req.params.storyId })
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

  searchStories: (req, res, next) => {
    userService
      .searchStories(req.query)
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
     MY STORIES - user's own
     ============================================================ */

  getMyStories: (req, res, next) => {
    userService
      .getMyStories({ userId: req.userId, ...req.query })
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

  createMyStory: (req, res, next) => {
    userService
      .createMyStory({ userId: req.userId, ...req.body })
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

  updateMyStory: (req, res, next) => {
    userService
      .updateMyStory({
        userId: req.userId,
        storyId: req.params.storyId,
        ...req.body,
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

  deleteMyStory: (req, res, next) => {
    userService
      .deleteMyStory({
        userId: req.userId,
        storyId: req.params.storyId,
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
     FAVORITES
     ============================================================ */

  toggleFavorite: (req, res, next) => {
    userService
      .toggleFavorite({
        userId: req.userId,
        storyId: req.params.storyId,
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

  getFavorites: (req, res, next) => {
    userService
      .getFavorites({ userId: req.userId })
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
     READING PROGRESS
     ============================================================ */

  saveReadingProgress: (req, res, next) => {
    userService
      .saveReadingProgress({ userId: req.userId, ...req.body })
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

  getReadingHistory: (req, res, next) => {
    userService
      .getReadingHistory({ userId: req.userId })
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
     CATEGORIES (read-only)
     ============================================================ */

  getCategories: (req, res, next) => {
    userService
      .getCategories()
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
