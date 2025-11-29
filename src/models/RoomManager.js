const { mod, generateRoomName } = require("../utils");

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
        this.state = "l";
        this.plus = 1;
    }

    // Move logic that modifies ONLY the room state here
    skipTurn(skip = 1) {
        const direction = this.reversed ? -skip : skip;
        this.current_player = mod(this.current_player + direction, this.players.length);
    }
}

class RoomManager {
    constructor() {
        this.rooms = {};
    }

    createRoom(id, name, password) {
        if (!name) name = generateRoomName();
        const newRoom = new Room(id, name, password);
        this.rooms[id] = newRoom;
        return newRoom;
    }

    getRoom(id) {
        return this.rooms[id];
    }

    removeRoom(id) {
        delete this.rooms[id];
    }

    // Helper for your lobby list
    getAllRooms() {
        return Object.values(this.rooms);
    }

    // Cleanup empty rooms
    cleanup() {
        Object.keys(this.rooms).forEach((key) => {
            if (this.rooms[key].players.length === 0) {
                delete this.rooms[key];
            }
        });
    }
}

// Export a single instance so the state is shared
module.exports = new RoomManager();
