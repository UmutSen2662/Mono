const { v4: uuidv4 } = require("uuid");
const { AI_NAMES } = require("../constants");
const { setUpDeck, discardToDeck, isPlayable, botPickColor, executeBotTurn } = require("../gameEngine");
const roomManager = require("../models/RoomManager");

// Helper: Updates the room and triggers bots
function updateRoom(io, roomId, delay = 0) {
    const room = roomManager.getRoom(roomId);
    if (!room) return;
    io.to(roomId).emit("room_update", { room: room, delay: delay });
    playBots(io, roomId);
}

function playBots(io, roomId) {
    const room = roomManager.getRoom(roomId);
    if (!room || room.state === "l") return;
    if (room.current_player >= room.players.length) return;

    const current = room.players[room.current_player];
    if (!current.bot) return;

    // Simulate thinking delay
    setTimeout(() => {
        // Re-check existence after delay (in case room died while thinking)
        if (!roomManager.getRoom(roomId)) return;

        // 1. Let the Engine do the work
        const result = executeBotTurn(room);

        // 2. Handle Win Condition
        if (result.won) {
            io.to(roomId).emit("room_update", { room: room, delay: 0 });
            room.state = "l";
            current.score += 1;
            room.players.forEach((p) => {
                if (!p.bot) p.ready = false;
            });
            io.to(roomId).emit("room_update", { room: room, delay: 200 });
            return;
        }

        // 3. Handle Continue
        room.skipTurn(result.skip);
        updateRoom(io, roomId, Math.floor(Math.random() * 600) + 800);
    }, Math.floor(Math.random() * 600) + 800);
}

// --- Main Socket Controller ---
module.exports = (io) => {
    io.on("connection", (socket) => {
        const session = socket.request.session;
        const playerId = session.userId;
        const playerName = session.name;
        const roomId = session.roomId;

        if (!roomId || !roomManager.getRoom(roomId)) return;

        socket.join(roomId);
        socket.join("lobby");

        const room = roomManager.getRoom(roomId);
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
            updateRoom(io, roomId);
        } else {
            existingPlayer.bot = false;
            existingPlayer.name = playerName;
            socket.emit("reconnect", { room: room, delay: 0 });
        }

        socket.on("disconnect", () => {
            if (!roomManager.getRoom(roomId)) return;
            const player = room.players.find((p) => p.id === playerId);
            if (player) {
                console.log(playerId, "disconnected");
                player.bot = true;
                const currentNames = room.players.map((p) => p.name);
                const availableNames = AI_NAMES.filter((n) => !currentNames.includes(n));
                player.name =
                    availableNames.length > 0
                        ? availableNames[Math.floor(Math.random() * availableNames.length)]
                        : "AI Bot";
            }

            const botCount = room.players.filter((p) => p.bot).length;
            if (botCount === room.players.length) {
                roomManager.removeRoom(roomId);
                return;
            }

            if (room.state === "l") {
                room.players = room.players.filter((p) => p.id !== playerId);
                room.players.forEach((p) => {
                    if (!p.bot) p.ready = false;
                });
                updateRoom(io, roomId);
            } else {
                playBots(io, roomId);
            }
            io.to("lobby").emit("rooms_changed");
        });

        socket.on("player_ready", () => {
            if (room.state !== "l") return;

            const player = room.players.find((p) => p.id === playerId);
            if (player) player.ready = true;

            if (room.players.every((p) => p.ready)) {
                room.deck = setUpDeck();
                room.discard = [room.deck.pop()];
                room.current_player = 0;
                room.reversed = false;
                room.state = "s";
                room.plus = 1;
                while (room.discard[room.discard.length - 1][0] === "s") {
                    room.discard.push(room.deck.pop());
                }
                room.players.forEach((p) => {
                    p.hand = [];
                    for (let i = 0; i < 7; i++) p.hand.push(room.deck.pop());
                });
                updateRoom(io, roomId);
            } else {
                updateRoom(io, roomId);
            }
            io.to("lobby").emit("rooms_changed");
        });

        socket.on("draw_card", () => {
            room.state = "n";
            if (room.deck.length < room.plus + 1) discardToDeck(room);
            if (room.plus !== 1) {
                room.skipTurn();
            } else if (!isPlayable(room.discard[room.discard.length - 1], room.deck[room.deck.length - 1])) {
                room.skipTurn();
            }
            const cardsDrawn = room.deck.splice(-room.plus);
            const player = room.players.find((p) => p.id === playerId);
            if (player) player.hand.push(...cardsDrawn);
            room.plus = 1;
            updateRoom(io, roomId);
        });

        socket.on("play_card", (card) => {
            room.state = "n";
            let skip = 1;
            const player = room.players.find((p) => p.id === playerId);
            if (!player) return;
            const cardIdx = player.hand.indexOf(card);
            if (cardIdx > -1) player.hand.splice(cardIdx, 1);
            room.discard.push(card);

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

            if (card[0] === "s") {
                skip = 0;
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
            room.skipTurn(skip);
            updateRoom(io, roomId);
        });

        socket.on("color_picker", (color) => {
            const top = room.discard[room.discard.length - 1];
            room.discard[room.discard.length - 1] = top + color;
            room.skipTurn();
            updateRoom(io, roomId);
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
            updateRoom(io, roomId);
        });

        socket.on("remove_bot", (botId) => {
            room.players = room.players.filter((p) => p.id !== botId);

            room.players.forEach((p) => {
                if (!p.bot) p.ready = false;
            });

            updateRoom(io, roomId);
            io.to("lobby").emit("rooms_changed");
        });
    });
};
