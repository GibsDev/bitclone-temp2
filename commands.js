const utils = require('./utils.js');
const bitclone = require('./bitclone.js');

let mod = {};

// A list of commands and the number of fields
mod.commands = {
	version: 8,
	verack: 1,
	message: 3,
	reject: 3,
	ping: 1,
	pong: 1,
	addr: 2,
	getaddr: 0
}

mod.commandValidators = {};

// Should return true if valid, otherwise return an object with information about what went wrong
// Checks the validity of nonces
// Format for error return:
// { code: <code number>, reason: <reason>, details: <details> }
mod.isValid = (command, message, connection) => {
	if (mod.commandValidators[command] == undefined) {
		return { code: 400, reason: 'Unrecognized command', details: 'Received: ' + message };
	}
	return mod.commandValidators[command](message, connection);
}

mod.commandValidators.version = (message, connection) => {
	let split = message.split('|');
	if (split.length != 9) {
		return { code: 400, reason: 'Invalid # of params', details: 'Received: ' + message };
	}
	let version = parseInt(split[1]);
	if (!(version == 3 || version == 4)){
		return { code: 400, reason: 'Invalid version', details: 'Received: ' + message };
	}
	let services = parseInt(split[2]);
	if (isNaN(services)){
		return { code: 400, reason: 'Service field is NaN', details: 'Received: ' + message };
	} else if (services <= 0 || services > 7) {
		return { code: 400, reason: 'Invalid service value', details: 'Received: ' + message };
	}
	let currentTime = parseInt(split[3]);
	if (isNaN(currentTime)) {
		return { code: 400, reason: 'Current time field is NaN', details: 'Received: ' + message };
	}
	let recipiant;
	try {
		recipiant = utils.parseHost(split[4]);
	} catch (err) {
		return { code: 400, reason: 'Invalid recipient', details: 'Received: ' + message };
	}
	if (!matchIP(recipiant.hostname, connection.socket.localAddress) || recipiant.port != connection.socket.localPort){
		return { code: 400, reason: 'Recipiant does not match', details: 'Received: ' + message };
	}
	let sender;
	try {
		sender = utils.parseHost(split[5]);
	} catch (err) {
		return { code: 400, reason: 'Invalid sender', details: 'Received: ' + message };
	}
	// Can't check remote port
	if (!matchIP(sender.hostname, connection.socket.remoteAddress)) {
		return { code: 400, reason: 'Sender does not match', details: 'Received: ' + message };
	}
	let nonce = parseInt(split[6]);
	if (isNaN(nonce)){
		return { code: 400, reason: 'Nonce is NaN', details: 'Received: ' + message };
	}
	let block = parseInt(split[8]);
	if (isNaN(block)){
		return { code: 400, reason: 'Block is NaN', details: 'Received: ' + message };
	}
	return true;
}

mod.commandValidators.verack = (message, connection) => {
	let split = message.split('|');
	if (split.length != 2) {
		return { code: 400, reason: 'Invalid # of params', details: 'Received: ' + message };
	}
	let nonce = parseInt(split[1]);
	if (isNaN(nonce)){
		return { code: 400, reason: 'Nonce is NaN', details: 'Received: ' + message };
	}
	if (nonce != connection.nonce.version) {
		return { code: 400, reason: 'Nonce does not match', details: 'Received: ' + message };
	}
	return true;
}

mod.commandValidators.ping = (message, connection) => {
	let split = message.split('|');
	if (split.length != 2) {
		return { code: 400, reason: 'Invalid # of params', details: 'Received: ' + message };
	}
	let nonce = parseInt(split[1]);
	if (isNaN(nonce)) {
		return { code: 400, reason: 'Nonce is NaN', details: 'Received: ' + message };
	}
	return true;
}

mod.commandValidators.pong = (message, connection) => {
	let split = message.split('|');
	if (split.length != 2) {
		return { code: 400, reason: 'Invalid # of params', details: 'Received: ' + message };
	}
	let nonce = parseInt(split[1]);
	if (isNaN(nonce)) {
		return { code: 400, reason: 'Nonce is NaN', details: 'Received: ' + message };
	}
	if (nonce != connection.nonce.ping) {
		console.log(nonce);
		console.log(connection.nonce.ping);
		return { code: 400, reason: 'Nonce does not match', details: 'Received: ' + message };
	}
	return true;
}

mod.commandValidators.addr = (message, connection) => {
	let split = message.split('|');
	if (split.length < 4) {
		return { code: 400, reason: 'Invalid # of params', details: 'Received: ' + message };
	}
	let numPeers = parseInt(split[1]);
	if (isNaN(numPeers)){
		return { code: 400, reason: 'Number of peers is NaN', details: 'Received: ' + message };
	}
	if ((split.length - 2) / 2 != numPeers){
		return { code: 400, reason: 'Number of peers does not match list length', details: 'Received: ' + message };
	}
	for (let i = 2; i < split.length; i += 2){
		let time = parseInt(split[i]);
		if (isNaN(time)){
			return { code: 400, reason: 'Active time is NaN', details: 'Received: ' + message };
		}
		let peer = utils.parseHost(split[i + 1]);
		if (peer == null){
			return { code: 400, reason: 'Invalid peer', details: 'Received: ' + message };	
		}
	}
	return true;
}

mod.commandValidators.getaddr = (message, connection) => {
	let split = message.split('|');
	if (split.length != 1){
		return { code: 400, reason: 'Invalid # of params', details: 'Received: ' + message };
	}
	return true;
}

mod.commandValidators.message = (message, connection) => {
	let split = message.split('|');
	if (split.length < 4) {
		return { code: 400, reason: 'Invalid # of params', details: 'Received: ' + message };
	}
	let code = parseInt(split[1]);
	if (isNaN(code)){
		return { code: 400, reason: 'Response code is NaN', details: 'Received: ' + message };
	}
	return true;
}

mod.commandValidators.reject = (message, connection) => {
	let split = message.split('|');
	if (split.length < 4) {
		return { code: 400, reason: 'Invalid # of params', details: 'Received: ' + message };
	}
	let code = parseInt(split[1]);
	if (isNaN(code)) {
		return { code: 400, reason: 'Response code is NaN', details: 'Received: ' + message };
	}
	return true;
}

// Parses command from message
// Returns { command: <command>, fields: [<fields>] }
mod.parse = (message) => {
	// Remove any CRLF's
	message = message.trim();
	// Get command
	let command = message.split('|', 1)[0];
	let numFields = null;
	if (mod.commands[command] == undefined) {
		throw new Error(`Attempted to parse invalid command: '${command}'`);
	} else {
		numFields = mod.commands[command];
	}
	// Store the results
	const fields = [];
	// Process the message
	let subIndex = 0;
	let delimCounter = 0;
	for (let i = 0; i < message.length; i++) {
		if (message[i] == '|') {
			fields.push(message.substring(subIndex, i));
			subIndex = i + 1;
			delimCounter++;
			if (delimCounter == numFields) {
				break;
			}
		}
	}
	// Add the last field
	const lastField = message.substring(subIndex, message.length);
	if (lastField.length > 0) {
		fields.push(lastField);
	}
	// Remove command name
	fields.shift();
	return { command: command, fields: fields };
};

module.exports = mod;

// Checks if two IPs are the same for cases where an IPv4 gets wrapped in an IPv6
function matchIP(hostname1, hostname2) {
	return hostname1 == hostname2
		|| hostname1.includes(hostname2)
		|| hostname2.includes(hostname1);
}