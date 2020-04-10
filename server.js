var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);



app.use('/assets', express.static('assets'));

app.get('/', function(req, res){
    res.sendFile(__dirname + '/public/index.html');
});

var rooms = {};

class Room {
    constructor(roomid) {
        this.roomid = roomid;
        this.startingGame = false;
        this.endingGame = false;
        this.gamestart = false;
        this.gamestate = -1;
        this.player = {};
        this.playerIds = [];
        this.numPlayers = 0;

        this.timeLimit = 90; // TODO change
        this.resultsTimeLimit = 10;
        this.resultsStartTime = 0;
        this.startTime = 0;
    }
    addPlayer(p) {this.player[p.id] = p;}
}

class Player {
    constructor(rname, dname, bio, id, roomid) {
        this.roomid = roomid;
        this.id = id;

        this.points = 0;

        this.dname = dname;
        this.rname = rname;
        this.bio = bio;
        this.target = {};
        this.prevTargets = [];
        this.newTarget = false;

        this.prevDated = []; // keeps track of previously dated players
        this.prevDatedNames = []; // keeps track of previously dated names
        this.chosenDates = []; // keeps track of players this player wants to date
        this.dateChoice = []; // keeps track of players who want to date player
    }
    setNewTarget() {
        var pl = [];
        var pp = rooms[this.roomid].playerIds.slice();
        delete pp[pp.indexOf(this.id)];

        if (this.prevTargets.length == pp.length-1) {
            this.prevTargets = [];
        }
        for (var i = 0; i < pp.length; i++) {
            if (pp[i] != undefined && this.prevTargets.indexOf(pp[i]) == -1) {
                pl.push(pp[i]);
            }
        }

        var r = parseInt(Math.random()*pl.length);
        this.target = {
            id: pl[r],
            rname: rooms[this.roomid].player[pl[r]].rname,
            dname: rooms[this.roomid].player[pl[r]].dname,
        };
        this.prevTargets.push(pl[r]);
        this.newTarget = true;
    }
}


