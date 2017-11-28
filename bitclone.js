const net = require('net');
const utils = require('./utils.js');

let bitclone = {};

bitclone.debug = true;

bitclone.userid = 'beta'
bitclone.version = 3;
bitclone.services = 1;
bitclone.block = 0;

bitclone.port = utils.getArg('-p', 3000);
bitclone.hostname = '127.0.0.1';
bitclone.node = utils.getArg('-n', null);

module.exports = bitclone;

const PeerManager = require('./peer-manager.js');
bitclone.peerManager = new PeerManager();

const server = net.createServer();

server.on('connection', socket => {
	bitclone.peerManager.newConnection(socket);
});

server.listen(bitclone.port);

// host: a string in the format <hostname>:<port>
bitclone.connect = (host) => {
	host = utils.parseHost(host);
	const socket = net.createConnection({ port: host.port, host: host.hostname });
	
	socket.on('connect', () => {
		bitclone.peerManager.newConnection(socket);
	});
};

// Initial connection
if (bitclone.node != null) {
	bitclone.connect(bitclone.node);
}

// TODO create some queue for attempting to connect to peers
