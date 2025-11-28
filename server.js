const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const session = require("express-session");
const expressLayouts = require("express-ejs-layouts");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- Configuration ---
const PORT = 3000;
const SESSION_SECRET = "very secret secret key fsdnsefoufesn";

// --- Game Constants & Data ---
const AI_NAMES = [
    "AI Tinker",
    "AI Poppy",
    "AI Breezey",
    "AI Riff",
    "AI Sparky",
    "AI Doodle",
    "AI Bop",
    "AI Whisk",
    "AI Zippy",
];
const CARDS = [
    "r0",
    "r1",
    "r2",
    "r3",
    "r4",
    "r5",
    "r6",
    "r7",
    "r8",
    "r9",
    "rp",
    "rs",
    "rr",
    "b0",
    "b1",
    "b2",
    "b3",
    "b4",
    "b5",
    "b6",
    "b7",
    "b8",
    "b9",
    "bp",
    "bs",
    "br",
    "g0",
    "g1",
    "g2",
    "g3",
    "g4",
    "g5",
    "g6",
    "g7",
    "g8",
    "g9",
    "gp",
    "gs",
    "gr",
    "y0",
    "y1",
    "y2",
    "y3",
    "y4",
    "y5",
    "y6",
    "y7",
    "y8",
    "y9",
    "yp",
    "ys",
    "yr",
    "sc",
    "scr",
    "scg",
    "scb",
    "scy",
    "sp",
    "spr",
    "spg",
    "spb",
    "spy",
    "card_back",
];

const rooms = {};

// --- Middleware ---
const sessionMiddleware = session({
    secret: SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }, // 24 hours
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

// --- Helper Functions ---

const mod = (n, m) => ((n % m) + m) % m;

const shuffle = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

const generateRoomName = () => "Room " + Math.floor(1000 + Math.random() * 9000);

class Room {
    constructor(id, name, password) {
        this.id = id;
        this.name = name;
        this.password = password;
        this.players = [];
        this.deck = [];
        this.discard = [];
        this.reversed = false;
        this.current_player = 0;
        this.state = "l"; // l = lobby, s = start/setup, n = normal, p2/p4 = draw states
        this.plus = 1;
    }
}

// --- Game Logic Functions ---

function setUpDeck() {
    let deck = [];
    ["r", "g", "b", "y"].forEach((color) => {
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, "p", "s", "r"].forEach((type) => {
            deck.push(color + type + "0");
            deck.push(color + type + "1");
        });
    });
    for (let i = 0; i < 4; i++) {
        deck.push("sp" + i);
        deck.push("sc" + i);
    }
    return shuffle(deck);
}

function discardToDeck(roomId) {
    const room = rooms[roomId];
    if (!room) return;
    const oldDiscard = room.discard.slice(0, -1);
    const topCard = room.discard[room.discard.length - 1];

    const recycledCards = oldDiscard.map((c) => c.substring(0, 3));
    room.deck.push(...recycledCards);
    room.discard = [topCard];
    shuffle(room.deck);
}

function skipTurn(roomId, skip = 1) {
    const room = rooms[roomId];
    if (!room) return;
    const direction = room.reversed ? -skip : skip;
    room.current_player = mod(room.current_player + direction, room.players.length);
}

function isPlayable(topCard, card) {
    if (card[0] === "s") return true;

    // Handle colored wildcards (e.g. 'scr' becomes 'r') for comparison
    let activeTop = topCard;
    if (activeTop.length === 4) {
        activeTop = activeTop[3] + activeTop.substring(1);
    }

    return card[0] === activeTop[0] || card[1] === activeTop[1];
}

