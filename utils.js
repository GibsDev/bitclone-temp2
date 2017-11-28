const http = require('http');
const os = require('os');
const net = require('net');

let mod = {};

// Get the command line parameter after the specefied identifier
mod.getArg = (identifier, fallbackValue, number) => {
	let index = process.argv.indexOf(identifier);
	if (index < 0) {
		return fallbackValue;
	}
	if (index < process.argv.length - 1) {
		index++;
		let value = process.argv[index];
		return value;
	}
	return fallbackValue;
};

mod.nonce = () => {
	return Math.floor(Math.random() * 1000000);
};

mod.getSeconds = () => {
	return Math.floor(Date.now() / 1000);
};

mod.getIP = () => {
	return new Promise((resolve, reject) => {
		// Try to get public ip
		let req = http.get({ host: 'api.ipify.org', port: 80, path: '/' }, res => {
			let buffer = '';
			res.on('data', data => {
				buffer += data;
			});
			res.on('end', () => {
				let ip = buffer;
				resolve(ip);
			});
		});

		// Try to get local network ip
		req.on('error', err => {
			// Localhost fallback
			let ip = '127.0.0.1';
			// Attempt to get LAN address
			let network = os.networkInterfaces();
			for (let interface in network) {
				for (let address of network[interface]) {
					if (address.internal == false && address.family == 'IPv4') {
						ip = address.address;
					}
				}
			}
			resolve(ip);
		});
	});
};

// Parses host from string
// Returns { hostname: <hostname>, port: <port> }
mod.parseHost = (host) => {
	let delimIndex = host.lastIndexOf(':');
	if (delimIndex < 0){
		throw new Error(`Invalid host format: '${host}'`);
	}
	let hostname = host.substring(0, delimIndex);
	if (!net.isIP(hostname)) {
		throw new Error(`Hostname is an invalid hostname: '${hostname}'`);
	}
	let port = host.substring(delimIndex + 1);
	port = parseInt(port);
	if (isNaN(port)) {
		throw new Error(`Port is NaN: '${port}'`);
	}
	if (port <= 0 || port > 65535) {
		throw new Error(`Invalid port: '${port}'`);
	}
	return { hostname: hostname, port: port };
}

module.exports = mod;