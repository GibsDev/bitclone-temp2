const bitclone = require('./bitclone.js');
const utils = require('./utils.js');
const Connection = require('./connection.js');

// Handle commands related to the blockchain
class Peer extends Connection {

	constructor(socket) {
		super(socket);

		registerPeerCommands(this);
	}

	// TODO insert send functions for block commands

}

module.exports = Peer;

function registerPeerCommands(self) {
	// TODO setup listeners for block commands
}