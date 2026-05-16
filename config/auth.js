const jwt = require("jsonwebtoken");

exports.verifyToken = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token)
    res.status(403).send({
      error: "you are not authorise to access this resource",
      status: 403,
    });
  else {
    jwt.verify(token.split(" ")[1], process.env.JWT_KEY, (err, value) => {
      if (err) {
        res.status(500).send([
          {
            error: "failed to authenticate token",
            status: 500,
            data: [],
          },
        ]);
      } else {
        next();
      }
    });
  }
};