io.on('connection', function(socket){

    socket.on('new target', function(roomid, id, cb) {
        if (rooms[roomid]==null)return;
        cb&&cb(rooms[roomid].player[id].newTarget);
        rooms[roomid].player[id].newTarget = false;
    });

    function calculatePlayerPoints(roomid){
        if (rooms[roomid]==null)return;
        for (var id in rooms[roomid].player) {
            var p = rooms[roomid].player[id];

            p.dateChoice.forEach(function(pid, i) {
                if (p.chosenDates.indexOf(pid) == -1) {
                    rooms[roomid].player[id].points = rooms[roomid].player[id].points+1;
                }
            });

            if (p.chosenDates.length==0) {
                rooms[roomid].player[id].points = (rooms[roomid].player[id].points <=2) ? 0 : rooms[roomid].player[id].points - 2;
            }

            p.chosenDates.forEach(function(pid, i) {
                if (pid == p.target.id) {
                    if (p.dateChoice.indexOf(pid) != -1) rooms[roomid].player[id].points = rooms[roomid].player[id].points+5;
                    else rooms[roomid].player[id].points = rooms[roomid].player[id].points + 3;
                }
            });
        }
    }

    socket.on('calculate player results', function(roomid, id, cb) {
        if (rooms[roomid]==null)return;
        var dList = {}, rList = {};
        var p = rooms[roomid].player[id];

        p.dateChoice.forEach(function(pid, i) {
            var pp = rooms[roomid].player[pid];
            if (p.chosenDates.indexOf(pid) == -1) {
                rList[pid] = {
                    dname: pp.dname,
                    rname: pp.rname,
                    dated: p.prevDated.indexOf(pid) != -1
                };
            }
        });

        var setNewT = false;
        p.chosenDates.forEach(function(pid, i) {
            var pp = rooms[roomid].player[pid];
           dList[pid] = {
               dname: pp.dname,
               rname: pp.rname,
               bio: pp.bio,
               dated: p.dateChoice.indexOf(pid) != -1,
               target: pid == p.target.id
           };
           if (p.dateChoice.indexOf(pid) != -1) {
               p.prevDated.push(pid);
               p.prevDatedNames.push({dname: pp.dname, rname: pp.rname});
           }

           if (pid == p.target.id) {
                setNewT = true;
           }
        });

        if (setNewT) {
            rooms[roomid].player[id].setNewTarget();
        }

        var leaderList = [];
        for (var i in rooms[roomid].player) {
            leaderList.push({
                rname: rooms[roomid].player[i].rname,
                points: rooms[roomid].player[i].points
            });
        }

        leaderList.sort(function(a, b) {
            return parseInt(b.points) - parseInt(a.points);
        });

        cb&&cb(dList, rList, leaderList);
    });

    socket.on('player selected date', function(roomid, id, did) {
        if (rooms[roomid]==null)return;
        rooms[roomid].player[id].chosenDates.push(parseInt(did));
        rooms[roomid].player[did].dateChoice.push(parseInt(id));
    });

    socket.on('get player info', function(roomid, id, cb){
        if (rooms[roomid]==null)return;
        cb&&cb(rooms[roomid].player[id]);
    });

    socket.on('get players from p', function(roomid, id, cb) {
        if (rooms[roomid]==null)return;
        var pl = {};
        for (var i in rooms[roomid].player) {
            if (i == id) continue;
            var pp = rooms[roomid].player[i];

            pl[i] = {
                id: pp.id,
                dname: pp.dname,
                rname: pp.rname,
                bio: pp.bio,
                dated: rooms[roomid].player[id].prevDated.indexOf(pp.id) != -1
            };
        }

        cb&&cb(rooms[roomid].player[id], pl);
    });

    function nextRound(roomid) {
        resetPlayers(roomid);
        rooms[roomid].startTime = new Date().getTime();
        setTimeout(function() {
            calculatePlayerPoints(roomid);
            rooms[roomid].resultsStartTime = new Date().getTime();

            setTimeout(function() {
                nextRound(roomid);
            }, parseInt(rooms[roomid].resultsTimeLimit)*1000);
        }, parseInt(rooms[roomid].timeLimit)*1000);
    }

    socket.on('start game', function(roomid) {
        if (rooms[roomid]==null)return;
        if (rooms[roomid].player.length < 3) return;
        if (rooms[roomid].startingGame) return;
        rooms[roomid].startingGame = true;
        rooms[roomid].endingGame = false;
        rooms[roomid].gamestart = true;

        nextRound(roomid);

        for (var i in rooms[roomid].player) {
            rooms[roomid].player[i].points = 0;
            rooms[roomid].player[i].prevDated = [];
            rooms[roomid].player[i].prevDatedNames = [];
            rooms[roomid].player[i].prevTargets = [];
        }

        for (var i in rooms[roomid].player) {
            rooms[roomid].player[i].setNewTarget();
        }

        io.to(roomid).emit('game start');
    });

    socket.on('end game', function(roomid) {
        if (rooms[roomid]==null)return;
        if(rooms[roomid].endingGame)return;
        rooms[roomid].endGame = true;
        rooms[roomid].gamestart = false;
        rooms[roomid].startingGame = false;
        io.to(roomid).emit('game ended');
    });

    function resetPlayers(roomid) {
        for (var i in rooms[roomid].player) {
            rooms[roomid].player[i].chosenDates = [];
            rooms[roomid].player[i].dateChoice = [];
        }
    }

    socket.on('get players', function(roomid, cb) {
        if (rooms[roomid]==null) return;
        cb&&cb(rooms[roomid].player);
        return;
    });

    socket.on('get room info', function(roomid, cb) {
        if (rooms[roomid]==null) return;
        cb&&cb(rooms[roomid]);
        return;
    });

    socket.on('join room', function(roomid, rname, dname, bio, callback){
        if (rooms[roomid]==null) {
            callback&&callback("null", 0);
            return;
        }
        if (rooms[roomid].gamestart) {
            callback&&callback("started", 0);
            return;
        }


        socket.join(roomid);
        rooms[roomid].addPlayer(new Player(rname, dname, bio, ++rooms[roomid].numPlayers, roomid));
        rooms[roomid].playerIds.push(rooms[roomid].numPlayers);
        callback&&callback("success", rooms[roomid].numPlayers);
        io.to(roomid).emit("update players");
    });

    socket.on('create room', function(roomid, rname, dname, bio, callback) {

        if (rooms[roomid]!=null) {
            callback&&callback("taken");
            return;
        }

        var ro = new Room(roomid);
        ro.addPlayer(new Player(rname, dname, bio, 1, roomid));
        rooms[roomid] = ro;
        rooms[roomid].numPlayers = 1;
        rooms[roomid].playerIds.push(1);
        socket.join(roomid);
        callback && callback("success");
    });

    socket.on('delete player', function(roomid, id, callback) {
        if (rooms[roomid]==null) return;

        delete rooms[roomid].player[id];
        delete rooms[roomid].playerIds[rooms[roomid].playerIds.indexOf(id)];
        if (isEmpty(rooms[roomid].player)) {
            delete rooms[roomid];
            callback && callback();
            return;
        }

        io.to(roomid).emit('player leave', rooms[roomid].gamestart, id);
        callback && callback();
    });

    socket.on('change player name', function(roomid, id, rname, dname, bio) {
        if (rooms[roomid]==null) return;
        rooms[roomid].player[id].rname = rname;
        rooms[roomid].player[id].dname = dname;
        rooms[roomid].player[id].bio = bio;
        io.to(roomid).emit("update players");
    });

    function isEmpty(obj) {
        for(var key in obj) {
            if(obj.hasOwnProperty(key))
                return false;
        }
        return true;
    }
});

http.listen(8000, function(){
    console.log('listening on *:8000');
});
