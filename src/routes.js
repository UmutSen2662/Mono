const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const { CARDS } = require("./constants");
const { generateRoomName } = require("./utils");
const roomManager = require("./models/RoomManager");

module.exports = (io) => {
    // Home Page
    router.get("/", (req, res) => {
        if (!req.session.userId) {
            req.session.userId = uuidv4().replace(/-/g, "");
            req.session.name = "Guest";
        }
        res.render("index", { session: req.session });
    });

    // Get Rooms List (AJAX)
    router.post("/get_rooms", (req, res) => {
        roomManager.cleanup();
        const search = (req.body.search || "").toLowerCase();
        const roomList = roomManager
            .getAllRooms()
            .filter((r) => r.name.toLowerCase().includes(search))
            .map((r) => ({
                name: r.name,
                length: r.players.length,
                id: r.id,
            }))
            .slice(0, 4);
        res.render("partials/rooms_list", { layout: false, rooms: roomList });
    });

    // Update Name
    router.post("/update_name", (req, res) => {
        const name = req.body.name;
        req.session.name = name && name !== "" ? name : "Guest";
        res.send("");
    });

    // Create Room
    router.get("/create_room/:name/:password", (req, res) => {
        let name = req.params.name.substring(5);
        let password = req.params.password.substring(9);

        // Redundancy check: RoomManager handles this, but keeping it here is fine
        if (name === "") name = generateRoomName();

        const id = uuidv4().replace(/-/g, "");
        roomManager.createRoom(id, name, password);

        res.redirect("/room/" + id + "/password:" + password);
        io.to("lobby").emit("rooms_changed");
    });

    // Get Room Password (for checking before join)
    router.get("/room_password/:id", (req, res) => {
        const room = roomManager.getRoom(req.params.id);
        res.send(room ? room.password : "");
    });

    // Room Page
    router.get("/room/:id/:password", (req, res) => {
        const id = req.params.id;
        const password = req.params.password;

        if (!req.session.userId) {
            req.session.userId = uuidv4().replace(/-/g, "");
            req.session.name = "Guest";
        }

        const room = roomManager.getRoom(id);
        if (!room) return res.redirect("/");
        if (room.password !== password.substring(9)) return res.redirect("/");

        const playerIds = room.players.map((p) => p.id);
        if (!playerIds.includes(req.session.userId)) {
            if (room.state !== "l" || room.players.length > 3) {
                return res.redirect("/");
            }
        }

        req.session.roomId = id;
        res.render("room", { session: req.session, cards: CARDS });
    });

    return router;
};