function botPickColor(hand) {
    // Count colors
    const counts = {};
    hand.forEach((card) => {
        const color = card[0];
        counts[color] = (counts[color] || 0) + 1;
    });

    // Find most common
    let maxColor = "";
    let maxCount = -1;

    Object.entries(counts).forEach(([color, count]) => {
        if (count > maxCount) {
            maxCount = count;
            maxColor = color;
        }
    });

    if (maxColor && maxColor !== "s") return maxColor;
    return ["r", "g", "b", "y"][hand.length % 4];
}

function updateRoom(roomId, delay = 0) {
    if (!rooms[roomId]) return;
    io.to(roomId).emit("room_update", { room: rooms[roomId], delay: delay });
    playBots(roomId);
}

function playBots(roomId) {
    const room = rooms[roomId];
    if (!room || room.current_player >= room.players.length) return;

    const current = room.players[room.current_player];
    if (!current.bot) return;

    // Simulate thinking delay
    setTimeout(() => {
        // Re-check existence after delay
        if (!rooms[roomId]) return;

        let topCard = room.discard[room.discard.length - 1];
        let skip = 1;
        let played = false;

        // Logic for Draw 4 (sp) response
        if (topCard.substring(0, 2) === "sp" && room.plus > 1) {
            const cardIndex = current.hand.findIndex((c) => c.substring(0, 2) === "sp");
            if (cardIndex !== -1) {
                const card = current.hand.splice(cardIndex, 1)[0];
                const playedCard = card + botPickColor(current.hand);
                room.discard.push(playedCard);
                room.state = "p4";
                room.plus += room.plus !== 1 ? 4 : 3;
                played = true;
            }
        }
        // Logic for Draw 2 (p) response
        else if (topCard[1] === "p" && room.plus > 1) {
            const cardIndex = current.hand.findIndex((c) => c[1] === "p" && c[0] !== "s");
            if (cardIndex !== -1) {
                const card = current.hand.splice(cardIndex, 1)[0];
                room.discard.push(card);
                room.state = "p2";
                room.plus += room.plus !== 1 ? 2 : 1;
                played = true;
            }
        }
        // Normal Play
        else {
            if (topCard.length === 4) topCard = topCard[3] + ".";

            // Try to play regular card
            let cardIndex = current.hand.findIndex((c) => (c[0] === topCard[0] || c[1] === topCard[1]) && c[0] !== "s");

            if (cardIndex !== -1) {
                const card = current.hand.splice(cardIndex, 1)[0];
                room.state = "n";
                if (card[1] === "s") skip = 2;
                else if (card[1] === "r") room.reversed = !room.reversed;
                else if (card[1] === "p") {
                    room.plus += room.plus !== 1 ? 2 : 1;
                    room.state = "p2";
                }
                room.discard.push(card);
                played = true;
            }

            // If no regular card, try special
            if (!played) {
                cardIndex = current.hand.findIndex((c) => c[0] === "s");
                if (cardIndex !== -1) {
                    const card = current.hand.splice(cardIndex, 1)[0];
                    room.state = "n";
                    const playedCard = card + botPickColor(current.hand);
                    if (playedCard[1] === "p") {
                        room.plus += room.plus !== 1 ? 4 : 3;
                        room.state = "p4";
                    }
                    room.discard.push(playedCard);
                    played = true;
                }
            }
        }

        // Must Draw
        if (!played) {
            if (room.deck.length < room.plus + 1) discardToDeck(roomId);

            const cardsDrawn = room.deck.splice(-room.plus);
            current.hand.push(...cardsDrawn);
            room.state = "n";
            room.plus = 1;
        }

        // Check Win Condition
        if (current.hand.length === 0) {
            io.to(roomId).emit("room_update", { room: room, delay: 0 });
            room.state = "l";
            current.score += 1;
            room.players.forEach((p) => {
                if (!p.bot) p.ready = false;
            });
            io.to(roomId).emit("room_update", { room: room, delay: 200 });
            return;
        }

        skipTurn(roomId, skip);
        updateRoom(roomId, Math.floor(Math.random() * 600) + 800); // 800-1400ms delay
    }, Math.floor(Math.random() * 600) + 800); // Initial think delay
}

