const net = require('net');

let socket = net.createConnection({ port: 12030, host: '130.111.131.121' });

let buffer = '';

socket.on('data', data => {
	buffer += data.toString();
	if (buffer.endsWith('\r\n')) {
		console.log(buffer);
		socket.destroy();
	}
});

socket.on('connect', () => {
	socket.write('history\r\n');
});