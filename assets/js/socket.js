

const NOT_PLAYING = -1;

const PLAYING = 0;

var gamestate = NOT_PLAYING;

var isLeaving = false;


window.onpagehide = function() {
    if (!isLeaving) socket.emit('delete player', roomID, nameID);
};


socket.on('get room id', function(cb){
    cb&&cb(roomID);
});


function leave(e) {
    e.preventDefault();
    socket.emit('delete player', roomID, nameID, function() {
        isLeaving = true;
        location.reload();
    });
}

function endGame(e) {
    e.preventDefault();
    socket.emit('end game', roomID);
}


$("#end-game-button").unbind().on("click tap", endGame);
$("#leave-game-button").unbind().on('click tap', leave);

socket.on('game ended', function() {
    backToWaitingRoom(function() {
        displayPrevScore = true;
        displayWaitingRoom();
    });
});

socket.on('display current view', function(gamestart, gs) {
    if (!gamestart) {
        //go to main menu
        backToWaitingRoom(function() {
            displayPrevScore=true;
            displayWaitingRoom();
        });
    } else {

        $('#playing').fadeOut(400, function() {

        });
    }
});


var resetting = false;
socket.on('player leave', function(gamestart, id) {
    if (gamestart && !resetting) {
        //playing
        resetting = true;


        backToWaitingRoom(function() {
            $('#playerLeaveNotification').fadeIn(1500, function() {
                socket.emit('end game', roomID);
            }).fadeOut(400, function() {
                resetting = false;
                displayPrevScore=true;
                displayWaitingRoom();
            });
        });


    } else {
        //waiting
        if (id==nameID) {
            isLeaving = true;
            location.reload();
        } else {

            socket.emit("get players", roomID, function(p){
                displayPlayersInWaiting(p);
            });

        }
    }
});