// --- Express Routes ---

app.get("/", (req, res) => {
    if (!req.session.userId) {
        req.session.userId = uuidv4().replace(/-/g, "");
        req.session.name = "Guest";
    }
    res.render("index", { session: req.session });
});

app.post("/get_rooms", (req, res) => {
    // Cleanup empty rooms first
    Object.keys(rooms).forEach((key) => {
        if (rooms[key].players.length === 0) delete rooms[key];
    });

    const search = (req.body.search || "").toLowerCase();
    const roomList = Object.values(rooms)
        .filter((r) => r.name.toLowerCase().includes(search))
        .map((r) => ({
            name: r.name,
            length: r.players.length,
            id: r.id,
        }))
        .slice(0, 4);

    // Render partial view
    res.render("partials/rooms_list", { layout: false, rooms: roomList });
});

app.post("/update_name", (req, res) => {
    const name = req.body.name;
    req.session.name = name && name !== "" ? name : "Guest";
    res.send("");
});

app.get("/create_room/:name/:password", (req, res) => {
    let name = req.params.name.substring(5);
    let password = req.params.password.substring(9);

    if (name === "") name = generateRoomName();

    const id = uuidv4().replace(/-/g, "");
    rooms[id] = new Room(id, name, password);

    res.redirect("/room/" + id + "/password:" + password);

    io.to("lobby").emit("rooms_changed");
});

app.get("/room_password/:id", (req, res) => {
    const room = rooms[req.params.id];
    res.send(room ? room.password : "");
});

app.get("/room/:id/:password", (req, res) => {
    const id = req.params.id;
    const password = req.params.password;

    if (!req.session.userId) {
        req.session.userId = uuidv4().replace(/-/g, "");
        req.session.name = "Guest";
    }

    if (!rooms[id]) return res.redirect("/");
    if (rooms[id].password !== password.substring(9)) return res.redirect("/");

    const playerIds = rooms[id].players.map((p) => p.id);
    if (!playerIds.includes(req.session.userId)) {
        if (rooms[id].state !== "l" || rooms[id].players.length > 3) {
            return res.redirect("/");
        }
    }

    req.session.roomId = id;
    res.render("room", { session: req.session, cards: CARDS });
});

// --- Socket.IO Events ---

