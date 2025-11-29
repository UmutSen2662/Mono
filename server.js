require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const session = require("express-session");
const expressLayouts = require("express-ejs-layouts");
const path = require("path");

// --- Custom Imports ---
const socketController = require("./src/controllers/socketController");
const routes = require("./src/routes");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- Configuration ---
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || "fallback_secret";

// Trust Caddy
app.set("trust proxy", 1);

// --- Middleware ---
const sessionMiddleware = session({
    secret: SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        secure: false, // Set to true ONLY if you are sure Caddy is passing https headers correctly
    },
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/public", express.static(path.join(__dirname, "public")));
app.use(sessionMiddleware);

app.use(expressLayouts);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("layout", "layout");

io.engine.use(sessionMiddleware);

// --- Initialize Controllers ---
socketController(io); // Handle Game Logic
app.use("/", routes(io)); // Handle Web Routes

// --- Start Server ---
server.listen(PORT, () => {
    console.log(`MONO server running on port ${PORT}`);
});
