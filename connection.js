const bitclone = require('./bitclone.js');
const net = require('net');
const EventEmitter = require('events');
const commands = require('./commands.js');
const utils = require('./utils.js');

// Socket message delimiter
const CRLF = '\r\n';
// Timeout for an inactive peer
const INACTIVE_TIMEOUT = 90000;
// Interval for ping
const PING_INTERVAL = 30000;

// Handshake bits
const V_SENT = 0b0001;
const V_GOT = 0b0010;
const VACK_SENT = 0b0100;
const VACK_GOT = 0b1000;

// Max user id length
const MAX_UID_LENGTH = 28;

// Counter to be used to hand out id's to connections
let id = 0;

// Shouldn't be instantiated alone (meant to be an abstract class for peer to help split up some code)
// Responsible for wiring up socket interaction and handshaking as well as handling all connection management commands
// Emits the command name along with the fields when a valid command is received
class Connection extends EventEmitter {

	constructor(socket) {
		super();

		this.id = ++id;

		// Max userid length
		this.MAX_UID_LENGTH = MAX_UID_LENGTH;

		// Link socket and peer
		this.socket = socket;
		this.socket.peer = this;

		// Note the direction of the connection
		this.inbound = this.socket.server != undefined;

		// Set timeout for inactive peer
		this.socket.setTimeout(INACTIVE_TIMEOUT);

		// Message buffer
		this.buffer = '';

		// Handshake status
		this.handshake = 0b0000;
		this.handshakeHandled = false;

		// The last time this connection was active
		this.active = 0;

		// A place to store outstanding nonces
		this.nonce = {};

		// Handle the basic socket events
		registerBasicSocketEvents(this);

		// Define actions to take when a valid command is received
		registerBasicCommands(this);

		// Initiate handshake if its our responsibility
		if (!this.inbound) {
			this.sendVersion();
		}

	}
	
	// Closes the socket / connection
	disconnect() {
		if (!this.socket.destroyed) {
			this.socket.destroy();
		}
	}
	
	// Sends a message over the socket
	send(message) {
		if (bitclone.debug) {
			console.log(this.getName() + ' <- ' + message);
		}
		this.socket.write(message.trim() + CRLF);
	}
	
	// Checks if all of the required messages for a handshake have been exchanged
	hasHandshaken() {
		return this.handshake == 0b1111;
	}
	
	// Something to help identify who or where this connection is
	getName() {
		let name = (this.inbound) ? '(i) ' : '(o) ';
		name += `[${this.id}] `;
		if (this.userid) {
			let userid = this.userid;
			// Trim or pad
			userid = userid.substring(0, this.MAX_UID_LENGTH).padEnd(this.MAX_UID_LENGTH);
			name += userid;
		} else {
			let hostname = this.socket.remoteAddress;
			let port = this.socket.remotePort;
			let userid = `${hostname}:${port}`;
			// Trim or pad
			userid = userid.substring(0, this.MAX_UID_LENGTH).padEnd(this.MAX_UID_LENGTH);
			name += userid;
		}
		return name;
	}
	
	// Send command functions
	
	sendVersion() {
		const nonce = utils.nonce();
		this.nonce.version = nonce;
		this.send(`version|${bitclone.version}|${bitclone.services}|${utils.getSeconds()}|${this.socket.remoteAddress}:${this.socket.remotePort}|${bitclone.hostname}:${bitclone.port}|${nonce}|${bitclone.userid}|${bitclone.block}`);
		this.handshake |= V_SENT;
	}
	
	sendVerack(nonce) {
		this.send('verack|' + nonce);
		this.handshake |= VACK_SENT;
	}
	
	sendReject(code, reason, details) {
		this.send(`reject|${code}|${reason}|${details}`);
	}
	
	sendMessage(code, reason, message) {
		this.send(`message|${code}|${reason}|${message}`);
	}

	sendPing() {
		const nonce = utils.nonce();
		this.nonce.ping = nonce;
		this.send(`ping|${nonce}`);
	}

	sendPong(nonce) {
		this.send('pong|' + nonce);
	}

	sendGetAddr() {
		this.send('getaddr');
	}

	// A list of addresses in the format:
	// { hostname: <h>, port: <p>, active: <a> }
	sendAddr(addresses) {
		let message = 'addr|' + addresses.length;
		for (let address of addresses) {
			message += `|${address.active}|${address.hostname}:${address.port}`;
		}
		this.send(message);
	}
}

module.exports = Connection;

// Private functions for Connection

// When a command is buffered from the connection (valid or not)
function onCommand(self, message) {
	if (bitclone.debug) {
		console.log(self.getName() + ' -> ' + message);
	}
	self.active = utils.getSeconds();
	const command = message.split('|', 1)[0];
	let valid = commands.isValid(command, message, self);
	if (valid && !valid.code) {
		let parsed = commands.parse(message);
		self.emit(command, parsed.fields);
	} else {
		self.sendReject(valid.code, valid.reason, valid.details);
	}
}

// When a socket closes
function onConnectionClosed(self) {
	console.log(self.getName() + ' -- connection closed');
}

// Register socket events
function registerBasicSocketEvents(self) {
	self.socket.on('timeout', () => {
		self.disconnect();
	});

	self.socket.on('error', err => {
		// console.log(err);
		// automatically emits 'close' immediately after
	});

	self.socket.on('close', () => {
		if (self.pingInterval) {
			clearInterval(self.pingInterval);
		}
		onConnectionClosed(self);
	});

	self.socket.on('data', data => {
		data = data.toString();
		self.buffer += data;
		const index = self.buffer.indexOf(CRLF);
		if (index != -1) {
			const message = self.buffer.substring(0, index);
			self.buffer = self.buffer.substring(index + 2);
			onCommand(self, message);
		}
	});
}

// Register command handlers
function registerBasicCommands(self) {
	self.on('version', fields => {
		self.userid = fields[6];
		self.host = fields[4];
		self.handshake |= V_GOT;
		// Send verack if we haven't yet
		if ((self.handshake & VACK_SENT) == 0) {
			self.sendVerack(fields[5]);
			self.handshake |= VACK_SENT;
		}
		checkHandshake(self);
	});

	self.on('verack', fields => {
		self.handshake |= VACK_GOT;
		checkHandshake(self);
	});

	self.on('reject', fields => {
		// Print out if its not already being printed in onMessage
		if (!bitclone.debug) {
			console.log(self.getName() + ' -> ' + message);
		}
	});
	
	self.on('message', fields => {
		// Print out if its not already being printed in onMessage
		if (!bitclone.debug) {
			console.log(self.getName() + ' -> ' + message);
		}
	});

	self.on('ping', fields => {
		self.sendPong(fields[0]);
	});

	// Handler for pong emitted
	
	self.on('getaddr', fields => {
		self.sendAddr();
	});

	// Handler for addr emitted
	// We have a handler for it in the peer manager
	
}

// On handshake complete
function onHandshakeComplete(self) {
	// Setup ping interval
	self.pingInterval = setInterval(() => {
		self.sendPing();
	}, PING_INTERVAL);
	// Send connected message
	self.sendMessage(100, 'Connection established', 'Handshake complete');
}

// Calls handshake complete if necessary also sends version if we have not
function checkHandshake(self) {
	if (self.hasHandshaken() && !self.handshakeHandled) {
		onHandshakeComplete(self);
		self.handshakeHandled = true;
		return;
	}
	if ((self.handshake & V_SENT) == 0) {
		self.sendVersion();
	}
}