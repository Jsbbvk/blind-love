
$('#settings').on("click tap", toggleSettings);
$('#close-settings-display').on('click tap', toggleSettings);

var showSettings = false;
function toggleSettings(e) {
    if (e) e.preventDefault();
    showSettings = !showSettings;

    if (showSettings) {
        clearDisplays();
        showSettings = true;
        $('#settings-display').css('display', 'block');
    } else $('#settings-display').css('display','none');

}

$('#bio').on("click tap", toggleBio);
$('#close-bio-display').on('click tap', toggleBio);

var showBio = false;
function toggleBio(e) {
    if (e) e.preventDefault();
    showBio = !showBio;

    if (showBio) {
        clearDisplays();
        updateBio(function() {
            $('#bio-display').css('display', 'block');
            showBio = true;
            togglePulseBio(false);
        });
    } else $('#bio-display').css('display','none');
}

var showNewTarget = false;
function togglePulseBio(state) {
    showNewTarget = state;
    if (showNewTarget) $('#bio').addClass("animatePulse");
    else $('#bio').removeClass("animatePulse");
}

$('#leaderboard-button').on("click tap", toggleLeaderboard);
$('#close-leaderboard').on('click tap', toggleLeaderboard);

var showLeaderboard = false;
function toggleLeaderboard(e) {
    if (e) e.preventDefault();
    showLeaderboard = !showLeaderboard;

    if (showLeaderboard) {
        clearDisplays();
        showLeaderboard = true;
        $('#leaderboardDisplay').css('display', 'block');
    } else $('#leaderboardDisplay').css('display','none');
}


function clearDisplays() {
    showSettings = true; toggleSettings();
    showBio = true; toggleBio();
    showLeaderboard = true; toggleLeaderboard();
}



var datesRemaining = 3;
var roundCount = 0;
function startRound() {
    roundCount++;
    $('#info, #search').css('display','block');
    $('#timer').text("1:30");

    socket.emit('get players from p', roomID, nameID, function(p, pl) {
        $('#dating-name').text(p.dname);
        $('#dating-bio').text(p.bio);
        datesRemaining = 3;
        $('#dates-remaining').text("3");
        displayDateChoices(pl);
        updateBio();

        $('#dates-remaining').text("3");
        $('#searchbar').val("");
        setupSearchBar();

        socket.emit('get room info', roomID, function(rm) {
            $('#datingDisplay').fadeIn(200, function() {
                startTimer(rm.startTime, rm.timeLimit);
            });
        });
    });

    socket.emit('new target', roomID, nameID, function(res) {
        if (res) togglePulseBio(true);
    });
}


function updateBio(cb) {
    socket.emit('get player info', roomID, nameID, function(p) {
        $('#bio-rname').text(p.rname);
        $('#bio-dname').text(p.dname);
        $('#bio-bio').text(p.bio);
        $('#bio-hearts').text(p.points);
        $('#bio-target').text(p.target.rname);

        if (showNewTarget) {
            $('#bio-target').css("display","none");
            $('#bio-target').fadeIn(1000);
        }

        $('#bio-prevDates').html("");
        p.prevDatedNames.forEach(function(d, i){
            var pp = document.createElement("P");
            pp.innerText = d.dname + " ";
            var rp = document.createElement("SPAN");
            rp.classList.add("bio-drname");
            rp.innerText = "("+ d.rname+")";
            pp.appendChild(rp);
            document.getElementById("bio-prevDates").appendChild(pp);
        });
        cb&&cb();
    });
}

function displayDateChoices(dateList) {
    document.getElementById("date-list").innerHTML ="";
    for (var i in dateList) {

        var dchoice = document.createElement("DIV");
        dchoice.classList.add("date-choice");

        var dinfo = document.createElement("DIV");
        dinfo.classList.add("date-choice-info");

        var dname = document.createElement("H6");
        dname.classList.add("date-choice-dname");
        dname.innerText = dateList[i].dname;
        if (dateList[i].dated) {
            dname.innerText = dateList[i].dname + " ";
            var rname = document.createElement("SPAN");
            rname.classList.add("date-choice-rname");
            rname.innerText = "(" + dateList[i].rname + ")";
            dname.appendChild(rname);
        }
        dinfo.appendChild(dname);


        var dbio = document.createElement("P");
        dbio.classList.add("date-choice-bio");
        dbio.innerText = dateList[i].bio;
        dinfo.appendChild(dbio);
        dchoice.appendChild(dinfo);

        var dbutton = document.createElement("DIV");
        dbutton.classList.add("date-choice-button");
        dbutton.innerText = "Date";
        dbutton.setAttribute("data-id", dateList[i].id);
        dchoice.appendChild(dbutton);

        document.getElementById("date-list").appendChild(dchoice);
    }
    setupDateButtons();
}

