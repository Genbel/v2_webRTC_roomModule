function Room(id, owner){
	this.id = id;
	this.owner;
	this.people = [];
	this.status = "available";
};

Room.prototype.addPerson = function(personID){
	if(this.status === "available"){
		this.people.push(personID);
	}
};

Room.prototype.getPeople = function(){

	if(this.people !== 'undefined'){
		return this.people;
	}else{
		return 'undefined';
	}
}

Room.prototype.deletePeople = function(UUID){
	for(var index in this.people){
		var socketId = this.people[index];
		square[socketId].room = null; 
	}
}

Room.prototype.editStatus = function(status){
	this.status = status;
}

// When you add 'require' call in some node.js file to instanciate some class, with module.exports
// we assign the desired object to export.
// In that case, require(room.js) will instanciate Room object
module.exports = Room;