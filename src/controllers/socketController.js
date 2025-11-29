const { GAME_STATES } = require("../constants");
const roomManager = require("../models/RoomManager");

function updateRoom(io, roomId, delay = 0, nextBotDelay = null) {
    const room = roomManager.getRoom(roomId);
    if (!room) return;
    io.to(roomId).emit("room_update", { room: room, delay: delay });
    playBots(io, roomId, nextBotDelay);
}

function handleWin(io, room, winner) {
    io.to(room.id).emit("room_update", { room: room, delay: 0 });

    // Wait for animation, then reset
    setTimeout(() => {
        const freshRoom = roomManager.getRoom(room.id);
        if (!freshRoom) return;

        freshRoom.resetToLobby();
        io.to(room.id).emit("room_update", { room: freshRoom, delay: 0 });
        io.to("lobby").emit("rooms_changed");
    }, 1000); // 1 second delay for the win animation
}

function playBots(io, roomId, customDelay = null) {
    const room = roomManager.getRoom(roomId);

    if (!room || room.state === "l") return;

    if (room.current_player >= room.players.length) return;

    const current = room.players[room.current_player];

    if (!current.bot) return;

    let timerDuration;
    if (customDelay !== null) {
        // Use the "Fast Pass" override (e.g. 400ms after drawing)
        timerDuration = customDelay;
    } else {
        const handSize = Math.max(1, current.hand.length);
        const baseDelay = 500;
        const scalingDelay = Math.log(handSize) * 360;
        const randomVariation = Math.random() * 240;

        timerDuration = Math.floor(baseDelay + scalingDelay + randomVariation);
    }

    const botMove = room.getBotMove();
    if (!botMove) return;

    const currentMatchId = botMove.matchId;

    setTimeout(() => {
        const freshRoom = roomManager.getRoom(roomId);
        if (!freshRoom) return;
        if (freshRoom.state === "l") return;
        if (freshRoom.matchId !== currentMatchId) return;

        // Execute logic
        const result = freshRoom.executeBotLogic();

        if (result && result.winner) {
            handleWin(io, freshRoom, result.winner);
            return;
        }

        // Fast Pass Check
        let nextDelay = null;
        if (result && result.keepTurn) {
            nextDelay = 400;
        }

        // Pass the calculated delay to the next update
        updateRoom(io, roomId, 0, nextDelay);
    }, timerDuration);
}

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
            const success = room.addPlayer(playerId, playerName, false);
            if (success) updateRoom(io, roomId);
        } else {
            existingPlayer.name = playerName;
            existingPlayer.bot = false; // Reclaimed by human
            socket.emit("reconnect", { room: room, delay: 0 });
        }

        // --- Disconnect ---
        socket.on("disconnect", () => {
            if (!roomManager.getRoom(roomId)) return;
            const player = room.players.find((p) => p.id === playerId);

            if (player) {
                // Mark as bot temporarily
                player.bot = true;
                player.name = "AI Replaced";
            }

            // If everyone is gone/bot, delete room
            const humans = room.players.filter((p) => !p.bot).length;
            if (humans === 0) {
                roomManager.removeRoom(roomId);
            } else if (room.state === GAME_STATES.LOBBY) {
                room.removePlayer(playerId);
                updateRoom(io, roomId);
            } else {
                playBots(io, roomId);
            }
            io.to("lobby").emit("rooms_changed");
        });

        // --- Game Events ---
        socket.on("player_ready", () => {
            room.setReady(playerId, true);
            if (room.tryStartGame()) {
                updateRoom(io, roomId);
            } else {
                updateRoom(io, roomId);
            }
            io.to("lobby").emit("rooms_changed");
        });

        socket.on("draw_card", () => {
            room.drawCard(playerId);
            updateRoom(io, roomId);
        });

        socket.on("play_card", (card) => {
            const result = room.playCard(playerId, card);

            if (result && result.winner) {
                handleWin(io, room, result.winner);
            } else {
                updateRoom(io, roomId);
            }
        });

        socket.on("color_picker", (color) => {
            room.pickColor(playerId, color);
            updateRoom(io, roomId);
        });

        socket.on("add_bot", () => {
            room.addBot();
            updateRoom(io, roomId);
        });

        socket.on("remove_bot", (botId) => {
            room.removePlayer(botId);
            updateRoom(io, roomId);
            io.to("lobby").emit("rooms_changed");
        });
    });
};
