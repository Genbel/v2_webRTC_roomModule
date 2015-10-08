(function () {
	// It uses to check if all the variables are defined
	'use strick';

	squareWebRtc.core = {

		// Connect to signaling server
		port 	: 8080,
		host 	: "192.168.0.6",
		socket  : null,

		// Data channel information
		sendChannel 					: null,
		receiveChannel 					: null,
		sendButton 						: document.getElementById("sendButton"),
		sendTextArea 					: document.getElementById("dataChannelSend"),
		receiveTextarea 				: document.getElementById("dataChannelReceive"),

		// HTML5 <video> elements
		localVideo 	: document.querySelector('#localVideo'),
		remoteVideo : document.querySelector('#remoteAudio'),

		// Handler associated with send button
		//sendButton.onclick : sendData,

		// Flags...
		isChannelReady 		: false,
		isInitiator 		: false,
		isStarted 			: false,

		// WebRTC DATA STRUCTURES
		//streams
		localStream 	: null,
		remoteStream 	: null,

		// set getUserMedia constraints
		constraints  	: { video: false, audio: true },

		// PeerConnection
		pc 	: null,

		// Get our namespace references
		/*global 	: TurretRtc.global.createNS("TurretRtc.global"),
		core 	: TurretRtc.global.createNS("TurretRtc.core"),*/

		// PeerConnection ICE protocol configuration (either firefox or Chrome)
		pc_config 	: webrtcDetectedBrowser === 'firefox' ?
						{'iceServers' : [{'url' : 'stun:23.21.150.121'}]} : //IP address
						{'iceServers' : [{'url' : 'stun:stun.l.google.com:19302'}]
		},

		pc_constraints  : {
			'optional' : [
				{'DtlsSrtpKeyAgreement': true}
		]},

		sdpConstraints 	: {},

		init: function() {

		},

		socketCalls: function(){

			core = squareWebRtc.global.createNS("squareWebRtc.core");

			squareWebRtc.room.socket.on('message', function(message){
				
				if(message === 'got_user_media'){
					core.checkAndStart();
				// Remote Peer, in that case the initiator, send description of the SDP via server and the
				// joiner set as RemoteDescription
				} else if (message.type === 'offer') {
					if (!core.isInitiator && !core.isStarted) {
						core.checkAndStart();
					}
					core.pc.setRemoteDescription(new RTCSessionDescription(message));
					core.doAnswer();

				// The joiner sends a SDP description and the initiator set as Remote Description
				} else if (message.type === 'answer' && core.isStarted) {
					core.pc.setRemoteDescription(new RTCSessionDescription(message));

				// They send candidate information to now which is their ICECandidate
				} else if(message.type === 'candidate' && core.isStarted) {
					var candidate = new RTCIceCandidate({sdpMLineIndex:message.label, candidate:message.candidate});
					core.pc.addIceCandidate(candidate);
				}  else if (message === 'bye' && core.isStarted) {
					core.handleRemoteHangup();
				}
			});
		},

		// 2. Client-->Server
		// Send message to the other peer via the signaling server
		sendMessage: function (message){
			var node = { "message": message, "room": squareWebRtc.room.uuid };
			squareWebRtc.room.socket.emit('message', node);
		},

		// Channel negotiation trigger function
		checkAndStart: function() {
			if(!this.isStarted && typeof this.localStream != 'undefined' && this.isChannelReady) {
				this.createPeerConnection();
				this.isStarted = true;
				if(this.isInitiator) {
					this.doCall();
				}
			}
		},

		// PeerConnection management...
		createPeerConnection: function(){
			console.log('createPeerConnection');
			try {
				this.pc = new RTCPeerConnection(this.pc_config, this.pc_constraints);
				this.pc.addStream(this.localStream);
				this.pc.onicecandidate = this.handleIceCandidate;

				console.log('Created RTCPeerConnection with:\n'+
				' config: \'' + JSON.stringify(this.pc_config) + '\';\n' +
				' constraints: \'' + JSON.stringify(this.pc_constraints) + '\'.');
			} catch (e) {
				console.log('Failed to create PeerConnection, exception: ' + e.message);
				alert('Cannot create RTCPeerConnection object.');
				return;
			}

			this.pc.onaddstream = this.handleRemoteStreamAdded;
			this.pc.onremovestream = this.handleRemoteStreamRemoved;
		},

		// ICE candidates management
		handleIceCandidate: function(event){

			console.log('handleIceCandidate event: ', event);
			if(event.candidate){
				squareWebRtc.core.sendMessage({
					type: 'candidate',
					label: event.candidate.sdpMLineIndex,
					id: event.candidate.sdpMid,
					candidate: event.candidate.candidate
				});
			} else {
				console.log('End of candidate');
			}
		},

		// Create offer
		doCall: function(){
			console.log('Creating offer...');
			this.pc.createOffer(this.setLocalAndSendMessage, this.onSignalingError, this.sdpConstraints);
		},

		// Signaling error handler
		onSignalingError: function(error) {
			console.log('Failed to create a signaling message: ' + error.name);
		},

		// Create answer
		doAnswer: function(){
			console.log('Sending answer to peer');
			this.pc.createAnswer(this.setLocalAndSendMessage, this.onSignalingError, this.sdpConstraints);
		},

		// Success handler for both createOffer() and createAnswer()
		setLocalAndSendMessage: function(sessionDescription){
			var core = squareWebRtc.global.createNS('squareWebRtc.core');
			core.pc.setLocalDescription(sessionDescription);
			core.sendMessage(sessionDescription);
		},

		// Remote stream handlers...
		handleRemoteStreamAdded: function(event){
			console.log('Remote stream added');
			attachMediaStream(squareWebRtc.core.remoteVideo, event.stream);
			console.log('Remote Stream attached!!');
			this.remoteStream = event.stream;
		},

		handleRemoteStreamRemoved: function(event){
			console.log('Remote stream removed. Event: ' + event);
		},

		// Clean-up functions...
		hangup: function() {
			console.log('Hanging up.');
			this.stop();
			this.sendMessage('bye');
		},

		handleRemoteHangup: function(){
			console.log('Session terminated.');
			this.stop();
			this.isInitiator = false;
		},

		stop: function(){
			this.isStarted = false;
			this.pc = null;
		},

	};

	// Initialise the client JS
	$(function () {
		squareWebRtc.core.init();
		squareWebRtc.core.socketCalls();
	});
})();