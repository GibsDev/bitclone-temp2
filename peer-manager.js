const Peer = require('./peer.js');

const PREFERRED_PEERS = 5;

// A list of Peer objects
let peers = [];

// A list of semi verified peers
// Properties in format: '<hostname>:<port>': <active>
let addresses = {};

// TODO
let addressArchive = [];

// TODO A queue of host strings to be connected to
let queue = [];

// TODO setup saving and recovering to/from file
class PeerManager {

	newConnection(socket) {
		let peer = new Peer(socket);

		let self = this;
		
		peer.socket.on('close', () => {
			// Remove from peers
			peers = peers.filter(p => {
				return p.id != peer.id;
			});

			console.log(self.toString());
		});

		peer.socket.on('timeout', () => {
			// TODO filter that peer from the addr list
			// TODO we should keep some archive of successfully connected peers but do not send in addr
		});

		peer.on('version', fields => {
			// Check for duplicate connections
			if (self.isConnected(fields[4])) {
				peer.sendReject(400, 'Duplicate connection', 'Connection already established');
				peer.disconnect();
			}
		});

		peer.on('addr', fields => {
			let addrs = [];
			const addressCount = parseInt(fields[0]);
			const rawAddresses = fields[1].split('|');
			for (let i = 0; i < addressCount * 2; i += 2){
				try {
					let address = utils.parseHost(rawAddresses[i + 1]);
					address.active = parseInt(rawAddresses[i]);
					addrs.push(address);
				} catch (err) { }
			}
			self.updateAddresses(addrs);
		});

		peer.on('getaddr', fields => {
			peer.sendAddr(self.getAddresses());
		});

		// Add / disconnect based on space left
		if (peers.length < PREFERRED_PEERS) {
			peers.push(peer);
		} else {
			peer.sendReject(500, 'Connections full', 'Cannot accept any more connections');
			peer.disconnect();
		}

		console.log(this.toString());
	}

	// Accepts a list of addresses in the format:
	// [{ hostname: <h>, port: <p>, active: <a> }]
	updateAddresses(addrs) {
		for (let addr of addrs){
			let host = addr.hostname + ':' + addr.port;
			if (!addresses[host] || addresses[host] < addr.active) {
				addresses[host] = addr.active;
				// TODO send out an addr to all peers
			}
		}
	}

	// Returns a list in the format:
	// [{ hostname: <h>, port: <p>, active: <a> }]
	getAddresses() {
		let addrs = [];
		for (let addr in addresses) {
			const split = addr.split(':');
			addrs.push({ hostname: split[0], port: split[1], active: addresses[addr] });
		}
		return addrs;
	}

	toString() {
		let list = [];
		for (let peer of peers){
			list.push(peer.getName().trim());
		}
		return list;
	}

	// Raw string of host
	isConnected(host) {
		let connected = peers.filter(p => {
			return p.host == host;
		});
	}

}

module.exports = PeerManager;