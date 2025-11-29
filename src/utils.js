// Fixes JavaScript's negative modulo bug
const mod = (n, m) => ((n % m) + m) % m;

// Standard shuffle
const shuffle = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

const generateRoomName = () => "Room " + Math.floor(1000 + Math.random() * 9000);

module.exports = { mod, shuffle, generateRoomName };
