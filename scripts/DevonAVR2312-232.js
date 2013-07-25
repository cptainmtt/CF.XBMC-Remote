/*  Denon AVR-2312 AV Receiver TCP module for CommandFusion
===============================================================================

AUTHOR:		CptainMtt
CONTACT:	matthew.hosken@gmail.com
URL:		http://www.southernelectriq.com.au
VERSION:	v0.0.1
LAST MOD:	May 2013

===============================================================================
*/

//var DenonAVR2312 = function(systemName, ip, join) {
var DenonAVR2312 = function(systemName) {
	// Catch to make sure TCP system exists
	if ( !(CF.systems.hasOwnProperty(systemName)) ) return false; // && CF.systems[systemName].type == "tcp" && CF.systems[systemName].port == 23

	var power;
	var timeoutID = null;
	var intervalID = null;
	var jsonTimeout = 1000;
	var query = new Array();
	var queryCount = 0;
	var initComplete = false;
	var currentPage = null;

	try {
		var self = {
			systemName:	systemName,
			joins:		{
						volume:		{
								level:	200,	// A + S
								mute:	203,	// D
						},
						connected:	500,	// D(status)
						address:	500,	// S(text)
						power:		501,
						comms:		504,
			},
			power:		false, // D(button?)
			init:		{
						queue:		[],
			},
		};

	} catch (e) {
		consolelog("Caught exception declaring self - " + e);
	}

	self.setup = function() {
		/*
		CF.setSystemProperties(self.systemName, {
		    enabled: true,
		    address: ip,
		    connect: self.joins.connected,
		});
		*/

		CF.watch(CF.FeedbackMatchedEvent, self.systemName, "AmpCatchAll", onTCPFeedback);
		CF.watch(CF.ConnectionStatusChangeEvent, self.systemName, onConnectionStatusChange, true);

		CF.watch(CF.JoinChangeEvent, "d"+self.joins.connected, onConnectedChange);
		CF.watch(CF.JoinChangeEvent, "a"+self.joins.volume.level, onVolumeChange);
		CF.watch(CF.JoinChangeEvent, "d"+self.joins.volume.mute, onDigitalChange);
		CF.watch(CF.PageFlipEvent, onPageFlip, true);



		//CF.watch(CF.JoinChangeEvent, "d501", function(j, v, t) {
		//	console.log("pwr j = " + j + ", v = " + v);
		//});

	}

	self.tcp = function(command, parameter) {

		// code for command queue located in query() function

		try {
			// only send if a system is connected
			consolelog("There are " + CF.systems[systemName].connections.length + " systems currently connected...");
			if ( CF.systems[systemName].connections.length > 0 ) {
				if ( initComplete == false && parameter == "?") {
					status = null;
					switch(command) {
						case "PW":
							status = "power";
							break;
						case "SV":
							status = "volume";
							break;
						case "MU":
							status = "mute";
							break;
					}
					if ( status != null && currentPage == "Preload") QueueInitMsg("syncing amplifier " + status + " status...");
				}
				//CF.setJoin("d"+self.joins.connected, 1);
				var ascii = (command) + (parameter) + "\x0D";
				consolelog("Sending ASCII command -> " + ascii);
				CF.send(self.systemName, ascii);
			} //else CF.setJoin("d"+self.joins.connected, 0);
		} catch (e) {
			CFlog("Exception caught while processing response in DenonAVR2312.tcp() - " + e);
		}
	};

	function onTCPFeedback (name, matchedString) {
		// getting timeout problems... may be due to receiver sending feedback on its own causing timeout to be cleared?? - shouldn't

		try {
			consolelog("TCP full response = " + matchedString);
			command = matchedString.substr(0, 2);
			parameter = matchedString.substr(2).trim();
			consolelog("TCP response: command =  " + command + ", parameter = " + parameter + ". Last query command = " + query[0]);

			if ( query[0] == command.toUpperCase() ) {
				// clear the query queue timeout
				console.log(query);
				match = query.shift(); // remove the received(1st) query from the queue
				consolelog("match = " + match);
				clearTimeout(timeoutID);
				timeoutID = null;
			} else match = null; // flag response as non-requested

			CF.setJoin("d"+self.joins.connected, 1); // update connected status

			switch (command) {
				case "MV":
					// Only sends responses to set volume level
					consolelog("Updating volume status on GUI");
					if (match == null) self.setVolume({"ASCII" : parameter}); // only set volume if not requested/queried
					break;
				case "MU":
					consolelog("Updating mute status on GUI");
					CF.setJoin( "d"+self.joins.mute, ((parameter == "ON") ? 1 : 0) );
					break;
				case "PW":
				case "ZM":
					consolelog("Updating power join value to " + ((parameter == "ON") ? 1 : 0));
					CF.setJoin("d"+self.joins.power, ((parameter == "ON") ? 1 : 0));
					break;
			}

		} catch(e) {
			consolelog("Exception caught while processing DenonAVR2312.onTCPFeedback() - " + e + "\nResponse = " + matchedString);
		}
	};

	function onConnectionStatusChange(system, connected, remote) {
		CF.setJoin("d"+self.joins.comms, (connected) ? 1 : 0);
		consolelog("System connection state changed to '" + connected + "'...");
		if (connected) {
				//self.action("ZONE2", "MUTE", "OFF"); // initialise for heartbeat

			CF.setJoin("d"+self.joins.connected, 1);

				//self.query("POWER"); // use to ping amp for connection test? -- won't work atm until connected join = 1
		} else {
			// reset joins
			CF.setJoins([
				{ join: "d"+self.joins.connected,	value: 0 },
				{ join: "d"+self.joins.power,		value: 0 },
			]);
		}
	};

	function onConnectedChange(join, value, tokens) {
		consolelog("Connected join (d" + self.joins.connected + ") changed to = " + value);
		if ( value === 1 ) {
			self.query("POWER");		// sync power state
			self.query("VOLUME");		// sync volume knob
			self.query("MUTE");		// sync mute button
			if ( !(initComplete) ) {
				var id = setInterval(function() {
					if (query.length == 0) {
						clearInterval(id);
						id = null;
						QueueInitMsg("amplifier initialisation complete...");
					}
				}, 200);
			}
		} else CF.setJoin("d"+self.joins.power, 0);
	}

	function onVolumeChange(join, value, tokens) {
		// possible loop here??
		consolelog("AVR2312.onVolumeChange(" + join + ", " + value + ", " + tokens + ")");
		self.action("VOLUME", self.getVolume({"percentage": value}));
		CF.setJoin("s"+self.joins.volume.level, (value + "%"));
	}

	function onDigitalChange(join, value, tokens) {
		consolelog("onDigitalChange(" + join + ", " + value + ", " + tokens + ")");
		switch (join) {
			case "d"+self.joins.volume.mute:
				consolelog("Found join for MUTE");
				self.action("MUTE", ((value === 1) ? "ON" : "OFF"));
				break;
		}
	}

	function onPageFlip(from, to, orientation) {
	    currentPage = to;
	}

	// --- Public Functions ---
	self.getPowerState = function() {
		consolelog("power = " + self.power);
		return (self.power) ? true : false;
	};

	self.setVolume = function( vol ) {
		if ( "ASCII" in vol ) {
			// sent by Denon AVR-2312
			// Percentage set from 1% -> 100%
			// Mute = 0%
			// TEST VALUE = 145 || 14 || 99 || 98
			volume = parseFloat(vol.ASCII);
			consolelog("setVolume #1 = " + volume);

			if ( volume > 99 ) volume /= 10;
			consolelog("setVolume #2 = " + volume); // 14.5 || 14 || 99 || 98

			volume += 2; // 16.5 || 16 || 101 || 100
			if ( volume > 100 ) volume = parseFloat(volume.toString().substr(1));
			consolelog("setVolume #3 = " + volume); // 16.5 || 16 || 1 || 100

		} else if ( "percentage" in vol && vol.percentage >= 1 && vol.percentage <= 100 ) {
			// sent by UI
			volume = vol.percentage;
		}

		if ( typeof volume == "number" && isFinite(volume) && !(isNaN(volume)) && volume != NaN) {
			consolelog("AVR23212.setVolume(): Update a" + self.joins.volume.level + " = " + volume);
			CF.getJoin("a"+self.joins.volume.level, function(j, v, t) {
				if ( v != (volume + "%") ) {
					consolelog("setVolume(): Update a" + self.joins.volume.level + " = " + volume);
					CF.setJoin( j, (volume + "%") );
				}
			});
		}
	};

	self.getVolume = function(vol) {
		try {
			consolelog("vol = (next line --v)");
			console.log(vol);
			if ( "percentage" in vol ) {
				// sent by UI
				// TEST VALUE = 16.5% || 16% || 1% || 100%
				vol = parseFloat(vol.percentage.replace("%", ""));
				if ( vol > 100 ) vol = 100;
				if ( vol < 1 ) vol = 1;

				consolelog("getVolume(percentage) = " + vol);

				if ( isFinite(vol) ) {
					value = parseFloat(vol) - 2; // 14.5 || 14 || -1 || 98
					if ( value < 0 ) value += 101; // 14.5 || 14 || 99 || 98
					consolelog("Volume @ " + vol + "% converted for Denon AVR-2312 = " + value);
					return value.toString();
				} else return false;
			} else if ( "ASCII" in vol ) {
				// sent by Denon AVR-2312

			}
		} catch (e) {
			CFlog("Exception caught getting volume - " + e);
		}
	}

	// self.action ( "string", "string", "string" )
	self.action = function(command, parameter, value) {
		if ( typeof parameter == "string" ) parameter = parameter.toUpperCase();
		if ( typeof value == "string" ) value = value.toUpperCase();
		switch (command.toUpperCase()) {
			case "POWER":
				command = "PW";
				switch (parameter) {
					case "OFF":
						param = "STANDBY";
						break;
					case "ON":
						param = parameter;
						break;
				}
				// re-sync power state
				setTimeout(function() {
					self.query("POWER");
				}, 300);
				break;
			case "VOLUME":
				try {
					command = "MV";
					switch (parameter) {
						case "UP":
						case "DOWN":
							param = parameter;
							break;
						default:
							consolelog("self.action(volume, value) called");
							param = (value >= 0 && value <= 100) ? self.getVolume({"percentage": value}) : undefined; // check volume level value sent is valid
							break;
					}
				} catch (e) {
					self.CFlog("Exception caught changing volume - " + e);
				}
				break;
			case "MUTE":
				command = "MU";
				switch(parameter) {
					case "ON":
					case "OFF":
						param = parameter;
						break;
					//default:
					//	CF.getJoin(parameter.toLowerCase(), function(j, v, t) {
					//		console.log("mute join = " + j + ", value = " + v);
					//		myAmp.action("MUTE", ((v === 1) ? "ON" : "OFF"));
					//	});
					//	break;
				}
				break;
			case "CURSOR":
				command = "MN";
				switch(parameter) {
					case "UP":
						param = "CUP";
						break;
					case "DOWN":
						param = "CDN";
						break;
					case "LEFT":
						param = "CLT";
						break;
					case "RIGHT":
						param = "CRT";
						break;
					case "ENTER":
						param = "ENT";
						break;
					case "RETURN":
						param = "RTN";
						break;
					case "MENU":
						param = "MEN ";
						switch(value) {
							case "ON":
							case "OFF":
								param += value;
								break;
						}
						break;
				}
				break;
			case "AUDIO":
				command = "MS"
				switch(parameter) {
					case "DIRECT":
					case "STEREO":
					case "MUSIC":
					case "MOVIE":
					case "GAME":
						param = parameter;
						break;
					case "PUREDIRECT":
						param = "PURE DIRECT";
						break;
					case "DOLBY":
						param = "DOLBY DIGITAL";
						break;
				}
				break;
			case "INPUT":
				command = "SI";
				switch(parameter) {
					case "RPI":
						param = "DVR";
						break;
					case "BLURAY":
						param = "BD";
					case "AUX":
						param = "V.AUX";
					case "TV":
					case "DVR":
					case "CD":
					case "DVD":
					case "TUNER":
						param = parameter;
						break;
				}
				break;
			case "ZONE2":
				command = "Z2";
				switch (parameter) {
					case "ON":
					case "OFF":
						param = parameter; // parameter = ON || OFF
						break;
					case "CHANNELS":
						command += "CS";
						switch(value) {
							case "STEREO":
								param = "ST";
								break;
							case "MONO":
								param = "MONO";
								break;
						}
						break;
					case "MUTE":
						command += "MU";
						param = value; // ON || OFF
						break;
					case "VOLUME":
						switch(value) {
							case "UP":
							case "DOWN":
								param = value; // UP || DOWN
								break;
							default:
								// 0% = 01, 10% = , 90% = ,100% = 81
								try {
									value = parseInt(value.replace("%", ""));
									if (value > 99) value = 99;
									if (value < 0) value = 0;
									value = ( value + 99 ).toString().substr(-2);

									if (value >= 0 && value <= 99) {
										consolelog("Set volume to " + value + "%");
										param = value;
									}
								} catch (e) {
									consolelog("VOLUME feedback - " + e);
								}
						}
						break;
				}
				break;
		}
		if ( typeof param != "undefined" && typeof command != "undefined" ) self.tcp(command, param);
	};

	self.query = function(q, parameter) {
		if ( typeof parameter == "string" ) parameter = parameter.toUpperCase();

		switch (q.toUpperCase()) {
			case "POWER":
				command = "PW";
				break;
			case "VOLUME":
				command = "MV";
				break;
			case "MUTE":
				command = "MU";
				break;
			case "INPUT":
				command = "SI";
				break;
			case "SLEEP":
				command = "SLP";
				break;
			case "ZONE2":
				command = "Z2";
				switch (parameter) {
					case "CHANNEL":
						command += "CS";
						break;
					case "MUTE":
						command += "MU";
						break;
				}
				break;
			case "VIDEO":
				command = "VS";
				switch (parameter) {
					case "PROCESSING":
						command += "VPM";
						break;
					case "AUDIO OUT":
						command += "AUDIO";
						break;
					case "RESOLUTION":
						command += "SC";
						break;
					case "DISPLAY":
						command += "ASP";
						break;
				}
				break;
			case "DIGITAL":
				command = "DC";
				break;
			case "SIGNAL":
				command = "SD";
				break;
		}
		parameter = "?";

		// process request if valid or if there are queries still in the queue
		if ( ( typeof command != "undefined" && typeof parameter != "undefined" ) || query.length > 0) {
			// only queries give a response so can be used for connection state updates
			// the following block queues commands so they are sent one at a time to ensure the
			// timeout id isn't overriden on lost causing connection/power states to go out of sync

			//query.push({"command": command, "parameter": parameter}); // add command to query queue
			query.push(command);


			if (intervalID == null) {
				// (re)start sending commands every 200ms
				intervalID = setInterval(function() {
					consolelog(queryCount + ". Query command loop (ID = " + intervalID + ") start...\ntimeoutID = " + timeoutID);
					consolelog(queryCount + ". Query queue length = " + query.length + " - query object --v");
					console.log(query);


					if (query.length == 0) {
						// query queue is empty to stop running the command loop
						consolelog(queryCount + ". Query queue is empty - stopping command loop...");
						clearInterval(intervalID);
						intervalID = null;
					} else if ( timeoutID == null ) {
						timeoutID = ""; // stops block running again before receiving join value below
						CF.getJoin("d"+self.joins.connected, function(j, v, t) {
							if ( v === 1 ) {
								// previous query response received (or timed out), so send next command if still connected to device
								//q = query.shift(); // get first query object
								//response.push(query.shift()); // get add query to end of response waiting array

								//consolelog("Sending QUERY: command = " + q.command + ", parameter = " + q.parameter);
								//self.tcp(q.command, q.parameter);
								consolelog(queryCount + ". Sending QUERY: command = " + query[0] + ", parameter = ?"); // send next command in queue
								self.tcp(query[0], "?");
								queryCount++;
								timeoutID = setTimeout(function() {
									CF.setJoin("d"+self.joins.connected, 0);
									consolelog(queryCount + ". json response timed out after " + jsonTimeout + "ms");
									timeoutID = null;
								}, jsonTimeout);
							} else {
								// stop the loop until amp is reconnected
								clearInterval(intervalID);
								intervalID = null;
							}
						});
					} else {
						consolelog(queryCount + ". Query loop passed without running command...");
					}
					consolelog(queryCount + ". Query command loop complete...\n");
				}, 200);
			}
		}
	};

	self.validIPAddress = function(ip) {
		regex = new RegExp("^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$");
		return regex.test(ip);
	};

	/*
	self.setVolumeJoin = function(number) {
		self.joins.volume.level = number;
	};
	*/

	// --- Private Function ---

	function QueueInitMsg(msg) {
		if (typeof msg == "string") self.init.queue.push(msg);
	}

	function consolelog(msg) {
		if (CF.debug) console.log("DenonAVR: " + msg);
	}

	function CFlog(msg) {
		if (CF.debug) CF.log("DenonAVR: " + msg);
	}

	self.setup();

	return self;
};