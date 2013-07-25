/*  JOINS
0-99		system wide main pages
100-199		system wide subpages
200-299		system wide controls (ie: volume)
1000-1999	Home main page items
3000-3999	FTA TV main page items
4000-4999	XBMC main page items

*/


var joins = {
	pages:	{
		home:			2,	// D(main page)
		tv:			3,	// D(main page)
		xbmc:			4,	// D(main page)
		yatse:			5, 	// D(main page)
		ystse_settings:		6,	// D(main page)
	},
	controls:		101,	// D(subpage)
	activities:		102,	// D(subpage)
	diagnostics:		103,	// D(subpage)
	volume:		{
		level:			200,	// A + S(text)
		knob:			201,	// S(image)
		indicator_start:	201,	// D(buttons): volume indicator joins 201 -> 231
		touch:			202,	// S(image)
	},
	playing:		240,	// D(button)
	mute:			241,	// D(button)
	repeat:			242,	// D(button)
	shuffle:		243,	// D(button)
	subtitles:		244,	// D(button)
	init:		{
				join:		245,	// S(text)
				queue:		[],
	},
};

var preloadComplete = false;


function globalGesture(gesture) {
	switch (gesture.type) {
		case "swipe":
			switch(gesture.direction) {
				case "up":
					CF.getJoin("d"+joins.activities, function(j, v, t) {
						if ( v == 1 ) CF.setJoin("d"+joins.activities, 0);
						else if ( v != null ) CF.setJoin("d"+joins.controls, 1);
					});
					break;
				case "down":
					CF.getJoin("d"+joins.controls, function(j, v, t) {
						if ( v == 1 ) CF.setJoin("d"+joins.controls, 0);
						else if ( v != null ) CF.setJoin("d"+joins.activities, 1);
					});
					break;
				case "left":
					break;
				case "right":
					break;
			}
	}
}


//function for decoding string with accents
function decode_utf8(string) {
	return decodeURIComponent(escape(string));
}

function WOL(mac) {
	if ("WOL" in CF.systems) {
		nums = mac.split(/[:-]/);
		if ( (nums.length == 6) && (typeof nums == "object") ) {
			command = "";
			nums.forEach(function(value, index, arr) {
				command += String.fromCharCode(parseInt(value, 16));
				//command += "\x" + value;
			}, command);

			for (i = 0; i < 4; i++) command += command; // duplicate for 16

			console.log("Sending WOL packet to " + mac + "\n" + "\xFF\xFF\xFF\xFF\xFF\xFF" + command);
			for ( i = 0; i < 5; i++ ) CF.send("WOL", "\xFF\xFF\xFF\xFF\xFF\xFF" + command);
		} else {
			console.log("Invalid mac address supplied for WOL command");
			return false;
		}
	}
}

function startXBMC(action) {
	CF.setJoin("d"+myXBMC.joins.splash, 1);
	//CF.runCommand(null, "Wake PVRBOX");	// send WOL packet to PVR-BOX
	WOL("00:22:4D:7B:38:36"); // wake PVR-BOX (media server)
	CF.runCommand(null, "Relay 1 CLOSE");	// turn on power to AV equipment
	myXBMC.XBMC.ping();
	xbmcID = setInterval(function() {
		CF.getJoin("d"+myXBMC.joins.connected, function(join, value, tokens) {
			if (value === 1) {
				// XBMC is running
				clearInterval(xbmcID);

				setTimeout(function() {CF.runCommand(null, ((action == "music") ? "TV Power Off" : "TV Power On"))}, 100);
				setTimeout(function() {
					myAmp.action("POWER", "ON");
					aID = setInterval(function() {
						myAmp.query("POWER");
						CF.getJoin("d"+myAmp.joins.power, function(join, value, tokens) {
							if (value === 1) {
								// Amp power is on
								clearInterval(aID);
								CF.runCommand(null, "Amp Input rPi");
								setTimeout(function() {CF.runCommand(null, (action == "music") ? "Amp Audio Pure Direct" : "Amp Audio Stereo")}, 250);
								setTimeout(function() {
									CF.runCommand(null, "TV HDMI 1");
									console.log("Switching TV to HDMI 1");
								}, 1000);
								//CF.openURL((action == "music") ? "yatse://command/browse/music" : "yatse://command/show/remote");
								//CF.setJoin("d"+myXBMC.joins.nowPlaying.subpage, 1);
								CF.setJoin("d"+joins.pages.xbmc, 1);
								CF.setJoin("d"+myXBMC.joins.splash, 0);
							};
						});
					}, 300);
				}, 500);
			}
		});
	}, 300);
}

function systemOff() {
	myXBMC.XBMC.Stop("video");
	setTimeout(function() {
		myXBMC.XBMC.Stop("audio");
		setTimeout(function() {
			myXBMC.XBMC.SystemAction("shutdown");
			//CF.runCommand(null, "Remote Shutdown i7");
			setTimeout(function() {
				CF.runCommand(null, "Shutdown PVRBOX");
			}, 100);
			CF.runCommand(null, "TV Power Off");
			myAmp.action("POWER", "OFF");
			setTimeout(function() {
				CF.runCommand(null, "Relay 1 OPEN");	// turn off power to AV equipment
				CF.setJoins([
					{ join: "d"+myAmp.joins.connected, value: 0},
					{ join: "d"+myXBMC.joins.connected, value: 0},
				]);
			}, 10000);
		}, 300);
	}, 300);
}