function setupDateButtons() {
    $('.date-choice-button').off().on('click tap', function(e) {
        e.preventDefault();
        if (datesRemaining <= 0 || $(this).parent().hasClass("selectedDate")) return;
        datesRemaining--;
        $('#dates-remaining').text(datesRemaining);
        var did = $(this).attr("data-id");
        $(this).parent().addClass("selectedDate");

        socket.emit('player selected date', roomID, nameID, did);
    });
}

function setupSearchBar() {
    $('#searchbar').off().on('keyup', function(){
        var searchVal = document.getElementById("searchbar").value.toUpperCase();
        var nameList = document.getElementById("date-list").getElementsByClassName("date-choice");

        for (var ddate of nameList) {
            var dname = ddate.getElementsByClassName("date-choice-dname")[0].innerText;
            if (dname.toUpperCase().indexOf(searchVal) > -1) {
                ddate.style.display = "block";
            } else{
                ddate.style.display = "none";
            }
        }
    });
}

var timeInterval;
//startTime in getTime(). timeLimit in seconds
function startTimer(startTime, timeLimit) {
    clearInterval(timeInterval);
    timeInterval = setInterval(function() {
        var currentTime = new Date().getTime();
        var timeRemaining = startTime + (timeLimit*1000) - currentTime;
        var seconds = Math.floor( (timeRemaining/1000) % 60 );
        var minutes = Math.floor( (timeRemaining/1000/60) % 60 );
        seconds = seconds < 10 ? "0" + seconds : seconds;
        if (timeRemaining <= 0) {
            document.getElementById("timer").innerText = "0:00";
            clearInterval(timeInterval);
            $('.date-choice-button').off();

            $('#datingDisplay').fadeOut(200, function() {
                socket.emit('calculate player results', roomID, nameID, function(dateList, rejectList, leaderList) {
                    displayDatingResults(dateList, rejectList);
                    updateLeaderboard(leaderList);
                    $('#nextRoundTimer').text("10");
                    startResultsTimer(function() {
                        $('#datingResults').fadeOut(200, function() {
                            clearDisplays();
                            startRound();
                        });
                    });
                    $('#datingResults').fadeIn(200);
                });
            });
        } else {
            document.getElementById("timer").innerText = minutes + ":" + seconds;
        }
    }, 300);
}

