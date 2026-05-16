require("dotenv").config();
const express = require("express");
const cors = require("cors");
const compression = require("compression");
const bodyParser = require("body-parser");
const helmet = require("helmet");
const routes = require("./routes/api-routes");

const IPAddress = "0.0.0.0";
const mongoConnect = require("./dbConfig/dbConnection").mongoConnect;

const v8 = require("v8");

const app = express();
app.use(compression());
app.use(
  express.json({
    limit: "50mb",
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  }),
);
console.log(v8.getHeapStatistics().heap_size_limit / 1024 / 1024 + " MB");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ limit: "50mb", extended: true }));
app.use(helmet());
app.use(cors());

//cors
app.all("/*", (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin,X-Requested-With,Content-Type, Accept",
  );
  next();
});

app.use("/api", routes);

process.on("uncaughtException", (e) => {
  console.log("uncaught exception", e);
});
app.get("/", (req, res) => {
  res.send("Welcome Storyland API");
});

///
app.use((error, req, res, next) => {
  res.status(error.status || 500).send({
    status: error.status || 500,
    message: error.message || "Internal Server Error",
    data: [],
  });
});

mongoConnect()
  .then((result) => {
    app.listen(process.env.PORT || 3000, IPAddress, () => {
      console.log(
        `server started and running on http://${IPAddress}:${process.env.PORT}`,
      );
    });
  })
  .catch((err) => {
    app.use((req, res, next) => {
      res.status(500).send({
        status: 500,
        message: "Internal Server Error: Database connection failed",
        data: [],
      });
    });
    console.log("Database connection failed:", err.message);
  });
