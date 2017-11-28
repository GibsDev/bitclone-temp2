const net = require('net');

let port = 3000;

const server = net.createServer();

server.on('connection', inboundSocket => {
	// console.log('Server: ');
	// console.log(inboundSocket);
	/*
	console.log('Server: Remote Family: ' + inboundSocket.remoteFamily);
	console.log('Server: Remote Address: ' + inboundSocket.remoteAddress);
	console.log('Server: Remote Port: ' + inboundSocket.remotePort);
	console.log('Server: Local Family: ' + inboundSocket.localFamily);
	console.log('Server: Local Address: ' + inboundSocket.localAddress);
	console.log('Server: Local Port: ' + inboundSocket.localPort);
	console.log('Server: address(): ' + JSON.stringify(inboundSocket.address()));
	*/
	inboundSocket.on('connect', () => {
		console.log('We get it here too');
	});
});

server.listen({port: port});

const outboundSocket = net.createConnection({ port: port, timeout: 2000 });

outboundSocket.on('timeout', () => {
	console.log('timed out');
	outboundSocket.destroy();
});

//connectionTimeout(outboundSocket, 2000);

outboundSocket.on('connect', () => {
	outboundSocket.setTimeout(90000);
	// console.log('Client: ');
	// console.log(outboundSocket);
	/*
	console.log('Client: Remote Family: ' + outboundSocket.remoteFamily);
	console.log('Client: Remote Address: ' + outboundSocket.remoteAddress);
	console.log('Client: Remote Port: ' + outboundSocket.remotePort);
	console.log('Client: Local Family: ' + outboundSocket.localFamily);
	console.log('Client: Local Address: ' + outboundSocket.localAddress);
	console.log('Client: Local Port: ' + outboundSocket.localPort);
	console.log('Client: address(): ' + JSON.stringify(outboundSocket.address()));
	*/
});


// incoming
// outgoing