var resultsTimer;
function startResultsTimer(cb) {
    clearInterval(resultsTimer);
    socket.emit('get room info', roomID, function(rm) {
        resultsTimer = setInterval(function() {
            var currentTime = new Date().getTime();
            var timeRemaining = rm.resultsStartTime + (rm.resultsTimeLimit*1000) - currentTime;
            var seconds = Math.floor( (timeRemaining/1000) % 60 );
            $('#nextRoundTimer').text(seconds);
            if (timeRemaining<=0) {
                $('#nextRoundTimer').text(0);
                clearInterval(resultsTimer);
                cb && cb();
            }
        }, 300);
    });

}
function displayDatingResults(list, rlist) {
    $('#res-date-choices, #res-rejects').html("");

    if (isEmpty(list)) {
        var n = document.createElement("DIV");
        n.classList.add("res-single");
        n.innerText = "Sad and single -2 ";
        var i1 = document.createElement("I");
        i1.classList.add("fas", "fa-heart");
        n.appendChild(i1);
        document.getElementById("res-date-choices").appendChild(n);
    }

    for (var i in list) {
        var selectedDate = list[i].target;
        var rejected = !list[i].dated;


        var rd = document.createElement("DIV");
        rd.classList.add("res-date");

        var n1 = document.createElement("P");
        n1.classList.add("res-date-name");
        n1.innerText = list[i].dname + " ";

        if (!rejected) {
            var n2 = document.createElement("SPAN");
            n2.classList.add("res-date-rname");
            n2.innerText = "("+ list[i].rname + ")";
            n1.appendChild(n2);
        }
        rd.appendChild(n1);


        if (selectedDate) {
            var p1 = document.createElement("P");
            p1.classList.add("selectedTarget", "res-date-status");
            var s1 = document.createElement("SPAN");
            s1.classList.add("res-date-status-text");
            p1.appendChild(s1);
            rd.appendChild(p1);
        }

        if (rejected) {
            var p1 = document.createElement("P");
            p1.classList.add("gotRejected", "res-date-status");
            var s1 = document.createElement("SPAN");
            s1.classList.add("res-date-status-text");
            p1.appendChild(s1);
            if (selectedDate) {
                var s2 = document.createElement("SPAN");
                s2.classList.add("res-date-status-points");
                s2.innerText = "+3 ";
                var i1 = document.createElement("I");
                i1.classList.add("fas", "fa-heart");
                s2.appendChild(i1);
                p1.appendChild(s2);
            }
            rd.appendChild(p1);
        } else {
            var p1 = document.createElement("P");
            p1.classList.add("successfulDate", "res-date-status");
            var s1 = document.createElement("SPAN");
            s1.classList.add("res-date-status-text");
            p1.appendChild(s1);
            var s2 = document.createElement("SPAN");
            s2.classList.add("res-date-status-points");
            if (selectedDate) {
                s2.innerText = "+5 ";
                var i1 = document.createElement("I");
                i1.classList.add("fas", "fa-heart");
                s2.appendChild(i1);
                p1.appendChild(s2);
            } else {
                s2.style.fontSize = "0.8em";
                s2.innerText = "Name Revealed";
            }
            p1.appendChild(s2);
            rd.appendChild(p1);
        }

        document.getElementById("res-date-choices").appendChild(rd);
    }

    for (var i in rlist) {
        var prevDated = rlist[i].dated;

        var rd = document.createElement("DIV");
        rd.classList.add("res-date");

        var n1 = document.createElement("P");
        n1.classList.add("res-date-name");
        n1.innerText = rlist[i].dname + " ";

        if (prevDated) {
            var n2 = document.createElement("SPAN");
            n2.classList.add("res-date-rname");
            n2.innerText = "("+ rlist[i].rname + ")";
            n1.appendChild(n2);
        }
        rd.appendChild(n1);

        var p1 = document.createElement("P");
        p1.classList.add("rejected", "res-date-status");
        var s1 = document.createElement("SPAN");
        s1.classList.add("res-date-status-text");
        p1.appendChild(s1);
        var s2 = document.createElement("SPAN");
        s2.classList.add("res-date-status-points");
        s2.innerText = "+1 ";
        var i1 = document.createElement("I");
        i1.classList.add("fas", "fa-heart");
        s2.appendChild(i1);
        p1.appendChild(s2);

        rd.appendChild(p1);

        document.getElementById("res-rejects").appendChild(rd);
    }
}

function updateLeaderboard(list) {
    document.getElementById("leaderboard-players").innerHTML = "";
    for (var i in list) {
        var p = list[i];

        var d = document.createElement("DIV");
        d.classList.add("leaderboard-p");

        var dn = document.createElement("DIV");
        dn.classList.add("leaderboard-p-name");
        var s = document.createElement("SPAN");
        s.innerText = p.rname;
        dn.appendChild(s); d.appendChild(dn);


        var dp = document.createElement("DIV");
        dp.classList.add("leaderboard-p-points");
        dp.innerText = p.points + " ";
        var i1 = document.createElement("I");
        i1.classList.add("fas", "fa-heart");
        dp.appendChild(i1); d.appendChild(dp);

        document.getElementById("leaderboard-players").appendChild(d);
    }
}

function isEmpty(obj) {
    for(var key in obj) {
        if(obj.hasOwnProperty(key))
            return false;
    }
    return true;
}

//startRound();