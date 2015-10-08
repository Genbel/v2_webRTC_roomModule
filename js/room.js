(function () {
	// It uses to check if all the variables are defined
	'use strick';

	navigator.getUserMedia = navigator.getUserMedia || navigator.mozGetUserMedia || navigator.webkitGetUserMedia;

	squareWebRtc.room = {

		// Local network parameters
		host 	: '192.168.0.5',
		port 	: '8080',
		socket	: null,

		// Room management variables
		sid 			: null,
		username 		: null,
		initiator 		: null,
		uuid 			: null,
		requestedUser 	: null,

		// set getUserMedia constraints
		constraints  	: { video: false, audio: true },

		init: function(){
			var socket = io.connect('http://' + this.host + ':' + this.port);
			this.socket = socket;
			this.setupEventHandlers();
		},

		setupEventHandlers: function(){
			$("#join-user").on('click', function() { squareWebRtc.room.joinClientToServer() });
			$("#accept-call").on('click', function() { squareWebRtc.room.callAccepted() });
			$("#reject-call").on('click', function() { squareWebRtc.room.callRejected() });
		},

		socketCalls: function(){

			// The socket is connected to the server
			this.socket.on('joined', function(sid){
				$("#state").text("You have connected to the server successfully!");
				squareWebRtc.room.sid = sid;
			});

			// New client has been joined in the square
			this.socket.on('update-square', function(square){
				squareWebRtc.room.updateSquareList(square);
			});

			// One client wants to stablish a connection with that client
			// @username: Who client make the request
			this.socket.on('call-request', function(username){

				squareWebRtc.room.initiator = username;
				console.log(squareWebRtc.room.initiator);

				squareWebRtc.room.initialiseModal(username);
				
			});
			// Update client roomUUID
			this.socket.on('update-uuid', function(info){
				console.log('update client uuid');
				squareWebRtc.room.uuid = info.uuid;
			});
			// The joiner accept the initiator request.
			// They two peers are ready to start webRTC protocol.
			// @info: It is an object which has the rooms and the UUID
			this.socket.on('ready-to-send-description', function(info){
				this.initiator = info.initiator;
				squareWebRtc.room.uuid = info.UUID;
				squareWebRtc.room.updateRoomList(info);
			});
			// The joiner reject the call request
			this.socket.on('call-rejected-answer', function(info){
				console.log(info);
				// show the alert
				$("#alert-template").show();
				$(".dial-peer").prop('disabled', false);
				// Hide the alert
				setTimeout(function(){
					$("#alert-template").slideUp(function () { $(this).hide(); });
				}, 2000);
			});
			// Inform to the initiator that the room is ready to start communication
			this.socket.on('ready-room', function(){
				squareWebRtc.core.isChannelReady = true;
				console.log("Initiator: " + squareWebRtc.core.isInitiator);
				console.log("Channel Ready: " + squareWebRtc.core.isChannelReady);
			});

			//
			this.socket.on('joined-joiner-in-the-room', function(){
				squareWebRtc.core.isChannelReady = true;
				// Call getUserMedia()
				navigator.getUserMedia(squareWebRtc.room.constraints, squareWebRtc.room.handleJoinerUserMedia, squareWebRtc.room.handleUserMediaError);

			});
		},

		// Shows the modal when somebody wants to invite to the client
		// @username: The person who invite to the client
		initialiseModal: function(username){
			$("#customer-text").empty().text("The " + username.roomOwner + " customer would like to call you. Do you want to pick up the phone?");
			$("#callNegotiationModal").modal('show');
		},

		// Show a list with all the clients and each actions.
		// @square: square information
		updateSquareList: function(square){

			$("#connected-users").empty();

			for (var index in square){

				if(index !== this.sid){
					customer = this.createSquareMember(square[index].name);
					$("#connected-users").append(customer);
				}
			}
			$(".dial-peer").on('click',function(){
				name = this.getAttribute('data-client');
				$(".dial-peer").prop('disabled', true);
				squareWebRtc.room.requestedUser = name;
				squareWebRtc.room.addDialPeerHandler();
			});

			$("#connect").hide();
			$("#client-management").show();
		},
		// Create a list showing all the calls
		updateRoomList: function(info){
			console.log(info);
			var rooms = info.rooms;
			var square = info.square;
			var PeerA = null;
			var PeerB = null;
			var snippet = null;
			for(var roomUUID in rooms){
				console.log("for UUID" + roomUUID);
				console.log("this" + this.uuid);
				if(roomUUID === this.uuid){
					var people = rooms[roomUUID].people
					for(var index in rooms[roomUUID].people){
						var sid = people[index];
						username = square[sid].name;
						if(username == this.initiator){
							console.log("equal"+username);
							PeerA = username;
						}else{
							console.log("Notequal"+username);
							PeerB = username;
						}
					}
					snippet = this.createPersonalRoomSnippet(roomUUID, PeerA, PeerB);
					$("#room-info").append(snippet);
					$("#personal-room").show();
				}else{
					console.log('else');
					PeerA = square[rooms[roomUUID].people[0]].name;
					PeerB = square[rooms[roomUUID].people[1]].name;
					snippet = this.createMemberRoomSnippet(roomUUID, PeerA, PeerB);
					$("#member-rooms").append(snippet);
				}
			}

		},

		// Send to the server the client name to notify that client connection request
		// @name: client joiner name
		addDialPeerHandler: function(name){
			this.initiator = this.username;
			navigator.getUserMedia(this.constraints, this.handleUserMedia, this.handleUserMediaError);
			squareWebRtc.core.isInitiator = true;
			//squareWebRtc.core.checkAndStart();
		},

		// Store the stream media and send the request
		// @stream: media
		handleUserMedia: function(stream) {
			squareWebRtc.core.localStream = stream;
			console.log('Adding local stream.');
			squareWebRtc.room.socket.emit('initiator-request', name);
		},

		// Store the stream media in the joiner
		// @stream: media
		handleJoinerUserMedia: function(stream){
			squareWebRtc.core.localStream = stream;
			console.log('got user media');
			console.log("Initiator: " + squareWebRtc.core.isInitiator);
			console.log("Channel Ready: " + squareWebRtc.core.isChannelReady);

			squareWebRtc.core.sendMessage("got_user_media");
		},

		// Manage stream media error
		// @error: message error
		handleUserMediaError: function(error) {
			console.log('navigator.getUserMedia error: ', error);
		},

		// The joiner accept the call request
		// @initiator: The client which starts the call
		callAccepted: function(){
			$("#callNegotiationModal").modal('hide');
			this.socket.emit('call-accepted', this.initiator);
		},
		// The joiner reject the call request
		// @initiator: The client which starts the call
		callRejected: function(){
			$("#callNegotiationModal").modal('hide');
			this.socket.emit('call-rejected', this.initiator);
		},

		// Join the user in the server
		joinClientToServer: function(){
			username = $("#username").val();
			this.username = username;
			this.socket.emit('join', username);
		},

		// Create the code to insert as element in the list of the square
		// @name: Client name
		createSquareMember:function(name){

			customer = '<div class="users">\n\
							<div class="col-md-6">\n\
								<h5>'+ name +'</h5>\n\
							</div>\n\
							<div class="col-md-offset-4 col-md-2" >\n\
								<button class="btn btn-dial btn-sm dial-peer" data-client="'+ name +'"><i class="fa fa-phone"></i></button>\n\
							</div>\n\
						</div>';
			return customer;
		},

		// Create the snippet for the personal room
		// @roomUUID: Room identifier
		// @PeerA: The initiator of the call 
		// @PeerB: The joiner of the call
		createPersonalRoomSnippet: function(roomUUID, PeerA, PeerB){

			var snippet = '<div class="col-md-2 peer-A" align="left">\n\
								<h5><i class="fa fa-volume-up"></i>&nbsp;&nbsp;'+ PeerA +'</h5>\n\
							</div>\n\
							<div class="col-md-5"><h5 style="font-size:10px">'+ roomUUID +'</h5></div>\n\
							<div class="col-md-2 peer-B" align="right">\n\
								<h5>'+ PeerB +'</h5>\n\
							</div>\n\
							<div class="col-md-offset-1 col-md-1">\n\
								<button class="btn btn-xs btn-busy"><i class="fa fa-phone fa-rotate-90"></i></button>\n\
							</div>';
			return snippet;
		},

		// Create the snippet for the member rooms
		// @roomUUID: Room identifier
		// @PeerA: The initiator of the call 
		// @PeerB: The joiner of the call
		createMemberRoomSnippet: function(roomUUID, PeerA, PeerB){
			var snippet = '<div class="col-md-12 member">\n\
								<div class="col-md-2 peer-A" align="left">\n\
									<h5><i class="fa fa-volume-up"></i>&nbsp;&nbsp;'+ PeerA +'</h5>\n\
								</div>\n\
								<div class="col-md-5"><h5 style="font-size:10px">'+ roomUUID +'</h5></div>\n\
								<div class="col-md-2 peer-B" align="right">\n\
									<h5>'+ PeerB +'</h5>\n\
								</div>\n\
							</div>';
			return snippet;
		},
	};

	// Initialise the client JS
	$(function () {
		squareWebRtc.room.init();
		squareWebRtc.room.socketCalls();
	});

})();