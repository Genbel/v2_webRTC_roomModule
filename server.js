// Import the libraries to manage the web socket and the square
var static = require('node-static');
var https = require('https');
var fs = require('fs');
var Room = require('./js/objects/room.js');
var uuid = require('node-uuid');

// Local network parameters
var host = '192.168.0.5';
var port = '8080';

// Get the private key and SSL certificate to stablish https protocol
var options = {
	key: fs.readFileSync('./fixtures/keys/key.pem'),
	cert: fs.readFileSync('./fixtures/keys/key-cert.pem'),
}

// Create a node-static server instance
var file = new(static.Server)();

// We use http module's createServer function and rely
// on our instance of node-static to serve the files
var app = https.createServer(options, function(req, res){
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
		// Sent message to the client
		client.emit('joined', client.id);
		// Sent to every socket to update their square info
		io.sockets.emit('update-square', square);
		// Update rooms list
		client.emit('update-room-description', {"rooms": rooms, "square": square});
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

			//client.emit('update-uuid', { "uuid" : roomUUID });
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
		// Update joiner global variables
		client.emit("update-uuid", {"initiator" : initiator, "uuid" : roomUUID}, true);
		// Send to the initiator actual UUID
		client.broadcast.to(roomUUID).emit('update-uuid', { "uuid" : roomUUID }, false);
		// Send to all peers that they can setUp description between each other.
		io.sockets.emit('update-room-description', {"rooms" : rooms, "square" : square } );
		// Inform to the initiator that the room is ready
		client.broadcast.to(roomUUID).emit('ready-room');
		// Send message to the client to attach the media stream.
		client.emit('joined-joiner-in-the-room');
		// Update the square information, excluding the members of the room
		updateSquareInformation(initiatorSId, client.id);

		//--------------- WE CAN MAKE ALL IN ONE READY ROOM AND UPDATE UUID ----------//


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
		io.sockets.to(initiatorSId).emit('call-rejected-answer', { "square" : square }); 
	});

	// Disconnect the call between two peers and inform to other clients
	// WARNING: If the message of the socket, it is 'disconnet' is doesn't work.
	// That call has reserved the socket.io for their own management 
	// @UUID: room identificator
	client.on('disconnect-call', function(UUID){
		var disconnetedPeers = new Array(); 
		// Send to the other peer to update the room variables
		client.broadcast.to(UUID).emit("room-closed");
		// Delete the room and client room
		if(rooms[UUID] !== 'undefined'){
			for(var index in rooms[UUID].getPeople()){
				var socketId = rooms[UUID].people[index];
				disconnetedPeers.push(socketId);
				square[socketId].room = null; 
			}
			// Update the square information, excluding the members of the room
			io.sockets.emit('update-square', square);
			// Delete the room for the room object
			delete rooms[UUID];
			// send to every socket except the sender
			client.broadcast.emit('update-room-description', {"rooms" : rooms,"square" : square });
		}
	});

	// Manage messages between two peers
	client.on('message', function(node){
		client.broadcast.to(node.room).emit('message', node.message);
	});

	// Clean the room and square variables when one user disconnet not properly
	client.on('disconnect', function(){
		console.log(client.id + " left the room forover!");
		delete square[client.id];
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

// Send the square information to the clients, excluding the members of the room
// @PeerA, @PeerB
function updateSquareInformation(PeerA, PeerB){

	for(var socketId in square){
		if(PeerA !== socketId && PeerB !== socketId){
			io.sockets.to(socketId).emit("update-square", square);
		}
	}
}