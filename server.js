// Import the libraries to manage the web socket and the square
var static = require('node-static');
var http = require('http');
var Room = require('./js/objects/room.js');
var uuid = require('node-uuid');

// Local network parameters
var host = '192.168.0.5';
var port = '8080';

// Create a node-static server instance
var file = new(static.Server)();

// We use http module's createServer function and rely
// on our instance of node-static to serve the files
var app = http.createServer(function(req, res){
	file.serve(req, res);
}).listen(port, host);

// Use socket.io JavaScript library for real-time web applications
var io = require('socket.io').listen(app);

// Initiate the square management variables
// @square: object. All the client that are connected to the server
var square = {};
// @rooms: object. How many rooms are in that square. Each room will be
// created of two peers. Each peer can only be in one room
var rooms = {};
// @clients: array. That object will hold all the clients objects
var clients = [];





// Let's start managing connections...
io.sockets.on('connection', function(client){

	client.on('join', function(username){

		var roomID = null;
		
		square[client.id] = { "name": username, "room": roomID };

		client.emit('joined', client.id);

		//io.sockets.emit('update', people[client.id].name + 'is online');
		io.sockets.emit('update-square', square);

		/*client.emit("roomList", {rooms: rooms});*/
	});
	// One client want to stablish connection with another client
	// @joiner: The peer which we want to connect
	client.on('initiator-request', function(joiner){

		// Check if that user is speaking

		var socketId = findSocketIdWithUsername(joiner);

		if(socketId !== null){

			// Parameters for room creation
			var roomUUID = uuid.v4();
			var roomOwner = square[client.id].name;
			var room = new Room (roomUUID, roomOwner);
			// Add roomOwner as a member of the group
			room.addPerson(client.id);
			// Add in rooms global variable the new room
			rooms[roomUUID] = room;
			// Auto-join the initiator client to the room
			client.join(roomUUID);
			// Update the client room key
			square[client.id].room = roomUUID;

			client.emit('update-uuid', { "uuid" : roomUUID });
			io.sockets.to(socketId).emit('call-request', roomOwner);
		}
	});

	// The joiner accept the call
	// @initiator: The owner of that call, the person who starts the call
	client.on('call-accepted', function(initiator){
		// Retrieve information for the joiner
		var initiatorSId = findSocketIdWithUsername(initiator);
		var roomUUID = square[initiatorSId].room;
		var initiatorName = square[initiatorSId].name;
		// Add to the square, client roomID
		square[client.id].room = roomUUID;
		// Add in the server socket room, the joiner socket
		client.join(roomUUID);
		// Add the client in the global room variable
		rooms[roomUUID].addPerson(client.id);
		rooms[roomUUID].editStatus("full");
		// Send to all peers that they can setUp description between each other.
		io.sockets.emit('ready-to-send-description', {"rooms" : rooms, "UUID" : roomUUID, "square" : square, "initiator" : initiatorName } );


		// Inform to the initiator that the room is ready
		client.broadcast.to(roomUUID).emit('ready-room');
		// Send message to the client to attach the media stream.
		client.emit('joined-joiner-in-the-room');


	});
	// The other peer reject the call
	// @initiator: The client which initiate the call
	client.on('call-rejected', function(initiator){
		// Get the initiator socket Id
		var initiatorSId = findSocketIdWithUsername(initiator);
		// Delete the room which the initiator belongs
		var roomUUID = square[initiatorSId].room;
		delete rooms[roomUUID];
		// delete from square attached room
		square[initiatorSId].room = null;
		io.sockets.to(initiatorSId).emit('call-rejected-answer', { "square" : square, "rooms" : rooms }); 
	});

	// Manage messages between two peers
	client.on('message', function(node){
		client.broadcast.to(node.room).emit('message', node.message);
	});
});

// Identify the user socket to send the message directly the message
// @username: Client username
function findSocketIdWithUsername(username){

	for(var index in square){
		if(square[index].name === username){
			return index;
		}
	}
	return null;
}