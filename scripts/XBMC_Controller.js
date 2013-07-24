var XBMC_Controller = function(params) {

	//var MoviesArray = null;			// Global array for Movies
	//var TVShowsArray = null;			// Global array for TV Shows
	//var ArtistsArray = null;			// Global array for Music
	var playerids = { 0: 0, 1: 1, "audio" : 0, "video": 1 }; // playerid = playerids[((typeof id == "string") ? id.toLowerCase() : id)] || throw "invalid player id"
	var mediaList = [];			// Global array for storing the media lists;
	var mediaListIDs = [];

	var self = {
		address:		params.address || "192.168.10.103",
		port:			params.port || "9090",
		mac:			params.mac || "",
		username:		params.username || "xbmc",
		password:		params.password || "xbmc",
		get:			[],
		joins:			{
			connected:	4001,
			init:		{
						join:		245,
						queue:		[],
			},
		},
		ids:			{
			movies:		10,
			tvshows:	20,
			seasons:	21,
			episodes:	22,
			artists:	30,
			albums:		31,
			songs:		32,
		},
		jsonBuffer:		"",
		jsonBraceCount:		0,
		jsonQueue:		[],
		jsonLoopID:		null,
		jsonWaitResponse:	false,
		player:			{
				speed:		null,
				id:		null,
				item:		{
							id:		null,
							type:		null,
				},
		},
		selected:		{
				id:		null,
				type:		null, // ENUM(movie, tvshow, episode, artist, album, song)
				resume:		false,
				//player:		null, // ENUM(0, 1, "audio", "video")
		},
		listsComplete:		false,
	};

	var setup = false;

	mediaListIDs[self.ids.movies] = "movies";
	mediaListIDs[self.ids.tvshows] = "tvshows";
	mediaListIDs[self.ids.artists] = "artists";

	// --- Private Functions --- //


	function consolelog(msg) {
		if (CF.debug) console.log("XBMC_Controller: " + msg);
	}

	function CFlog(msg) {
		if (CF.debug) CF.log("XBMC_Controller: " + msg);
	}

	function getMediaProperties(type) {
		switch (type.toLowerCase()) {
			case "movie":
				return ["title", "thumbnail", "fanart", "genre", "playcount", "mpaa", "rating", "runtime", "year", "file", "resume"];
			case "tvshow":
				return ["thumbnail", "fanart", "title", "year", "season", "episode", "art", "file", "playcount", "watchedepisodes"];
			case "season":
				return ["season", "tvshowid", "showtitle", "title", "year", "playcount", "episode", "thumbnail", "file", "art", "watchedepisodes"];
			case "episode":
				return ["episodeid", "season", "tvshowid", "thumbnail", "showtitle", "firstaired", "episode", "resume", "file", "title", "playcount", "art"];
			case "artist":
				return ["thumbnail", "fanart", "formed", "yearsactive"];
			case "album":
				return ["albumartistid", "albumid", "thumbnail", "title", "fanart", "year", "playcount"];
			case "song":
				return ["thumbnail", "title", "track", "file", "albumartistid", "albumid", "songid", "playcount"];
			default:
				return false;
		}
	}

	// --- Public Functions --- //
	self.setup = function() {
		if ( "XBMC" in CF.systems ) {
			CF.setSystemProperties("XBMC", {
				enabled:	true,
				address:	self.address,
				port:		self.port,
				connect:	self.joins.connected
			});
			return true;
		} else {
			consolelog("No XBMC system defined in gui!");
			return false;
		}
	};

	self.json = function(method, params, id) {
		// need to create a queue to try and help the response buffer issues....
		if ( typeof method != "undefined" && typeof params != "undefined" && typeof id != "undefined" ) self.jsonQueue.push({"method": method, "params": params, "id": id});

		if (self.jsonWaitResponse == false && self.jsonQueue.length > 0 && self.joins.connected.value == 1) {
			try {
				request = self.jsonQueue.shift();
				if ( request.id == "" || request.id == null || request.id.length == 0 ) {
					//id = self.reqID++;
					request.id = 0;
				}

				var json = {
					"jsonrpc":	"2.0",
					"method":	request.method,
					"params":	request.params,
					"id":		request.id
				};
				consolelog("Sending JSON command -> " + JSON.stringify(json));

				// update the init message
				if ( !(self.listsComplete) ) {
					consolelog("request.method = " + request.method);
					switch(request.method) {
						case "VideoLibrary.GetTVShows":
							request.method = "VideoLibrary.GetTV Shows"; // fix to add space
						case "VideoLibrary.GetMovies":
						case "AudioLibrary.GetArtists":
							consolelog("Preloading list of " + request.method.substr(16).toLowerCase() + "...");  // remove when finished testing
							//CF.setJoin("s"+self.joins.init, ("preloading list of " + request.method.substr(16).toLowerCase() + " from " + self.address + "..."));
							self.DisplayInitMsg("preloading list of " + request.method.substr(16).toLowerCase() + " from " + self.address + "...");
							break;
					}
				}
				CF.send("XBMC", JSON.stringify(json));
				self.jsonWaitResponse = true;
			} catch (e) {
				CFlog("Exception caught while processing response in xbmc.json: " + e);
			}
		} else {
			if (self.jsonLoopID == null) {
				self.jsonLoopID = setInterval(function() {
					consolelog("JSON request queue --v");
					console.log(self.jsonQueue);
					self.json(); // try and send the queued items..
				}, 1000);
			} else if (self.jsonQueue.length == 0) {
				clearInterval(self.jsonLoopID);
				self.jsonLoopID = null;
			}
		}
	};

	self.DisplayInitMsg = function(msg) {
		try {
			if (typeof msg == "string") self.joins.init.queue.push(msg);
			//consolelog("init.queue --v");
			//console.log(self.joins.init.queue);
			if ( (msg = self.joins.init.queue.shift()) != undefined ) {
				//consolelog("displaying init msg - " + msg);
				CF.setProperties({join: "s"+self.joins.init.join, opacity: 1}, 0, 0, CF.AnimationCurveLinear, function(j) {
					CF.setJoin(j, msg);
					// fade the msg out over 5secs
					CF.setProperties({join: j, opacity: 0}, 0, 5, CF.AnimationCurveLinear, function() {
						self.DisplayInitMsg();
					});
				}, "s"+self.joins.init.join);
			} //else consolelog("init.queue.shift() == undefined");
		} catch (e) {
			consolelog("exception caught in DisplayInitMsg(msg) - " + e);
		}
	};


	// no longer in use (may need revisiting when doing seasons, episodes, albums, songs)
	self.pushListArray = function(type, arr) {
		if ( typeof arr == "object" ) {
			//consolelog("Pushing " + type + " array to list...");
			if ( typeof type == "string" ) type = type.toLowerCase();
			switch(type) {
				case "movies":
				case self.ids.movies:
					MoviesArray.push(arr);
					//console.log(MoviesArray);
					break;

				case "tvshows":
				case self.ids.tvshows:
					TVShowsArray.push(arr);
					break;
				case "seasons":
				case self.ids.seasons:
					TVShowsArray[arr.tvshowid].push(arr);
					break;
				case "episodes":
				case self.ids.episodes:
					TVShowsArray[arr.tvshowid][arr.season].push(arr);
					break;

				case "artists":
				case self.ids.artists:
					ArtistsArray.push(arr);
					break;
				case "albums":
				case self.ids.albums:
					ArtistsArray[arr.artistid].push(arr);
					break;
				case "songs":
				case self.ids.songs:
					ArtistsArray[arr.artistid][arr.albumid].push(arr);
					break;
			}
		}
	};

	self.GetListArray = function(type) {
		//if ( typeof type == "number" ) type = mediaListIDs[type] || null; // convert type id to string

		//consolelog("GetListArray(): indexOf(type) = " + self.ids.indexOf(type));

		if ( typeof type == "string" ) type = type.toLowerCase();
		else if ( typeof type == "number" ) {
			for (key in self.ids) {
				consolelog("key = " + key + ", type = " + type);
				if ( self.ids[key] == type) {
					consolelog("found self.ids[" + key + "] == type in GetListArray()");
					type = key;
					break;
				}
			}
		}

		switch(type) {
			case "movies":
			case "tvshows":
			case "artists":
			//case self.ids.movies:
			//case self.ids.tvshows:
			//case self.ids.artists:
				return mediaList[type];
				break;

			case "movies":
			case self.ids.movies:
				return MoviesArray;
				break;
			case "tvshows":
			//case "seasons":
			//case "episodes":
			case self.ids.tvshows:
			//case self.ids.seasons:
			//case self.ids.episodes:
				return TVShowsArray;
				break;
			case "artists":
			//case "albums":
			//case "songs":
			case self.ids.artists:
			//case self.ids.albums:
			//case self.ids.songs:
				return ArtistsArray;
				break;
			default:
				consolelog("Invalid parameter passed to XBMC_Controller.GetListArray(type)");
		}
	};

	self.SetListArray = function(type, arr) {
		consolelog("SetListArray(" + type + ", arr) array --v");
		console.log(arr);
		if ( typeof type == "string" ) type = type.toLowerCase();
		else if ( typeof type == "number") {
			for (var key in self.ids) {
				consolelog("key = " + key + ", type = " + type);
				if ( self.ids[key] == type) {
					consolelog("found self.ids[" + key + "] == type in SetListArray()");
					type = key;
					break;
				}
			}
		}
		switch(type) {
			case "movies":
			case "tvshows":
			case "artists":
				mediaList[type] = (typeof arr == "object") ? arr : [];
				break;

			case "movies":
			case self.ids.movies:
				MoviesArray = (typeof arr == "object") ? arr : [];
				break;
			case "tvshows":
			case self.ids.tvshows:
				TVShowsArray = (typeof arr == "object") ? arr : [];
				break;
			case "artists":
			case self.ids.artists:
				ArtistsArray = (typeof arr == "object") ? arr : [];
				break;
			default:
				consolelog("Invalid parameter passed to XBMC_Controller.SetListArray(type, arr)");
		}

		console.log("typeof mediaList[movies] = " + (typeof mediaList["movies"]) +
				", typeof mediaList[tvshows] = " + (typeof mediaList["tvshows"]) +
				", typeof mediaList[artists] = " + (typeof mediaList["artists"]));
		if ( (typeof mediaList["movies"] == "object") && (typeof mediaList["tvshows"] == "object") && (typeof mediaList["artists"] == "object")) self.listsComplete = true;
	}
/*
	self.setListArray = function(type, arr) {
		if ( typeof type == "string" ) type = type.toLowerCase();
		switch(type) {
			case "movies":
			case self.ids.movies:
				MoviesArray = arr;
				break;
			case "tvshows":
			case self.ids.tvshows:
				TVShowsArray = arr;
				break;
			case "artists":
			case self.ids.artists:
				ArtistsArray = arr;
				break;
		}
	};

	self.resetListArray = function(type, arr) {
		if ( typeof type == "string" ) type = type.toLowerCase();
		switch(type) {
			case "movies":
			case self.ids.movies:
				MoviesArray = (typeof arr == "object") ? arr : [];
				break;
			case "tvshows":
			case self.ids.tvshows:
				TVShowsArray = (typeof arr == "object") ? arr : [];
				break;
			case "artists":
			case self.ids.artists:
				ArtistsArray = (typeof arr == "object") ? arr : [];
				break;
		}
	}
*/
	self.getURL = function(type) {
		var host;
		host = type.toLowerCase() + "://" +
			((self.username == null) ? "" : self.username) +
			((self.password == null) ? "" : ":" + self.password) +
			((self.username == null) ? "" : "@") +
			self.address + ":" +
			((type.toUpperCase() == "HTTP") ? "8080" : self.port) +
			"/";
		return host;
	};

	// --- PUBLIC XBMC actions --- //
	self.ping = function() {
		self.json("JSONRPC.Ping", {}, null);
	};

	self.playVideo = function(file) {
		if (file !== undefined) {
			self.json("Player.Open", { "item":{"file": file} }, "");
			self.json("Playlist.Add", { "playlistid":1, "item":{ "file": file}}, "");
			self.player.id = 1; // video
			//self.getVideoPlayerStatus();		// Set feedback status on Play/Pause button
		}
	};

	self.playAudio = function(file) {
			if (file !== undefined) {
				self.json("Player.Open", { "item":{"file": file} }, "");
				self.json("Playlist.Add", { "playlistid":0, "item":{ "file": file}}, "");
				self.player.id = 0; // audio
				//self.getVideoPlayerStatus();		// Set feedback status on Play/Pause button
			}
	};


	// data = {"file": string, "player": ENUM(0, 1, "video", "audio"), "resume": boolean(optional)}
	self.playItem = function(data) {

		consolelog("selectedItem.length = " + self.selectedItem.length);
		if (self.selectedItem.length > 0) {
			// selectedItem.type = tvshow|episode|movie|artist|album|song
			self.player.id = (self.selectedItem.media.toLowerCase() == "video") ? 1 : 0;
			params = {};
			params.open.item[self.selectedItem.type+"id"] = self.selectedItem.id;
			params.open.options.resume = self.selectedItem.resume;
			params.add.playlistid = self.player.id
			params.add.item[self.selectedItem.type+"id"] = self.selectedItem.id;

			self.json("Player.Open", params.open, "Player.Open");
			self.json("Playlist.Add", params.add, "");
			self.selectedItem = {}; // clear selection
		} else {
			try {
				// apply resume flag if set
				params.open.options.resume = data.resume;
			} catch (e) {
				// default to starting from beginning
				params.open.options.resume = false;
			}

			try {
				//playerids = { 0: 0, 1: 1, "audio" : 0, "video": 1};
				self.player.id = playerids[((typeof data.player == "string") ? data.player.toLowerCase() : data.player)];
				params.open.item.file = data.file;
				params.add = { "playlistid": self.player.id, "item": { "file": data.file } };
			} catch (e) {
				consolelog("Invalid parameters passed to self.playItem(params) -\n" + e);
			}
		}

		try {
			self.json("Player.Open", params.open, "Player.Open");
			self.json("Playlist.Add", params.add, "");
		} catch (e) {
			consolelog("Failed to play chosen item :(");
		}

	};

	self.Stop = function(media) {						// Stop
		media = (media == undefined) ? self.player.id : media;
		consolelog("Stop command requested. media = " + media);
		switch(media) {
			case "video":
			case 1:
			case null:
				self.json("Player.Stop", {"playerid":1}, "Player.Stop");
				if ( media != null ) break;
			case "audio":
			case 0:
				self.json("Player.Stop", {"playerid":0}, "Player.Stop");
				break;
		}
	};

	self.PlayPause = function(media) {						// Toggle Play/Pause
		media = (media == undefined) ? self.player.id : media;
		switch(media) {
			case "video":
			case 1:
			case null:
				self.json("Player.PlayPause", {"playerid":1}, null);
				if ( media != null ) break;
			case "audio":
			case 0:
				self.json("Player.PlayPause", {"playerid":0}, null);
				break;
		}
	};

	self.SkipNext = function(media) {						// Skip Next
		media = (media == undefined) ? self.player.id : media;
		switch(media) {
			case "video":
			case 1:
			case null:
				self.json("Player.GoTo", {"playerid":1, "to":"next"}, null);
				if ( media != null ) break;
			case "audio":
			case 0:
				self.json("Player.GoTo", {"playerid":0, "to":"next"}, null);
				break;
		}
	};

	self.SkipPrevious = function(media) {						// Skip Previous
		media = (media == undefined) ? self.player.id : media;
		switch(media) {
			case "video":
			case 1:
			case null:
				self.json("Player.GoTo", {"playerid":1, "to":"previous"}, null);
				if ( media != null ) break;
			case "audio":
			case 0:
				self.json("Player.GoTo", {"playerid":0, "to":"previous"}, null);
				break;
		}
	};

	self.FastForward = function(media) {						// Fast Forward
		media = (media == undefined) ? self.player.id : media;
		speed = null;
		switch(self.player.speed) {
			case 1:
				speed = 2;
				break;
			case 2:
				speed = 4;
				break;
			case 4:
				speed = 8;
				break;
			case 8:
				speed = 16;
				break;
			case 16:
				speed = 32;
				break;
			case 32:
				speed = 1;
				break;
		}

		if (speed != null) {
			switch(media) {
				case "video":
					self.json("Player.Speed", {"playerid":1, "speed":speed}, null);
					break;
				case "audio":
					self.json("Player.GoTo", {"playerid":0, "to":speed}, null);
					break;
			}
		}
	};

	self.Rewind = function(media) {						// Rewind
		media = (media == undefined) ? self.player.id : media;
		speed = null;
		switch(self.player.speed) {
			case 1:
				speed = -1;
				break;
			case -1:
				speed = -2;
				break;
			case -2:
				speed = -4;
				break;
			case -4:
				speed = -8;
				break;
			case -8:
				speed = -16;
				break;
			case -16:
				speed = -32;
				break;
			case -32:
				speed = 1;
				break;
		}

		if (speed != null) {
			switch(media) {
				case "video":
					self.json("Player.Speed", {"playerid":1, "speed":speed}, null);
					break;
				case "audio":
					self.json("Player.GoTo", {"playerid":0, "to":speed}, null);
					break;
			}
		}
	};

	self.Scan = function(type) {
		switch(type) {
			case "video":
				self.json("VideoLibrary.Scan", {}, "");
				break;
			case "audio":
				self.json("AudioLibrary.Scan", {}, "");
				break;
		}
	};

	self.InputAction = function(action) {
		switch(action.toLowerCase()) {
			case "up":
				self.json("Input.Up", {}, "");		// XBMC Menu : Up
				break;
			case "down":
				self.json("Input.Down", {}, "");	// XBMC Menu : Down
				break;
			case "left":
				self.json("Input.Left", {}, "");	// XBMC Menu : Left
				break;
			case "right":
				self.json("Input.Right", {}, "");	// XBMC Menu : Right
				break;
			case "select":
				self.json("Input.Select", {}, "");	// XBMC Menu : Select
				break;
			case "back":
				self.json("Input.Back", {}, "");	// XBMC Menu : Back
				break;
			case "home":
				self.json("Input.Home", {}, "");	// XBMC Menu : Home
				break;
			case "menu":
				self.json("Input.ContextMenu", {}, "");	// XBMC Menu : Home
				break;
			case "info":
				self.json("Input.Info", {}, "");	// XBMC Menu : Info
				break;
			case "osd":
				self.json("Input.ShowOSD", {}, "");	// XBMC Menu : OSD
				break;
			case "enter":
				self.json("Input.ExecuteAction", {"action": "enter"}, "");	// XBMC : Enter
				break;
			case "pageup":
				self.json("Input.ExecuteAction", {"action": "pageup"}, "");	// XBMC : Page Up
				break;
			case "pagedown":
				self.json("Input.ExecuteAction", {"action": "pagedown"}, "");	// XBMC : Page Down
				break;
			case "fullscreen":
				self.json("Input.ExecuteAction", {"action": "fullscreen"}, "");	// XBMC : Fullscreen
				break;
			case "play":
				self.json("Input.ExecuteAction", {"action": "play"}, "");	// XBMC : Play
				break;
			case "pause":
				self.json("Input.ExecuteAction", {"action": "pause"}, "");	// XBMC : Pause
				break;
			case "stop":
				self.json("Input.ExecuteAction", {"action": "stop"}, "");	// XBMC : Stop
				break;
			case "audiotoggle":
				self.json("Input.ExecuteAction", {"action": "audiotoggledigital"}, ""); // Toggle between analog and digital audio output
				break;
		}
	};

	self.SystemAction = function(action) {
		// execute the action
		switch(action) {
			case "shutdown":
				self.json("System.Shutdown", {}, null);  	// XBMC System : Shutdown
				break;
			case "suspend":
				self.json("System.Suspend", {}, null);  	// XBMC System : Suspend
				break;
			case "hibernate":
				self.json("System.Hibernate", {}, null);  	// XBMC System : Hibernate
				break;
			case "reboot":
				self.json("System.Reboot", {}, null);  		// XBMC System : Reboot
				break;
			case "exit":
				self.json("Application.Quit", {}, null);  	// XBMC System : Quit
				break;
		}
	};

	// state = ENUM[off, on, 0, 1, digital join]
	self.Subtitles = function(state) {
		consolelog("Setting shuffle state = " + state);
		var send = false;
		valid = {"ON": 1, "on": 1, "1": 1, 1: 1, "OFF": 0, "off": 0, "0": 0, 0: 0};
		/*
		//if ( typeof state == "number" ) state = state.toString();
		if ( !(state in valid) ) {
			// state not found
			if ( typeof state == "string" && state[0].toLowerCase()  == "d" ) {
				CF.getJoin(state.toLowerCase(), function(j, v) {
					state = (v === 1) ? 1 : 0; // sync
					send = true;
				});
			}
		} else {
			state = valid[state];
			send = true;
		}
		*/

		if ( typeof state == "string" ) state = state.toLowerCase();
		switch (state) {
			case "off":
			case "on":
			case "0":
			case "1":
			case 0:
			case 1:
				state = valid[state];
				send = true;
				break;
			case undefined:
			case null:
				// TODO get from serial join(image)
				break;
			default:
				// state not found, get state from token on digital join
				console.log("Attempting to locate subtitle join from state parameter...");
				if ( typeof state == "string" && state[0].toLowerCase()  == "s" ) {
					CF.getJoin(state.toLowerCase(), function(j, v, t) {
						consolelog("Subtitle join string = " + j);
						state = (t["[subtitle]"] === 1) ? 0 : 1; // toggle
						send = true;
					});
				}
				break;
		}


		var subtitleid = setInterval(function() {
			if (send) {
				clearInterval(subtitleid);
				subtitleid = null;
				self.json("Player.SetSubtitle", {"playerid": self.player.id, "subtitle": (state == 1) ? "on" : "off"}, "SetSubtitle");  	// XBMC Subtitles
			}
		}, 200);
	};

	// state = ENUM[off, on, 0, 1, digital join]
	self.Shuffle = function(state) {
		consolelog("Setting shuffle state = " + state);
		var send = false;
		valid = {"ON": 1, "on": 1, "1": 1, 1: 1, "OFF": 0, "off": 0, "0": 0, 0: 0};
		/*
		//if ( typeof state == "number" ) state = state.toString();
		if ( !(state in valid) ) {
			// state not found, try to get token from digital join string
			if ( typeof state == "string" && state[0].toLowerCase()  == "d" ) {
				CF.getJoin(state.toLowerCase(), function(j, v) {
					state = (v === 1) ? 1 : 0; // sync
					send = true;
				});
			}
		} else {
			state = valid[state];
			send = true;
		}
		*/

		if ( typeof state == "string" ) state = state.toLowerCase();
		switch (state) {
			case "off":
			case "on":
			case "0":
			case "1":
			case 0:
			case 1:
				state = valid[state];
				send = true;
				break;
			case undefined:
			case null:
				// TODO get from serial join(image)
				break;
			default:
				// state not found, get state from token on digital join
				consolelog("Attempting to locate shuffle join from state parameter...");
				if ( typeof state == "string" && state[0].toLowerCase()  == "s" ) {
					CF.getJoin(state.toLowerCase(), function(j, v, t) {
						try {
							consolelog("Shuffle join string = " + j);
							state = (t["[shuffle]"] === 1) ? 0 : 1; // toggle
						} catch (e) {
							consolelog("Failed to find the [shuffle] token. Setting default state to on");
							state = 1;
						}
						send = true;
					});
				}
				break;
		}

		var shuffleid = setInterval(function() {
			if (send) {
				clearInterval(shuffleid);
				shuffleid = null;
				self.json("Player.SetShuffle", {"playerid": self.player.id, "shuffle": (state == 1) ? true : false}, "SetShuffle");  	// XBMC Shuffle
			}
		}, 200);
	};

	// state = ENUM[off, one, all, digital join]
	self.Repeat = function(state) {
		consolelog("Setting repeat state = " + state);
		var send = false;
		var cycle = { off: "one", one: "all", all: "off" };
		if ( typeof state == "string" ) state = state.toLowerCase();

		switch (state) {
			case "off":
			case "one":
			case "all":
				send = true;
				break;
			default:
				// state not found, get state from token on digital join
				if ( typeof state == "string" && state[0].toLowerCase()  == "s" ) {
					CF.getJoin(state.toLowerCase(), function(j, v, t) {
						state = (t["[repeat]"] in cycle) ? cycle[t["[repeat]"]] : "one"; // cycle (default to toggle from off->one if token not set)
						send = true;
					});
				}
		}

		var repeatid = setInterval(function() {
			if (send) {
				clearInterval(repeatid);
				repeatid = null;
				self.json("Player.SetRepeat", {"playerid": self.player.id, "repeat": state}, null);  	// XBMC Repeat
			}
		}, 200);


	};

	self.Seek = function(analog) {
		if (analog >=0 && analog <= 65535 && self.player.id != null) self.json("Player.Seek", {"playerid": self.player.id, "value": (analog / 65535) * 100}, "Player.Seek");
	};

	self.PartyMode = function(type) {
		id = (typeof type == "string" && type == "video") ? 1 : 0; // default to audio partymode if type not supplied
		self.json("Player.SetPartymode", {"playerid": id, "partymode": true}, "");
	};

	self.UpdatePlayer = function() {
		if (self.player.id != null) {
			self.json("Player.GetProperties", {"playerid": self.player.id, "properties": ["speed", "subtitleenabled", "shuffled", "repeat", "percentage", "time", "totaltime"]}, "Player.GetProperties");
			return true;
		} else return false;
	};

	self.getMovies = function(id, order, method) {
		self.json("VideoLibrary.GetMovies", { "sort": {"order": ((typeof order == "string") ? order : "ascending"), "method": ((typeof method == "string") ? method : "label")}, "properties": getMediaProperties("movie")}, ((typeof id == "number") ? id : self.ids.movies));
	};

	self.get["movies"] = function(id, order, method) {
		self.json("VideoLibrary.GetMovies", { "sort": {"order": ((typeof order == "string") ? order : "ascending"), "method": ((typeof method == "string") ? method : "label")}, "properties": getMediaProperties("movie")}, ((typeof id == "number") ? id : self.ids.movies));
	};

	self.updateMovieList = function(listJoin, json) {

	};

	self.getTVShows = function(id, order, method) {
		self.json("VideoLibrary.GetTVShows", {"sort": { "order": ((typeof order == "string") ? order : "ascending"), "method": ((typeof method == "string") ? method : "label")}, "properties": getMediaProperties("tvshow")}, ((typeof id == "number") ? id : self.ids.tvshows)); // for Frodo
	};

	self.get["tvshows"] = function(id, order, method) {
		self.json("VideoLibrary.GetTVShows", {"sort": { "order": ((typeof order == "string") ? order : "ascending"), "method": ((typeof method == "string") ? method : "label")}, "properties": getMediaProperties("tvshow")}, ((typeof id == "number") ? id : self.ids.tvshows)); // for Frodo
	};

	self.getTVSeasons = function(id, order, method, tvshowid) {
		tvshowid = (typeof tvshowid == "undefined") ? -1 : tvshowid; // -1 = all tvshows
		self.json("VideoLibrary.GetSeasons", {"sort": { "order": ((typeof order == "string") ? order : "ascending"), "method": ((typeof method == "string") ? method : "label")}, "params": {"tvshowid" : tvshowid}, "properties": getMediaProperties("season")}, ((typeof id == "number") ? id : self.ids.tvshows)); // for Frodo
	};

	self.get["seasons"] = function(id, order, method, tvshowid) {
		tvshowid = (typeof tvshowid == "undefined") ? -1 : tvshowid; // -1 = all tvshows
		self.json("VideoLibrary.GetSeasons", {"sort": { "order": ((typeof order == "string") ? order : "ascending"), "method": ((typeof method == "string") ? method : "label")}, "params": {"tvshowid" : tvshowid}, "properties": getMediaProperties("season")}, ((typeof id == "number") ? id : self.ids.tvshows)); // for Frodo
	};

	self.getTVEpisodes = function(id, order, method, tvshowid, season) {
		tvshowid = (typeof tvshowid == "undefined") ? -1 : tvshowid; // -1 = all tvshows
		season = (typeof season == "undefined") ? -1 : season; // -1 = all season
		self.json("VideoLibrary.GetEpisodes", {"sort": { "order": ((typeof order == "string") ? order : "ascending"), "method": ((typeof method == "string") ? method : "label")}, "params": {"tvshowid": tvshowid, "season": season}, "properties": getMediaProperties("episode")}, ((typeof id == "number") ? id : self.ids.tvshows)); // for Frodo
	};

	self.get["episodes"] = function(id, order, method, tvshowid, season) {
		tvshowid = (typeof tvshowid == "undefined") ? -1 : tvshowid; // -1 = all tvshows
		season = (typeof season == "undefined") ? -1 : season; // -1 = all season
		self.json("VideoLibrary.GetEpisodes", {"sort": { "order": ((typeof order == "string") ? order : "ascending"), "method": ((typeof method == "string") ? method : "label")}, "params": {"tvshowid": tvshowid, "season": season}, "properties": getMediaProperties("episode")}, ((typeof id == "number") ? id : self.ids.tvshows)); // for Frodo
	};

	self.updateTVShowList = function(listJoin, json) {

	};

	self.getArtists = function(id, order, method) {
		self.json("AudioLibrary.GetArtists", {"albumartistsonly": true, "sort": { "order": ((typeof order == "string") ? order : "ascending"), "method": ((typeof method == "string") ? method : "label") }, "properties": getMediaProperties("artist")}, ((typeof id == "number") ? id : self.ids.artists));
	};

	self.get["artists"] = function(id, order, method) {
		self.json("AudioLibrary.GetArtists", {"albumartistsonly": true, "sort": { "order": ((typeof order == "string") ? order : "ascending"), "method": ((typeof method == "string") ? method : "label") }, "properties": getMediaProperties("artist")}, ((typeof id == "number") ? id : self.ids.artists));
	};

	self.getAlbums = function(artistID, fanart, id) {
		self.currentArtistID = parseInt(artistID);
		self.json("AudioLibrary.GetAlbums", { "filter":{"artistid": self.currentArtistID}, "properties": getMediaProperties("album") }, ((typeof id == "number") ? id : self.ids.albums));			// Frodo
	};

	self.get["albums"] = function(artistID, fanart, id) {
		self.currentArtistID = parseInt(artistID);
		self.json("AudioLibrary.GetAlbums", { "filter":{"artistid": self.currentArtistID}, "properties": getMediaProperties("album") }, ((typeof id == "number") ? id : self.ids.albums));			// Frodo
	};

	self.getSongs = function(albumID, artist, albumtitle, fanart, id) {
		self.currentAlbumID = parseInt(albumID);
		self.json("AudioLibrary.GetSongs", { "filter":{"albumid": self.currentAlbumID}, "sort": {"order": "ascending", "method": "track"}, "properties": getMediaProperties("song")}, ((typeof id == "number") ? id : self.ids.songs));
	};

	self.get["songs"] = function(albumID, artist, albumtitle, fanart, id) {
		self.currentAlbumID = parseInt(albumID);
		self.json("AudioLibrary.GetSongs", { "filter":{"albumid": self.currentAlbumID}, "sort": {"order": "ascending", "method": "track"}, "properties": getMediaProperties("song")}, ((typeof id == "number") ? id : self.ids.songs));
	};

	self.updateMusicList = function(listJoin, json) {

	};

	/**
	 * Function: Get Active Player and Now Playing item from XBMC
	 */
	self.getNowPlaying = function(id) {
		self.json("Player.GetActivePlayers", {}, (typeof id != "undefined") ? id : "Player.GetActivePlayers");
	};

	/**
	 * Function: Get Now Playing item info from XBMC
	 */
	self.getNowPlayingItem = function(id) {
		if (self.player.id != null) {
			properties = (self.player.id == 1) ? ["title", "thumbnail", "fanart", "year", "rating", "plot", "file"] : ["title", "album", "track", "thumbnail", "fanart", "year", "artist", "file"];

			self.json("Player.GetItem", {"playerid": self.player.id, "properties": properties}, (typeof id != "undefined") ? id : "Player.GetItem");
		}
	};

	self.getSelectedMediaDetails = function(type) {
		delete media;
		switch (type.toLowerCase()) {
			case "artist":
			case "album":
			case "song":
				self.selectedItem.media = "Audio";
				break;
			case "episode":
			case "movie":
				self.selectedItem.media = "Video";
				break;
		}

		try {
			//if (typeof self.selectedItem.media != "undefined")
			self.json(self.selectedItem.media + "Library.Get" + type.substr(0,1).toUpperCase() + type.substr(1).toLowerCase() + "Details", getMediaProperties(type.toLowerCase()), "Library.GetDetails");
		} catch (e) {
			consolelog("Failed to send request for '" + type + "' details in self.getMediaDetails(type)");
		}
	};


	// Clear both audio and video playlist
	self.clearPlaylists = function() {
		self.json("Playlist.Clear", {"playlistid":0}, ""); // audio
		self.json("Playlist.Clear", {"playlistid":1}, ""); // video
	};

	// Get the current level of the volume
	self.getVolume = function(id) {

		// Sample Query: {"jsonrpc": "2.0", "method": "Application.GetProperties", "params": { "properties": ["volume", "muted", "name", "version"] }, "id": "1"}
		// Reply : {"id":"1","jsonrpc":"2.0","result":{"muted":false,"name":"XBMC",
		//           "version":{"major":11,"minor":0,"revision":"20111005-288f496","tag":"alpha"},"volume":100}}

		self.json("Application.GetProperties", {"properties":["volume", "muted"]}, id);

		/*
		old callback =>
		function(data) {	//Previous XBMC.Get Volume

			self.currentVol = data.result.volume;
			self.currentMute = data.result.muted;

			CF.setJoin("a4007", Math.round((self.currentVol/100)*65535));

			callback();
		}
		*/
	};
	// set the volume level
	self.setVolume = function(level) {
		//self.rpc("Application.setVolume", {"volume": Math.round((level/100)*100)}, self.logReplyData); 		//Previous XBMC.setVolume
		self.json("Application.setVolume", {"volume": Math.round((level/100)*100)}, ""); 		//Previous XBMC.setVolume
	};

	// Mute toggle the volume
	self.volMute = function(callback) {
		//self.rpc("Application.ToggleMute", {}, function(data) {			//previous Oct 3 night version, previously XBMC.ToggleMute
		self.rpc("Application.SetMute", {"mute": "toggle"}, function(data) {			//Latest night version
			self.currentMute = data.result;
			callback();
		});
	};

	// Reduce the volume level
	self.volDown = function(callback) {
		self.rpc("Application.setVolume", {"volume": Math.max(self.currentVol - 5, 0)}, function(data) {
			self.currentVol = data.result;
			callback();
		});
	};

	// Increase the volume level
	self.volUp = function(callback) {
		self.rpc("Application.setVolume", {"volume": Math.min(self.currentVol + 5, 100)}, function(data) {
			self.currentVol = data.result;
			callback();
		});
	};


	// --- Initialisation --- //
	return ( (setup = self.setup()) === true ) ? self : false; // return false if setup not completed... needs testing

};