function onPageFlip(from, to, orientation) {
	switch(to) {
		case "TVGuideMultiCh":
			//myTVGuide.build();
			break;
		case "XBMC":
			myXBMC.XBMC.getNowPlaying(myXBMC.joins.nowPlaying.file); // force check to see if anything is playing
			break;
	}
}

function onJoinChange(j, v, t) {
	switch (j) {
		case "s"+joins.init:
			CF.log("fading out init msg");
			//CF.setProperties({join: "s"+joins.init, opacity: 0}, 0, 3, CF.AnimationCurveLinear);
			break;
	}
}

function onPreloadingComplete() {
	//CF.unwatch(CF.PreloadingCompleteEvent);
	setTimeout(function() {
		preloadComplete = true;
	}, 500);
	CF.log("PRELOADING COMPLETE");
	//clearInterval(initLoopID);
	//delete initLoopID;
}

function tvGotoChannel(channel) {
	if ( parseInt(channel, 10) > 0 ) {
		console.log("Sending command TV Digit " + channel);
		for (i = 0; i < channel.length; i++) CF.runCommand(null, "TV Digit " + channel[0]);
		CF.runCommand(null, "TV Menu Select");
	}
}


function DisplayInitMsg() {
	try {
		var queues = [];
		var msg = null;

		try  {
			msg = myAmp.init.queue.shift()
			if (msg == undefined) throw "No msgs waiting from amp";
			CF.log("Denon queue length = " +myAmp.init.queue.length);
		} catch (e) {
			try {
				msg = myTVGuide.init.queue.shift();
				if (msg == undefined) throw "No msgs waiting from Argus TV";
				CF.log("TV server queue length = " + myTVGuide.init.queue.length);
			} catch (e) {
				try {
					msg = myXBMC.XBMC.joins.init.queue.shift();
					if (msg == undefined) throw "No msgs waiting from XBMC";
					CF.log("XBMC queue length = " + myXBMC.XBMC.joins.init.queue.length);
				} catch (e) {
					//CF.log("Init msg queue is empty");
					if ( !(preloadComplete) ) msg = "continuing to preload command fusion data...";
				}
			}
		}


		//for ( key in queues ) {
		//	if (queues.hasOwnProperty(key) && typeof queues[key] == "object" && queues[key].length > 0) {
		//		var msg = queues[key].shift();
		//		break;
		//	}
		//}

		//if (typeof msg == "string") joins.init.queue.push(msg);
		//console.log("init.queue --v");
		//console.log(self.joins.init.queue);

		if ( typeof msg == "string" ) {
			//console.log("displaying init msg - " + msg);
			CF.log("displaying init msg = " + msg.toLowerCase());
			CF.setJoin("s"+joins.init.join, msg);
			CF.setProperties({join: "s"+joins.init.join, opacity: 1}, 0, 0, CF.AnimationCurveLinear, function(j) {
				// fade the msg out over 5secs
				CF.setProperties({join: j, opacity: 0}, 0, Math.floor((Math.random()*5)+0.5), CF.AnimationCurveLinear, function() {
				//CF.setProperties({join: j, opacity: 0}, 0, 2, CF.AnimationCurveLinear, function() {
					// loop until queues are empty and preload is complete
					DisplayInitMsg();
				});
			}, "s"+joins.init.join);
		} //else if (!preloadComplete) {
		//	// loop until preload complete
		//	setTimeout(function() {
		//		DisplayInitMsg();
		//	}, 300);
		//}
	} catch (e) {
		console.log("exception caught in DisplayInitMsg(msg) - " + e);
	}
}


CF.userMain = function() {
	//try {
		CF.log("userMain.js started");

		// Start watching feedback items
		CF.watch(CF.PageFlipEvent, onPageFlip, true);
		CF.watch(CF.PreloadingCompleteEvent, onPreloadingComplete);
		//CF.watch(CF.JoinChangeEvent, [
		//	"s"+joins.init,
		//], onJoinChange);

		//CF.watch(CF.PreloadingCompleteEvent, function() {
		//	CF.setJoin("d"+joins.pages.home, 1); // go to the home page
			//CF.setJoin("d"+joins.pages.yatse, 1); // go to the Yatse page
		//});

		//var myDial = new Dial("s200", {srcJoin: "s199", maxTime: 0.2, minTime: 0.1, angleOffset: 180, maxAngle: 300});
		//CF.setProperties({join:"s"+joins.volume_knob["join"], zrotation: -150});

		myAmp = new DenonAVR2312("DenonAVR2312-RS232");
		myDial = new Dial({level: "s"+joins.volume.level, knob: "s"+joins.volume.knob, touch: "s"+joins.volume.touch, maxTime: 0.2, minTime: 0.1, angleOffset: -30, maxAngle: 300});
		myTVGuide = new TVGuide( {hours: 4 } );
		//myTVServer = new ArgusTV({"address": "192.168.10.100"});
		myXBMC = new XBMC_GUI(); // create using default settings
		myXBMC.configureVolume(myAmp);
		myXBMC.setup();

		DisplayInitMsg();




};