io.on("connection", (socket) => {
    const session = socket.request.session;
    const playerId = session.userId;
    const playerName = session.name;
    const roomId = session.roomId;

    if (!roomId || !rooms[roomId]) return;

    socket.join(roomId);
    socket.join("lobby");

    // Player Join / Reconnect Logic
    const room = rooms[roomId];
    const existingPlayer = room.players.find((p) => p.id === playerId);

    if (!existingPlayer) {
        room.players.push({
            id: playerId,
            name: playerName,
            ready: false,
            hand: [],
            bot: false,
            score: 0,
        });
        updateRoom(roomId);
    } else {
        existingPlayer.bot = false;
        existingPlayer.name = playerName;
        socket.emit("reconnect", { room: room, delay: 0 });
    }

    socket.on("disconnect", () => {
        if (!rooms[roomId]) return;

        const player = room.players.find((p) => p.id === playerId);
        if (player) {
            console.log(playerId, "disconnected");
            player.bot = true;

            // Assign random AI name
            const currentNames = room.players.map((p) => p.name);
            const availableNames = AI_NAMES.filter((n) => !currentNames.includes(n));
            player.name =
                availableNames.length > 0
                    ? availableNames[Math.floor(Math.random() * availableNames.length)]
                    : "AI Bot";
        }

        // Check if everyone is a bot
        const botCount = room.players.filter((p) => p.bot).length;
        if (botCount === room.players.length) {
            delete rooms[roomId];
            return;
        }

        if (room.state === "l") {
            // Remove player if in lobby
            room.players = room.players.filter((p) => p.id !== playerId);
            room.players.forEach((p) => {
                if (!p.bot) p.ready = false;
            });
            updateRoom(roomId);
        } else {
            // Let bot take over
            playBots(roomId);
        }

        io.to("lobby").emit("rooms_changed");
    });

    socket.on("player_ready", () => {
        const player = room.players.find((p) => p.id === playerId);
        if (player) player.ready = true;

        if (room.players.every((p) => p.ready)) {
            // Start Game
            room.deck = setUpDeck();
            room.discard = [room.deck.pop()];
            room.current_player = 0;
            room.reversed = false;
            room.state = "s";
            room.plus = 1;

            // Ensure top card isn't special start
            while (room.discard[room.discard.length - 1][0] === "s") {
                room.discard.push(room.deck.pop());
            }

            room.players.forEach((p) => {
                p.hand = [];
                for (let i = 0; i < 7; i++) p.hand.push(room.deck.pop());
            });
            updateRoom(roomId);
        } else {
            updateRoom(roomId);
        }

        io.to("lobby").emit("rooms_changed");
    });

    socket.on("draw_card", () => {
        room.state = "n";

        if (room.deck.length < room.plus + 1) discardToDeck(roomId);

        if (room.plus !== 1) {
            skipTurn(roomId);
        } else if (!isPlayable(room.discard[room.discard.length - 1], room.deck[room.deck.length - 1])) {
            skipTurn(roomId);
        }

        const cardsDrawn = room.deck.splice(-room.plus);
        const player = room.players.find((p) => p.id === playerId);
        if (player) player.hand.push(...cardsDrawn);

        room.plus = 1;
        updateRoom(roomId);
    });

    socket.on("play_card", (card) => {
        room.state = "n";
        let skip = 1;

        const player = room.players.find((p) => p.id === playerId);
        if (!player) return;

        // Remove card from hand
        const cardIdx = player.hand.indexOf(card);
        if (cardIdx > -1) player.hand.splice(cardIdx, 1);
        room.discard.push(card);

        // Win check
        if (player.hand.length === 0) {
            io.to(roomId).emit("room_update", { room: room, delay: 0 });
            player.score += 1;
            room.state = "l";
            room.players.forEach((p) => {
                if (!p.bot) p.ready = false;
            });
            io.to(roomId).emit("room_update", { room: room, delay: 200 });
            return;
        }

        // Card Effects
        if (card[0] === "s") {
            skip = 0; // Wait for color pick
            if (card[1] === "p") {
                room.state = "p4";
                room.plus += room.plus !== 1 ? 4 : 3;
            }
        } else {
            if (card[1] === "p") {
                room.state = "p2";
                room.plus += room.plus !== 1 ? 2 : 1;
            } else if (card[1] === "s") {
                skip = 2;
            } else if (card[1] === "r") {
                room.reversed = !room.reversed;
            }
        }

        skipTurn(roomId, skip);
        updateRoom(roomId);
    });

    socket.on("color_picker", (color) => {
        const top = room.discard[room.discard.length - 1];
        room.discard[room.discard.length - 1] = top + color;
        skipTurn(roomId);
        updateRoom(roomId);
    });

    socket.on("add_bot", () => {
        const currentNames = room.players.map((p) => p.name);
        const availableNames = AI_NAMES.filter((n) => !currentNames.includes(n));
        const name = availableNames[Math.floor(Math.random() * availableNames.length)] || "Bot";

        room.players.push({
            id: uuidv4().replace(/-/g, ""),
            name: name,
            ready: true,
            hand: [],
            bot: true,
            score: 0,
        });
        updateRoom(roomId);
    });

    socket.on("remove_bot", (botId) => {
        room.players = room.players.filter((p) => p.id !== botId);
        updateRoom(roomId);
    });
});

server.listen(PORT, () => {
    console.log(`MONO server running on port ${PORT}`);
});
