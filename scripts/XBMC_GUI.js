var XBMC_GUI = function() {
	try {

	// --- Private Variables --- //
	var guiComplete = false;
	var updatingLists = [];
	var setup = null;
	//var volumeDevice = null; // set to external volume device module using self.configureVolume()
	var nowPlayingLoopID = null;
	var selectedItemID = null; // eg: tvshowid, seasonid, artistid, albumid - dont think need to worry about songid/episodeid as not drilling down that far yet..
	var disableProgressUpdates = false;
	var selectedItem = {};
	var OnStopTimeoutID = null;
	var disconnectTimeout = 60;	// seconds before showing the disconnect popup again
	var nowPlayingLoop = {
		complete:	true,
		enabled:	false,
	};


	// --- Public Variables --- //
	var self = {
		joins:	{
			init:		245,	// S(text)
			splash:		4002,	// D(subpage)
			progress:	4003,	// A + D(button)
			mediaList:	4004,	// D(subpage) + L
			nowPlaying:	{
				subpage:	4005,	// D(subpage)
				title:		4101,	// S(text)
				year:		4102,	// S(text)
				thumb:		4103,	// S(image)
				fanart:		4104,	// S(image)
				file:		4105,	// S(text)
			},
			firstThumbnail:		1,	// mediaList->S(image)
			firstTitle:		21,	// mediaList->S(text)
			firstYear:		41,	// mediaList->S(text)
			firstWatched:		61,	// mediaList->D(button)
			volume:		{
				level:			200,	// A + S(text)
				knob:			201,	// S(image)
				indicator_start:	201,	// D(buttons): volume indicator joins 201 -> 231
				//		201->231	// D(buttons)
				touch:			202,	// S(image)
			},
			tvguide:		3,	// D(main page)
			settings:		6,	// D(main page)
			playing:		240,	// D(button)
			mute:			241,	// D(button)
			repeat:			242,	// D(button) + S(image)
			shuffle:		243,	// D(button)
			subtitles:		244,	// D(button)

			yatse:		{
				page:			5,	// D(main page)
				popup_hider:		5015,	// D(subpage)
				loading_slider:		5016,	// D(subpage) + S(image)
				sidemenu:		{
					subpage:		5001,
					movies:			5020,	// D(button) + S(text)
					tvshows:		5021,	// D(button) + S(text)
					music:			5021,	// D(button) + S(text)
					playlists:		5023,	// D(button) + S(text)
					livetv:			5024,	// D(button)
					remote:			0025,	// D(button)
					settings:		0026,	// D(button)
					np_thumbnail:		{
								join:		5027,	// S(image)
								x:		null,
								y:		null,
								w:		null,
								h:		null,
					},
					np_primary_info:	5028,	// S(text)
					np_secondary_info:	5029,	// S(text)
				},
				topbar:		{
					subpage:		5003,
					done:			5004,
					resume:			5050,
				},

				special_commands:	5005,
				sub_commands:		5006,
				pc_commands:		5007,
				diagnostics:		{
							subpage:	5008,	// D
							address:	5080,	// S(text)
							port:		5081,	// S(text)
							username: 	5082,	// S(text)
							type:		5083,	// S(text)
							speed:		5084,	// S(text)
							media:		5085,	// S(text)
				},
				wall:			5010,
				controls:		5011,
				tvguide:		5012,
				settings:	{
						xbmc:			5013,		// D(subpage)
						mysql:			5014,		// D(subpage)
				},
				np_thumbnail:	{
							join:		5030,
							url:		null,
							x:		null,
							y:		null,
							w:		null,
							h:		null,
				},
				np_info_one:		{
							join:		5031,
							value:		null,
				},
				np_info_two:		5032,
				np_info_three:		5033,
				player_time:		5034,
				fanart:		{
							join:		5035,
							url:		null,
						},
				mediaList:		5041,	// L + S(text)
				transport_playpause:	5042,	//
				loading_slider_base:	5043,	// S(image)
				loading_text:		5044,	// S(image)
				loading_text_dot1:	5045,	// D(image)
				loading_text_dot2:	5046,	// D(image)
				loading_text_dot3:	5047,	// D(image)
				no_media_found:		5048,	// S(image)


			},


		},
		XBMC:			null,
		//jsonBuffer:		"",
		//jsonBraceCount:	0,
		currentList:		"movies", // sets default list page
		volumeDevice:		null,
	};


	// --- Public Functions --- //
	self.setup = function(params) {

		try {
		self.XBMC = new XBMC_Controller();
		if ( (r = self.XBMC.Setup()) === false ) consolelog("Failed to create the XBMC_Controller object");
		else self.XBMC.QueueInitMsg("setting up xbmc communications...");
		} catch (e) { consolelog("Error running XBMC_Controller.Setup() - " + e) }

		// Clear lists from previous data for new XBMC instance to load new data
		CF.setJoins([
			{join: "l"+self.joins.mediaList, value: "0x"},			// clear the TV/Movie/Music Wall list
			{join: "l"+self.joins.yatse.mediaList, value: "0x"},		// clear the TV/Movie/Music Wall list
			{join: "d"+self.joins.yatse.controls, value: 1},		// show the controls page
			{join: "d"+self.joins.yatse.wall, value: 0},			// hide the media wall page
			{join: "d"+(self.joins.yatse.topbar.subpage-1), value: 1},	// show the standard topbar
			//{join: "s"+self.joins.yatse.np_info_one.join,	value: ""},
			//{join: "s"+self.joins.yatse.np_info_two,	value: ""},
			//{join: "s"+self.joins.yatse.np_info_three,	value: ""},
			//{join: "s"+self.joins.yatse.sidemenu.np_primary_info, value: ""},
			//{join: "s"+self.joins.yatse.sidemenu.np_secondary_info, value: ""},
		]);

		resetGUI(); // why not here?? and scrap joins from above?

		if ( self.joins.yatse.np_thumbnail.y === null) {
			// setup default controls screen thumbnail sizes
			CF.getProperties([
				"s"+self.joins.yatse.np_thumbnail.join,
				"s"+self.joins.yatse.sidemenu.np_thumbnail.join,
			], function(joins) {
				for ( var i = 0; i < joins.length; i++ ) {
					switch(joins[i].join) {
						case "s"+self.joins.yatse.np_thumbnail.join:
							self.joins.yatse.np_thumbnail.x = joins[i].x;
							self.joins.yatse.np_thumbnail.y = joins[i].y;
							self.joins.yatse.np_thumbnail.w = joins[i].w;
							self.joins.yatse.np_thumbnail.h = joins[i].h;
							break;
						case "s"+self.joins.yatse.sidemenu.np_thumbnail.join:
							self.joins.yatse.sidemenu.np_thumbnail.x = joins[i].x;
							self.joins.yatse.sidemenu.np_thumbnail.y = joins[i].y;
							self.joins.yatse.sidemenu.np_thumbnail.w = joins[i].w;
							self.joins.yatse.sidemenu.np_thumbnail.h = joins[i].h;
							break;
					}
				}
				//consolelog("np_thumbnail: w = " + j.w + ", h = " + j.h + ", x = " + j.x);

			});
		}


		CF.watch(CF.PreloadingCompleteEvent, onPreloadingComplete);
		CF.watch(CF.FeedbackMatchedEvent, "XBMC", "JSON Response", onJSONResponse);
		CF.watch(CF.JoinChangeEvent, [
			"d"+self.joins.subtitles,
			"d"+self.joins.yatse.wall,
			"d"+self.XBMC.joins.connected.join,
			"d"+self.joins.yatse.special_commands,
			"d"+self.joins.yatse.pc_commands,
			"d"+self.joins.yatse.diagnostics.subpage,
			"d"+self.joins.playing,
			"d"+self.joins.yatse.topbar.subpage,
			"s"+self.joins.yatse.fanart.join,
			"s"+self.joins.yatse.np_thumbnail.join,
			"d"+self.joins.shuffle,
			"d"+self.joins.repeat,
			"d"+self.joins.subtitles,
			"d"+self.XBMC.config.mysqlenabled.join,
			"d"+self.joins.yatse.settings.xbmc,
			], onJoinChange);

		CF.watch(CF.JoinChangeEvent, self.XBMC.configJoins, onConfigChange);
		CF.watch(CF.ConnectionStatusChangeEvent, self.XBMC.systemName, onConnectionChange, true);

		CF.watch(CF.ObjectPressedEvent, "a"+self.joins.progress, onSliderPressed);
		CF.watch(CF.ObjectDraggedEvent, "a"+self.joins.progress, onSliderDragged);
		CF.watch(CF.ObjectReleasedEvent, "a"+self.joins.progress, onSliderReleased);

		//CF.setProperties({join: "s"+self.joins.yatse.fanart.join, opacity: 0}); // hide the fanart image - already done in resetGUI()

		//if ( (r = self.XBMC.setup()) === false ) consolelog("Failed to create the XBMC_Controller object");

		return r;
	};

	self.hidePopups = function() {
		consolelog("Hiding popup subpages");
		CF.setJoins([
			{join: "d"+self.joins.yatse.pc_commands, value: 0},
			{join: "d"+self.joins.yatse.special_commands, value: 0},
			{join: "d"+self.joins.yatse.sub_commands, value: 0},
			{join: "d"+self.joins.yatse.diagnostics.subpage, value: 0},
			{join: "d"+self.joins.yatse.settings.xbmc, value: 0},
			{join: "d"+self.joins.yatse.settings.mysql, value: 0},
		]);
	};

	self.loadMediaList = function(params) {
		try {
			var updatingLists = updatingLists || {};
			// string test
			updatingLists[XBMC.in_array(params.type.toLowerCase(), XBMC.mediaListTypes, false)] = param.force || false;
		} catch (e) {
			try {
				// array test
				while(prop = params.type.shift()) updatingLists[XBMC.in_array(prop, XBMC.mediaListTypes, false)] = params.force || false;
			} catch (e) {
				try {
					// object test
					//for (var prop in param.type) this[XBMC.in_array(prop, XBMC.mediaListTypes, false)] = true;
					for (var prop in params.type) {
						if( params.type.hasOwnProperty(prop) && (type = XBMC.in_array(prop, XBMC.mediaListTypes, false)) ) updatingLists[type] = params.force || false;
					}
				} catch (e) {
					console.log("Failed to find valid type in param argument");
				}
			}
		}
		if (updatingLists[Object.keys(updatingLists)[0]] || !self.XBMC.mediaList[Object.keys(updatingLists)[0]]) {
			try {
				self.XBMC.Get[Object.keys(updatingLists)[0]];
			} catch (e) {
				consolelog("Finished loading media lists from XBMC...")
				QueueInitMsg("finishing loading media lists from xbmc...");
			}
		}
	};

	//obj = {type: string, force: boolean, list: array}
	self.loadXBMCList = function(obj) {
		// check to make sure obj.type has been passed
		if (typeof obj == "object" && obj.hasOwnProperty("type")) {
			updatingLists.push(obj.type); // used to signal that one or more media lists are being updated
			consolelog("Pushing '" + obj.type + "' to updatingLists[] New length = " + updatingLists.length);
			updateStatus();

			try {
				if (obj.hasOwnProperty("force")) throw "Forcing " + obj.type + " list update from XBMC";

				//decoded = JSON.parse(tokens["[XBMC_"+obj.type[0].toUpperCase() + obj.type.slice(1) + "]"]);
				decoded = JSON.parse(obj.list);
				// tokens passed && valid JSON string
				// load existing list
				consolelog("Loading cached " + obj.type + " list...");

				self.XBMC.QueueInitMsg("loading cached list of " + obj.type + "...");
				self.XBMC.SetListArray(obj.type, decoded);

				// Completing loading list from cache
				updatingLists.shift();
				consolelog("Shifting off element from updatingLists[]. New length = " + updatingLists.length);
				updateStatus();
			} catch (e) {
				// invalid JSON string
				var type;
				if ( (type = self.XBMC.in_array(obj.type, self.XBMC.mediaListTypes)) ) {
					// check if not first load by checking guiComplete (only want cached version if not connected)
					//if ( !(guiComplete) && self.XBMC.joins.connected.value == 0 )
					consolelog("XBMC connected.value = " + self.XBMC.joins.connected.value);
					if ( self.XBMC.joins.connected.value == 0 ) {
						consolelog("Skipping update of " + obj.type + " list from XBMC...");
						self.XBMC.SetListArray(type); // mark list as loadeds
						updatingLists.shift(); // clear item from update list
					} else {
						// load list from XBMC
						consolelog("Loading new " + obj.type + " list from XBMC...");
						self.XBMC.Get[obj.type.toLowerCase()]();
					}
				}
				/*
				switch(obj.type.toLowerCase()) {
					case "movies":
					case "tvshows":
					case "seasons":"
					case "episodes":
					case "artists":
					case "episodes":
					case "songs":
						// check if not first load by checking guiComplete (only want cached version if not connected)
						if ( !(guiComplete) && self.XBMC.joins.connected.join == 0 ) {
							updatingLists.shift(); // clear item from update list
							break;
						}
						// load list from XBMC
						consolelog("Loading new " + obj.type + " list from XBMC...");
						self.XBMC.get[obj.type.toLowerCase()]();
						break;
					case "movies":
						self.XBMC.getMovies();
						break;
					case "tvshows":
						self.XBMC.getTVShows();
						break;
					//case "music":
					case "artists":
						self.XBMC.getMusicArtists();
						break;
				}
				*/
			}
		}
	};

	self.configureVolume = function(obj) {
		// check passed object is valid (as much as possible...)
		//self.volumeDevice = (typeof self.volumeDevice == "object" && typeof obj.query == "function") ? obj : null;

		try {
			self.volumeDevice = obj;
			self.volumeDevice.query("VOLUME");
		} catch (e) {
			consolelog("Invalid external volume device set (typeof self.volumeDevice = " + (typeof self.volumeDevice) + ", self.volumeDevice = " + self.volumeDevice + ", (self.volumeDevice === null) = " + (self.volumeDevice === null) + " - " + e);
			self.volumeDevice = null;
		}
	};

	self.toggleMenu = function(force) {
		switch(force.toLowerCase()) {
			case "open":
			case "on":
				CF.setJoin("d"+self.joins.yatse.sidemenu.subpage, 1);
				break;
			case "close":
			case "off":
				CF.setJoin("d"+self.joins.yatse.sidemenu.subpage, 0);
				break;
			default:
				CF.getJoin("d"+self.joins.yatse.sidemenu.subpage, function(j, v, t) {
					CF.setJoin("d"+self.joins.yatse.sidemenu.subpage, (v === 1) ? 0 : 1);
				});
		}
	};

	self.setPage = function(page) {
		page = (typeof page == "string") ? page.toLowerCase() : undefined;
		switch(page.toLowerCase()) {
			case "movies":
			case "tvshows":
			case "seasons":
			case "episodes":
			case "artists":
			case "albums":
			case "songs":
				// TODO: group all movies/tvshows/artists/etc into one case block
				self.loadXBMCList({type: page}); // need to fix so this does not need executing, should automatically be called if the movie list has not been pre-loaded
				self.buildWall(page);
				self.setPage("wall");
				self.currentList = page;
				break;
			case "livetv":
			case "tvguide":
				// remote this case once the tvguide has been moved to a yatse subpage instead of a main page
				CF.setJoins([
					{join: "d"+self.joins.tvguide, value: 1},
				]);
				break;
			case "wall":
			case "remote":
			case "tvguide":
			case "livetv":
				CF.setJoins([
					{join: "d"+self.joins.yatse.wall, value: (page == "wall") ? 1 : 0},
					{join: "d"+self.joins.yatse.controls, value: (page == "remote") ? 1 : 0},
					{join: "d"+self.joins.yatse.tvguide, value: (page == "tvguide" || page == "livetv") ? 1 : 0},
				]);
				break;
		}
	};

	self.catchGesture = function(gesture) {
		consolelog("gesture.direction = " + gesture.direction + ", startx = " + gesture.startx);
		switch(gesture.type) {
			case "swipe":
			try {
			switch( gesture.direction ) {
				case "right":
					if (gesture.startx <= 10) CF.setJoin("d"+self.joins.yatse.sidemenu.subpage, 1);
					else {
					CF.getJoins(["d"+self.joins.yatse.wall, "d"+self.joins.yatse.tvguide], function(joins) {
						console.log(joins);
						// show the controls page
						if (joins["d"+self.joins.yatse.wall].value == "1") self.setPage("remote");
						// show the media wall
						else if (joins["d"+self.joins.yatse.tvguide].value == "1") self.setPage("wall");
					});
					}
					break;
				case "left":
					CF.getJoins(["d"+self.joins.yatse.wall, "d"+self.joins.yatse.controls], function(joins) {
						// show the tv guide
						console.log(joins);
						if (joins["d"+self.joins.yatse.wall].value == "1") self.setPage("tvguide");
						// show the media wall
						else if (joins["d"+self.joins.yatse.controls].value == "1") self.setPage("wall");
					});
					break;
			}
			} catch (e) {
				console.log("Exception caught in catchGesture() - " + e);
			}
			break;
		}
	};

	self.buildWall = function(type) {
		arr = [];
		if ( (type = self.XBMC.in_array(type, self.XBMC.mediaListTypes)) ) {
			try{
				consolelog("Building the " + type + " wall...");
				arr = self.XBMC.GetListArray(type);
				//console.log(arr);
				consolelog("arr.length = " + arr.length);
			} catch (e) {
				consolelog("Exception caught in self.buildWall(" + type + ") - " + e);
			}
		}
		/*
		switch(type.toLowerCase()) {
			case "movies":
			case "tvshows":
			case "seasons":
			case "episodes":
			case "artists":
			case "albums":
			case "songs":
			//case "playlists": // TODO
			case self.XBMC.ids.movies:
			case self.XBMC.ids.tvshows:
			case self.XBMC.ids.seasons:
			case self.XBMC.ids.episodes:
			case self.XBMC.ids.artists:
			case self.XBMC.ids.albums:
			case self.XBMC.ids.songs:
				try{
					consolelog("Building the " + type + " wall...");
					arr = self.XBMC.GetListArray(type);
					//console.log(arr);
					consolelog("arr.length = " + arr.length);
				} catch (e) {
					consolelog("Exception caught in self.buildWall(" + type + ") - " + e);
				}
				break;
		}
		*/

		if ( arr.length > 0 ) {
			// clear previous wall list
			//CF.setJoins([
			//	{join: "l"+self.joins.mediaList, value: "0x"},			// TV/Movie/Music Wall list
			//]);
			consolelog("Adding array of " + type + " to list l"+self.joins.mediaList);
			CF.listRemove("l"+self.joins.mediaList);
			CF.listRemove("l"+self.joins.yatse.mediaList);
			/*
			CF.setJoins([
				{ join: "d"+self.joins.nowPlaying.subpage, value: 0 },
				{ join: "d"+self.joins.mediaList, value: 1 },
			]);
			*/
			CF.listAdd("l"+self.joins.mediaList, arr);
			CF.listAdd("l"+self.joins.yatse.mediaList, arr);
		}
	};

	self.buildNowPlaying = function(id, json) {
		try {
			// Response for playing media: {"id":"1","jsonrpc":"2.0","result":[{"player.id":0,"type":"audio"}]}
			// Response for no media playing: {"id":"1","jsonrpc":"2.0","result":[]}

			if (json.result.length === null || json.result.length == 0 ) {
				//CF.setJoin("d"+self.joins.mediaList, 1);		// Show Item Wall subpage
				//CF.setJoin("d"+self.joins.nowPlaying.subpage, 0);	// Hide Now Playing subpage
				self.XBMC.player.id = null;
				self.player.speed = 0;
			} else {
				self.XBMC.player.id = json.result[0].type;
				//Get the latest details
				//self.XBMC.getVideoPlayerStatus();		// Set feedback status on Play/Pause button
				self.XBMC.GetNowPlayingItem();			// Set all the latest info and start timer
			}

			startNowPlayingLoop();		 // Check player status and report feedback according to specified interval.
		} catch (e) {
			console.log("Exception caught in buildNowPlaying - " + e);
		}
	};

	/**
	 * Function: Build a list of Movies from XBMC JSON response data
	 * @Param {integer} ID of the Movie from the XBMC database

	self.updateMoviesArray = function(json) {
		try {
			self.XBMC.resetListArray("movies"); // clear existing movie array

			itemCount = 0;
			rowCount = 0;
			rowItems = {};
			//rowItems[rowCount] = {};
			//rowItems = [];
			for (var i = 0; i < json.result.limits.total; i++) {
				if (itemCount == 9) {
					itemCount = 0;
					rowCount++;
					//rowItems[rowCount] = {};
					//consolelog("Pushing filled rowItems to MoviesArray...");
					//console.log(rowItems);
					//consolelog("\n");

					self.XBMC.pushListArray("movies", rowItems);
					rowItems = {}; // reset horizontal row list
				}

				var movieID = json.result.movies[i].movieid;
				var file = decode_utf8(json.result.movies[i].file);
				var thumbnail = cleanImage(json.result.movies[i].thumbnail);
				//thumb = new Image();
				//thumb.src = cleanImage(json.result.movies[i].thumbnail);
				var fanart = ( "fanart" in json.result.movies[i] ) ? cleanImage(json.result.movies[i].fanart) : null;
				var label = decode_utf8(json.result.movies[i].label);
				var playcount = json.result.movies[i].playcount;
				var year = json.result.movies[i].year.toString();
				//var genre = decode_utf8(json.result.movies[i].genre);
				//var mpaa = json.result.movies[i].mpaa;
				//var rating = json.result.movies[i].rating;
				//var runtime = json.result.movies[i].runtime;

				//var sortlabel;
				//if(this.method == "label"){
				//	sortlabel = "All Movies";
				//} else if(method == "mpaarating"){
				//	sortlabel = mpaa;
				//} else if (method == "videorating"){
				//	sortlabel = rating.toFixed(2);
				//} else if (method == "videoruntime"){
				//	sortlabel = runtime + " min";
				//}else if (method == "year"){
				//	sortlabel = year;
				//}

				rowItems["d"+(self.joins.firstWatched+itemCount)]	= (playcount > 0) ? 1 : 0;
				rowItems["s"+(self.joins.firstTitle+itemCount)]		= label;
				rowItems["s"+(self.joins.firstYear+itemCount)]		= year;
				rowItems["s"+(self.joins.firstThumbnail+itemCount)]	= thumbnail;
				rowItems["d"+(self.joins.firstThumbnail+itemCount)]	= { // button for selecting item
					value: 0,
					tokens: {
						"[id]": movieID,
						"[file]": file,
						"[fanart]": fanart,
						"[type]": "video",
					}
				};

				itemCount++;
			}
			self.XBMC.pushListArray("movies", rowItems);

			//consolelog("Attempting to set [XBMC_Movies] to = " + JSON.stringify(self.XBMC.GetListArray("movies")));
			try {
				CF.setToken(CF.GlobalTokensJoin, "[XBMC_Movies]", JSON.stringify(self.XBMC.GetListArray("movies")));

				CF.getJoin(CF.GlobalTokensJoin, function(j, v, t) {
					//consolelog("[XBMC_Movies] set to = " + t["[XBMC_Movies]"]);
					consolelog("JSON.parse([XBMC_Movies]) = --v");
					console.log(JSON.parse(t["[XBMC_Movies]"]));
				});
			} catch (e) {
				consolelog("Exception caught in XBMC_GUI.UpdateMoviesArray() - " + e);
			}

			// Completed loading a media list
			updatingLists.shift();  // clear one of the update signals
			console.log("Shifting off element from updatingLists[]. New length = " + updatingLists.length);
			updateStatus();

		} catch (e) {
			CF.log("Exception caught in updateMoviesArray - " + e);
		}

	};
	*/

	self.updateMediaArray = function(json) {
		var token;
		consolelog("XBMC_GUI.updateMediaArray() json.id = " + json.id);
		try {
			if ( (token = self.XBMC.in_array(json.id, self.XBMC.mediaListTypes)) ) {
				consolelog("global token for media list = " + token);
			} else throw "Incorrect id passed...";

			/*
			switch(json.id) {
				case self.XBMC.ids.movies:
					//token = "Movies";
					//break;
				case self.XBMC.ids.tvshows:
				case self.XBMC.ids.seasons:
				case self.XBMC.ids.episodes:
					//token = "TVShows";
					//break;
				case self.XBMC.ids.artists:
				case self.XBMC.ids.albums:
				case self.XBMC.ids.songs:
					//token = "Artists";
					//break;
					token = json.id.substr(16);
					break;
				default:
					throw "Incorrect id passed...";
			}
			*/


			//self.XBMC.resetListArray(json.id); // clear existing media array - no longer needed as building complete list first before pushing to Controller_XBMC array

			var itemCount = 0;
			var rowCount = 0;
			var list = [];
			var rowItems = {};
			var child = null;
			var parent = null;
			var maxPerRow = 9;
			delete artistid;
			delete albumid;
			delete tvshowid;
			delete season;
			consolelog("updating Media array for " + token);
			console.log(json);

			var padRow = function() {

				//if (itemCount < 9 && json.result.limits.total > 0 && rowItems.length > 0 ) {
				// 9 items per row, only pad if the row isnt empty
				if (itemCount < 9 && rowItems.length > 0 ) {
					// hide/clear remaining items in row
					t = {
						"[id]": "",
						"[type]": "",
					};
					while (itemCount < maxPerRow) {
						rowItems["d"+(self.joins.firstWatched+itemCount)]	= 0;
						rowItems["s"+(self.joins.firstTitle+itemCount)]		= "";
						rowItems["s"+(self.joins.firstYear+itemCount)]		= "";
						rowItems["s"+(self.joins.firstThumbnail+itemCount)]	= "";
						rowItems["d"+(self.joins.firstThumbnail+itemCount)]	= { // button for selecting item
							value: 0,
							tokens: t,
						};
						itemCount++;
					}

					// add last row to arry
					if (child === null) list.push(rowItems);
					else if (parent === null) list[child].push(rowItems);
					else list[parent][child].push(rowItems);

					//list[albumid/artistd/etc] = rowItems
				}
			};

			for (var i = 0; i < json.result.limits.total; i++) {
				if (itemCount == maxPerRow) {
					itemCount = 0;
					rowCount++;

					if (child === null) list.push(rowItems);
					else if (parent === null) list[child].push(rowItems);
					else list[parent][child].push(rowItems);

					rowItems = {}; // reset horizontal row list
				}

				switch(json.id) {
					case self.XBMC.ids.movies:
						// "thumbnail", "fanart", "genre", "playcount", "mpaa", "rating", "runtime", "year", "file", "resume"
						var id = json.result.movies[i].movieid;
						var thumbnail = json.result.movies[i].thumbnail;
						var major = json.result.movies[i].label;
						var minor = json.result.movies[i].year;
						//var fanart = ( "fanart" in json.result.movies[i] ) ? json.result.movies[i].fanart : null;
						//var playcount = "Playcount: " + ((json.result.movies[i].playcount > 999) ? "HEAPS!" : json.result.movies[i].playcount);
						//var file = json.result.movies[i].file;
						var type = "movie";
						break;

					case self.XBMC.ids.tvshows:
						// result["thumbnail", "fanart", "title|label", "year", "season", "episode", "art.fanart|poster", "file", "playcount", "watchedepisodes"]
						var id = json.result.tvshows[i].tvshowid;
						var thumbnail = json.result.tvshows[i].thumbnail;
						var major = json.result.tvshows[i].title;
						var minor = json.result.tvshows[i].year;
						//var fanart = ( "fanart" in json.result.tvshows[i] ) ? json.result.tvshows[i].fanart : null;
						var playcount = (json.result.tvshows[i].watchedepisodes == json.result.tvshows[i].episode) ? 1 : 0;
						//var file = null;
						var type = "tvshow";
						break;
					case self.XBMC.ids.seasons:
						if ( child != json.result.seasons[i].tvshowid ) {
							child = json.result.seasons[i].tvshowid;
							padRow();
						}
						// "season", "tvshowid", "showtitle", "title", "year", "playcount", "episode", "thumbnail", "file", "art", "watchedepisodes"
						var id = json.result.seasons[i].season; // json.result.id
						var thumbnail = json.result.seasons[i].thumbnail;
						var major = json.result.seasons[i].title;
						var minor = json.result.seasons[i].year;
						//var fanart = null;
						var playcount = (json.result.seasons[i].watchedepisodes == json.result.seasons[i].episode) ? 1 : 0;
						//var file = null;
						var type = "season";
						if ( !(rowItems.hasOwnProperty("tvshowid")) ) rowItems["tvshowid"] = json.result.seasons[i].tvshowid;
						break;
					case self.XBMC.ids.episodes:


						// SEASON ID NEED CHECKING!! OR SOMEWAY TO GROUP ARRAY INTO SEASONS!!


						if ( child != json.result.episodes[i].season ) {
							child = json.result.episodes[i].season;
							parent = json.result.episodes[i].tvshowid;
							padRow();
						}
						// "episodeid", "season", "tvshowid", "thumbnail", "showtitle", "firstaired", "episode", "resume", "file", "title", "playcount", "art"
						var id = json.result.episodes[i].episodeid;
						var thumbnail = json.result.episodes[i].thumbnail;
						var major = json.result.episodes[i].episode + ". " + json.result.episodes[i].showtitle;
						var minor = json.result.episodes[i].firstaired;
						//var fanart = ( "fanart" in json.result.episodes[i] ) ? json.result.episodes[i].fanart : null;
						var playcount = json.result.episodes[i].playcount;
						//var file = json.result.episodes[i].file;
						var type = "episode";
						if ( !(rowItems.hasOwnProperty("tvshowid")) ) rowItems["tvshowid"] = json.result.episodes[i].tvshowid;
						if ( !(rowItems.hasOwnProperty("season")) ) rowItems["season"] = json.result.episodes[i].season;
						break;

					case self.XBMC.ids.artists:
						// "artist", "artistid", "thumbnail", "fanart", "formed", "playcount"
						var id = json.result.artists[i].artistid;
						var thumbnail = json.result.artists[i].thumbnail;
						var major = json.result.artists[i].artist;
						var minor = json.result.artists[i].formed;
						//var fanart = ( "fanart" in json.result.artists[i]) ? json.result.artists[i].fanart : null;
						var playcount = json.result.artists[i].playcount;
						//var file = null;
						var type = "artist";
						break;
					case self.XBMC.ids.albums:
						if ( child != json.result.albums[i].artistid ) {
							child = json.result.albums[i].artistid;
							padRow();
						}
						// "artistid", "albumartistid", "albumid", "thumbnail", "title", "fanart", "year", "playcount"
						var id = json.result.albums[i].albumid;
						var thumbnail = json.result.albums[i].thumbnail;
						var major = json.result.albums[i].title;
						var minor = json.result.albums[i].year;
						var playcount = json.result.albums[i].playcount;
						//var fanart = null;
						//var file = null;
						var type = "album";
						if ( !(rowItems.hasOwnProperty("artistid")) ) rowItems["artistid"] = json.result.albums[i].artistid; // var albumid = json.result.albums[i].albumartistid;
						break;
					case self.XBMC.ids.songs:
						if ( child != json.result.songs[i].albumid ) {
							child = json.result.songs[i].albumid;
							parent = json.result.songs[i].artistid;
							padRow();
						}
						// "thumbnail", "title", "track", "file", "albumartistid", "albumid", "songid", "playcount"
						var id = json.result.songs[i].songid;
						var thumbnail = json.result.songs[i].thumbnail;
						var major = json.result.songs[i].track + ". " + json.result.songs[i].title;
						var minor = "Playcount: " + ((json.result.songs[i].playcount > 999) ? "HEAPS!" : json.result.songs[i].playcount);
						var playcount = json.result.songs[i].playcount;
						//var file = json.result.songs[i].file;
						//var fanart = null;
						var type = "song";
						if ( !(rowItems.hasOwnProperty("artistid")) ) rowItems["artistid"] = json.result.songs[i].artistid; // var albumid = json.result.albums[i].albumartistid;
						if ( !(rowItems.hasOwnProperty("albumid")) ) rowItems["albumid"] = json.result.songs[i].albumid;
						break;
				}

				t = {
					"[id]": id,
					//"[file]": decode_utf8(file),
					//"[fanart]": cleanImage(fanart),
					"[type]": type,
				};

				rowItems["d"+(self.joins.firstWatched+itemCount)]	= (playcount > 0) ? 1 : 0;
				rowItems["s"+(self.joins.firstTitle+itemCount)]		= decode_utf8(major);
				rowItems["s"+(self.joins.firstYear+itemCount)]		= decode_utf8((typeof minor == "number") ? minor.toString() : minor);
				rowItems["s"+(self.joins.firstThumbnail+itemCount)]	= cleanImage(thumbnail);
				rowItems["d"+(self.joins.firstThumbnail+itemCount)]	= { // button for selecting item
					value: 0,
					tokens: t
				};


				itemCount++;
			}

			padRow();
			consolelog("Created list for " + tokens);
			console.log(list);
			self.XBMC.SetListArray(json.id, list);

			//consolelog("Attempting to set [XBMC_Movies] to = " + JSON.stringify(self.XBMC.GetListArray("movies")));

			//CF.setToken(CF.GlobalTokensJoin, "[XBMC_" + token + "]", JSON.stringify(self.XBMC.GetListArray(json.id)));
			CF.setToken(CF.GlobalTokensJoin, "[" + token + "]", JSON.stringify(list));

			CF.getJoin(CF.GlobalTokensJoin, function(j, v, t) {
				try {
					consolelog("t[" + token + "] = --v");
					console.log(t["[" + token + "]"]);
					consolelog("JSON.parse(t[" + token + "]) = --v");
					console.log(JSON.parse(t["[" + token + "]"]));
				} catch (e) {
					consolelog("Exception caught setting token In XBMC_GUI.UpdateMediaArray() - " + e);
				}
			});


			// Completed loading a media list
			updatingLists.shift();  // clear one of the update signals
			console.log("Shifting off element from updatingLists[]. New length = " + updatingLists.length);
			updateStatus();

		} catch (e) {
			consolelog("Exception caught in XBMC_GUI.updateMediaArray - " + e);
			console.log(e);
		}

	};

	self.playItem = function(list, listIndex, join, tokens) {
		// Play the selected item. Clear the previous items on playlist and add current item to playlist.
		self.XBMC.ClearPlaylists();	// Clear the playlist of previous items

		if (list != "") {
			// select item (from button press/click)
			self.XBMC.selectedItem.id = tokens["[id]"];
			self.XBMC.selectedItem.type = tokens["[type]"];
			//self.XBMC.selectedItem.player = null; // reset just in case...
		}
		self.XBMC.selectedItem.resume = false;

		playSelectedItem = true;
		self.XBMC.GetSelectedMediaDetails();
	};

	self.resumeItem = function(list, listIndex, join, tokens) {
		// Play the selected item. Clear the previous items on playlist and add current item to playlist.
		self.XBMC.ClearPlaylists();	// Clear the playlist of previous items

		if (list != "") {
			// select item (from button press/click)
			self.XBMC.selectedItem.id = tokens["[id]"];
			self.XBMC.selectedItem.type = tokens["[type]"];
			//self.XBMC.selectedItem.player = null; // reset just in case...
		}
		self.XBMC.selectedItem.resume = true;

		playSelectedItem = true;
		self.XBMC.GetSelectedMediaDetails();
	};

	self.selectItem = function(list, listIndex, join, tokens) {
		self.XBMC.selectedItem.id = tokens["[id]"];
		self.XBMC.selectedItem.type = tokens["[type]"];

		// activate the topbar
		self.toggleTopbar(1);
	};

	self.viewItem = function(list, listIndex, join, tokens) { // update GUI to include list, listIndex, join, tokens

	};

	self.getVolume = function() {
		console.log(self.volumeDevice);
		try {
			// use external device for volume control (ie: AV Receiver)
			self.volumeDevice.query("VOLUME");
		} catch (e) {
			// use XBMC for volume control
			consolelog("XBMC_GUI.getVolume(): External volume device not setup - using XBMC for volume control. - " + e);
			self.XBMC.GetVolume(self.joins.volume.level);
		}
	}

	// vol = [ 0 <= 100 ]
	self.setVolume = function(vol) {
		try {
			// use external device for volume control (ie: AV Receiver)
			self.volumeDevice.action("VOLUME", vol);
		} catch (e) {
			// use XBMC for volume control
			self.XBMC.SetVolume(vol);
		}
	}

	self.toggleTopBar = function(val) {
		CF.getJoin("d"+self.joins.yatse.topbar.subpage, function(j, v, t) {
			valid = [0, 1];
			if ( ! (val in valid) ) val = (v == 1) ? 0 : 1;
			CF.setJoins("d"+self.joins.yatse.topbar.subpage, val);
		});
	};

	self.WakeUp = function() {
		// get mac details from join strings (user editable via input text boxes)
		CF.getJoins(["s"+self.XBMC.config.mac.join, "s"+self.XBMC.config.mysqlmac.join], function(joins) {
			for (var prop in joins ) {
				if (joins[prop].hasOwnProperty("value") && typeof joins[prop].value == "string" )  WOL(joins[prop].value);
			}
			//if (typeof joins["s"+self.XBMC.config.mac.join].value == "string") WOL(joins["s"+self.XBMC.config.mac.join].value);
			//if (typeof joins["s"+self.XBMC.config.mysqlmac.join].value == "string") WOL(joins["s"+self.XBMC.config.mysqlmac.join].value);
		});
	};

	/*
	function parseJSONBuffer() {
		if (self.XBMC.jsonBuffer.length > 0 ) {
			consolelog("Processing JSON buffer...");
			switch (self.XBMC.jsonBuffer[0]){
				case "{":
					self.XBMC.jsonBraceCount++;
					self.XBMC.jsonValid = true;
					break;
				case "}":
					self.XBMC.jsonBraceCount--;
					break;
			}
			if (self.XBMC.jsonValid === true) self.XBMC.jsonString += self.XBMC.jsonBuffer[0]; // add character to buffer, skips any garbage at beginning of response

			if (self.XBMC.jsonValid === true && self.XBMC.jsonBraceCount == 0) {
				consolelog("FOUND VALID JSON STRING!!");
				try {
					var decoded = JSON.parse(self.XBMC.jsonBuffer);
					consolelog("JSON string parsed successfully!");
					if (decoded !== null) {
						consolelog("Send JSON object too jsonCallback()");
						jsonCallback(decoded); // send to json callback function
					} else {
						consolelog("Failed to parse JSON string :(\ndecoded = " + decoded);
					}
				} catch(e) {
					consolelog("JSON.parse() failed - " + e);
				} finally {
					// now reset buffer and and start again...

					self.XBMC.jsonValid = false;
					self.XBMC.jsonString = "";
					self.XBMC.jsonBraceCount = 0;
					self.XBMC.jsonWaitResponse = false;
					self.XBMC.runJSON();
				}


			}

			self.XBMC.jsonBuffer = self.XBMC.jsonBuffer.substr(1);
			self.parseJSONBuffer();
		}
	}
	*/

	// --- Private Functions --- //

	function onJSONResponse(feedbackItem, matchedString) {
		//consolelog("json feeback received...\n " + matchedString);
		try {
			for (i = 0; i < matchedString.length; i++) {
				Switch1:
				switch (matchedString[i]){
					case "{":
						self.XBMC.jsonBraceCount++;
						valid = true;
						break Switch1;
					case "}":
						self.XBMC.jsonBraceCount--;
						break Switch1;
				}

				if (valid == true) self.XBMC.jsonBuffer += matchedString[i]; // add character to buffer

				if (valid != undefined && self.XBMC.jsonBraceCount == 0) {
					// complete JSON response - should parse correctly
					//consolelog("Found completed JSON response -> " + self.XBMC.jsonBuffer + "");
					var decoded = JSON.parse(self.XBMC.jsonBuffer);
					valid = undefined;
					delete valid;
					self.XBMC.jsonBuffer = "";
					self.XBMC.jsonBraceCount = 0;
					consolelog(decoded)
					if (decoded !== null) {
						consolelog("sending decoded js jsonCallback");
						jsonCallback(decoded); // send to json callback function
					} else {
						consolelog("Failed to parse JSON string :(");
					}

					// now reset buffer and and start again...

				}
			}
		} catch(e) {
			consolelog("Exception caught while processing onJSONResponse():\n" + e + "\nJSON string => \n" + matchedString);
		}
	}


	function jsonCallback(json) {
		// use the decoded data here
		//CFlogObject(json);
		console.log(json);

		//consolelog("JSON Response from id = '" + json.id + "', method = '" + json.method + "' ->\n" + JSON.stringify(json));

		// Perform REGEX to find response type (movies, video, audio, etc) - TODO!!
		try {
			consolelog("XBMC Feedback JSON id = " + (json.id || null));
		} catch (e) {
			consolelog("|| operator didnt work detector json.id :(");
		}
		//if ( !json.hasOwnProperty("id") ) json.id = null;
		switch ( json.id || null ) {
			case self.XBMC.ids.movies:
			case self.XBMC.ids.tvshows:
			case self.XBMC.ids.seasons:
			case self.XBMC.ids.episodes:
			case self.XBMC.ids.artists:
			case self.XBMC.ids.albums:
			case self.XBMC.ids.songs:
				self.updateMediaArray(json);
				break;
			/*
			case self.XBMC.ids.movies:
				self.updateMoviesArray(json);
				break;
			case self.XBMC.ids.tvshows:
				self.updateTVShowsArray(json);
				break;
			case self.XBMC.ids.artists:
				self.updateMusicArray(json);
				break;
			*/
			case self.joins.mediaList:
				//self.XBMC.buildMovies(self.joinMovies, json);
				// Update the wall list
				break;
			case self.joins.volume.level:
				if ( (typeof self.volumeDevice) === null ) { // if XBMC is used to control the volume, guards against XBMC sending volume updates to external device
					// Update the volume level
					vol = ( typeof json.result == "object" ) ? json.result.volume : json.result; // object returned from Application.GetProperties, integer returned from Application.setVolume
					CF.setJoin("a"+self.joins.volume.level, vol);
				}
				break;
			case "Library.GetDetails":
				consolelog("Response from Library.GetDetails =>");
				console.log(json);

				if (playSelectedItem === true) {
					// setup GUI with media info
					self.XBMC.PlayItem();
					playSelectedItem = false;
				}
				break;
			case "Player.GetActivePlayers":
				console.log(json);
				self.XBMC.player.id = (json.result.length > 0) ? json.result[0].playerid : null;

				// now update the properties of the player
				// sends Player.GetProperties
				if ( !(self.XBMC.UpdatePlayer()) ) stopNowPlayingLoop(); // stops loop in no active players
				//else if (!(guiComplete)) CF.setJoin("s"+self.joins.init, "getting details of active player from xbmc...");
				else if (!(guiComplete)) self.XBMC.QueueInitMsg("getting details of active player from xbmc...");

				break;
			case "Player.GetProperties":
				consolelog("Response from Player.GetProperties =>");
				console.log(json);
				self.XBMC.player.speed = json.result.speed;
				if (json.result.speed == 0) stopNowPlayingLoop(); // player paused

				// preloading init messages
				if (!(guiComplete)) {
					self.XBMC.QueueInitMsg("syncing subtitle status with xbmc...");
					self.XBMC.QueueInitMsg("syncing shuffle status with xbmc...");
					self.XBMC.QueueInitMsg("syncing connection status with xbmc...");
				}

				updateStatus(); // update the connection status icon colour

				if ( !(disableProgressUpdates) ) CF.setJoin("a"+self.joins.progress, (json.result.percentage/100) * 65535);

				CF.setJoins([
					{	join:		"s"+self.joins.subtitles,
						value: 		("overlays\\subtitles_" + json.result.subtitleenabled + ".png"),
						tokens:		{"[subtitle]": json.result.subtitleenabled}
					},
					{	join:		"s"+self.joins.shuffle,
						value: 		("overlays\\shuffle_" + json.result.shuffled + ".png"),
						tokens:		{"[shuffle]": json.result.shuffled}
					},
					{	join: 		"s"+self.joins.repeat,
						value: 		("overlays\\repeat_" + json.result.repeat.toLowerCase() + ".png"),
						tokens:		{"[repeat]": json.result.repeat.toLowerCase()}
					},
					{	join:		"d"+self.joins.subtitles,
						tokens:		{"[subtitle]": json.result.subtitleenabled}
					},
					{	join:		"d"+self.joins.shuffle,
						tokens:		{"[shuffle]": json.result.shuffled}
					},
					{	join: 		"d"+self.joins.repeat,
						tokens:		{"[repeat]": json.result.repeat.toLowerCase()}
					},
				], false); // dont sent join change event


				// now update the details of the item
				self.XBMC.GetNowPlayingItem();

				// no break here
			case "Player.Seek":
				if (json.id == "Player.Seek") {
					// remove when finished testing
					consolelog("Response from Player.GetProperties =>");
					console.log(json);
				}
				time = ("0"+json.result.time.hours).slice(-2) +
					":" +
					("0"+json.result.time.minutes).slice(-2) +
					":" +
					("0"+json.result.time.seconds).slice(-2) +
					" / " +
					("0"+json.result.totaltime.hours).slice(-2) +
					":" +
					("0"+json.result.totaltime.minutes).slice(-2) +
					":" +
					("0"+json.result.totaltime.seconds).slice(-2);
				CF.setJoin("s"+self.joins.yatse.player_time, time);

				break;
			case "Player.GetItem":
				consolelog("Response from Player.GetItem =>");
				console.log(json);
				//type = movie
				//json.result.item.fanart
				//json.result.item.label = title
				//json.result.item.thumbnail
				//json.result.item.year
				//json.result.item.playcount
				//json.result.item.mpaa
				//json.result.item.runtime
				//json.result.item.resume

				//type = episode
				//json.result.item.

				//type = song
				//json.result.item.
				//json.result.item.album: "The Misery Index: Notes From The Plague Years"
				//json.result.item.artist[0]: "Boysetsfire"
				//json.result.item.fanart: "image://http%3a%2f%2fwww.theaudiodb.com%2fimages%2fmedia%2fartist%2ffanart%2fqsvpyp1358673826.jpg/"
				//json.result.item.file: "smb://PVR-BOX/MUSIC/Boysetsfire/The Misery Index Notes From The Plague Years/08-So Long...Thanks For The Crutches.mp3"
				//json.result.item.id: 67647
				//json.result.item.label: "So Long...Thanks for the Crutches"
				//json.result.item.thumbnail: "image://smb%3a%2f%2fPVR-BOX%2fMUSIC%2fBoysetsfire%2fThe%20Misery%20Index%20Notes%20From%20The%20Plague%20Years%2fFolder.jpg/"
				//json.result.item.title: "So Long...Thanks for the Crutches"
				//json.result.item.track: 8
				//json.result.item.type: "song"
				//json.result.item.year: 2006

				// preloading init messages
				if (!(guiComplete)) {
					self.XBMC.QueueInitMsg("downloading xbmc fanart...");
					self.XBMC.QueueInitMsg("downloading xbmc thumbnail...");
					self.XBMC.QueueInitMsg("getting media information from xbmc...");
				}

				json.result.item.fanart = cleanImage(json.result.item.fanart);
				json.result.item.thumbnail = cleanImage(json.result.item.thumbnail);

				joinArray = new Array();
				switch(json.result.item.type) {
					case "movie":
						json.np_info_one = json.result.item.title;  // check 'title' works (previously used 'label')
						json.np_info_two = json.result.item.year;
						json.np_info_three = "";
						json.np_primary = json.np_info_one;
						json.np_secondary = json.np_info_two;
						break;
					case "episode":
						json.np_info_one = json.result.item.showtitle;
						json.np_info_two = "Season #" + json.result.item.season;
						json.np_info_three = json.result.item.episode + ". " + json.result.item.title;
						json.np_primary = json.result.item.title;
						json.np_secondary = json.np_info_two;
						break;
					case "song":
						json.np_info_one = json.result.item.artist[0];
						json.np_info_two = json.result.item.album;
						json.np_info_three = json.result.item.track + ". " + json.result.item.title;
						json.np_primary = json.result.item.title;
						json.np_secondary = json.result.item.artist[0];
						break;
				}
				if (self.joins.yatse.np_info_one.value != json.np_info_one) {
					consolelog("json.np_info_one != self.np_info_one => adding join to be updated...");
					joinArray.push("s"+self.joins.yatse.np_info_one.join);
					self.joins.yatse.np_info_one.value = json.np_info_one || null;
				}

				if (json.result.item.fanart != self.joins.yatse.fanart.url) {
					consolelog("json.fanart != self.fanart => adding join to be updated...");
					joinArray.push("s"+self.joins.yatse.fanart.join);
					self.joins.yatse.fanart.url = json.result.item.fanart;
				}

				if (json.result.item.thumbnail != self.joins.yatse.np_thumbnail.url){
					consolelog("json.thumb != self.thumb => adding join to be updated...");
					joinArray.push("s"+self.joins.yatse.np_thumbnail.join);
					self.joins.yatse.np_thumbnail.url = json.result.item.thumbnails;
				}
				consolelog("joinArray.length = "+joinArray.length);

				if ( joinArray.length > 0 ) {
					CF.getProperties(joinArray, function(joins) {
						function build(obj) {
							switch (obj.join) {
								case "s"+self.joins.yatse.np_info_one.join:
									consolelog("Updating now playing info lines...");
									CF.setJoins([
										{join: "s"+self.joins.yatse.np_info_one.join,	value: json.np_info_one},
										{join: "s"+self.joins.yatse.np_info_two,	value: json.np_info_two},
										{join: "s"+self.joins.yatse.np_info_three,	value: json.np_info_three},
										{join: "s"+self.joins.yatse.sidemenu.np_primary_info,	value: json.np_primary},
										{join: "s"+self.joins.yatse.sidemenu.np_secondary_info,	value: json.np_secondary},
									]);
									break;
								case "s"+self.joins.yatse.fanart.join:
									// set fanart, fade out previous if necessary
									CF.setProperties({join: obj.join, opacity: 0}, 0, (obj.opacity > 0) ? 5 : 0, CF.AnimationCurveLinear, function(js) {
										var img = new Image();
										img.src = json.result.item.fanart;
										img.join = js;
										img.onload = function() {
											consolelog("Updating fanart -> this.src = " + this.src + ", this.join = " + this.join);
											CF.setJoin(this.join, this.src);
											CF.setProperties({join: this.join, opacity: 0.15}, 0, 5, CF.AnimationCurveLinear);
										};


										//fanartimg.js = js;
									}, obj.join);
									break;

								case "s"+self.joins.yatse.np_thumbnail.join:
									// set thumbnail, fade out previous if necessary
									CF.setProperties({join: obj.join, opacity: 0}, 0, (obj.opacity > 0) ? 5 : 0, CF.AnimationCurveLinear, function(js) {
										//try {
											CF.setProperties({join: "d"+self.joins.yatse.topbar.resume, opacity: (json.result.item.hasOwnProperty("resume") && json.result.item.resume == true) ? 1 : 0}, 0, 3, CF.AnimationCurveLinear);
										//} catch (e) {
										//	console.log("Resume not supported by the item now playing...");
										//	CF.setProperties({join: "d"+self.joins.yatse.topbar.resume, opacity: 0});
										//}


										var img = new Image();
										img.src = json.result.item.thumbnail;
										img.join = js;
										img.onload = function() {
											ratio = this.width / this.height;
											if ( self.joins.yatse.np_thumbnail.h * ratio > this.w ) {
												// adjust based on height
												this.height = self.joins.yatse.np_thumbnail.h;
												this.width = this.height * ratio;
											} else {
												// adjust based on width
												this.width = self.joins.yatse.np_thumbnail.w;
												this.height = this.width / ratio;

											}
											ypos = self.joins.yatse.np_thumbnail.y + (self.joins.yatse.np_thumbnail.h - this.height) / 2;
											console.log("thumb join = " + this.join);

											CF.setProperties({join: this.join, opacity: 0, w: this.width, h: this.height, y: ypos}, 0, 0, CF.AnimationCurveLinear, function(j, src){
												consolelog("Updating thumbnail -> this.src = " + this.src + ", this.join = " + j);
												CF.setJoins([
													{join: j, value: src},
													{join: "s"+self.joins.yatse.sidemenu.np_thumbnail.join, value: src}
												]);
												CF.setProperties({join: j, opacity: 1}, 0, 2, CF.AnimationCurveLinear, function(){
													if (!(guiComplete)) {
														guiComplete = true;
														//CF.setJoin("s"+self.joins.init, "preparation of of gui complete...");
														self.XBMC.QueueInitMsg("preparation of of gui complete...");
													}
													consolelog("Loop finished.. try to restart loop...\nnowPlayingLoop.enabled = " + nowPlayingLoop.enabled + ", nowPlayingLoop.complete = " + nowPlayingLoop.complete);
													if ( self.XBMC.player.speed != 0 ) startNowPlayingLoop({complete: true});
												});

											}, this.join, this.src);
										};


									}, obj.join);
									break;
							}
						}

						for (var i = 0; i < joins.length; i++ ) build(joins[i]);

					});
				} else {
					if (!(guiComplete)) {
						guiComplete = true;
						//CF.setJoin("s"+self.joins.init, "preparation of of gui complete...");
						self.XBMC.QueueInitMsg("preparation of of gui complete...");
					}

					consolelog("Loop finished.. try to restart loop...\nnowPlayingLoop.enabled = " + nowPlayingLoop.enabled + ", nowPlayingLoop.complete = " + nowPlayingLoop.complete);
					if ( self.XBMC.player.speed != 0 ) startNowPlayingLoop({complete: true});
					//console.log("Requesting re-start of now playing loop...");
				}
				break;
			case undefined:
				// XBMC sent JSON response without request
				console.log(json);
				switch ( json.method || null) {
					case "Player.OnPlay":
						// goto Now Playing Screen?? (screen with transport controls, movie poster, background fanart, progress bar, etc
						consolelog("Player.OnPlay response received...[player.id = " + json.params.data.player.playerid + ", speed = " + json.params.data.player.speed +"]");
						self.XBMC.player.id = json.params.data.player.playerid;
						self.XBMC.player.speed = json.params.data.player.speed;
						self.XBMC.player.item.id = json.params.data.item.id; // may be useful in future?
						//CF.setJoin("d"+self.joins.playing, (self.XBMC.player.speed == 0) ? 0 : 1); // update play/pause button state
						try {
							clearTimeout(OnStopTimeoutID);
							OnStopTimeoutID = null;
						} catch (e) {
							consolelog("There was a problem clearing the OnStopTimeoutID(" + OnStopTimeoutID + ") - " + e);
						};
						//nowPlayingLoop.enabled = true;
						startNowPlayingLoop({enabled: true});
						//updateStatus();
						//CF.setJoin("s"+self.XBMC.joins.connected.join, "http://www.southernelectriq.com.au/commandfusion/raglan/images/yatse_status_green.png"); // connected, playing
						break;
					case "Player.OnPause":
						consolelog("Player.OnPause response received...[player.id = " + json.params.data.player.playerid + ", speed = " + json.params.data.player.speed +"]");
						self.XBMC.player.id = json.params.data.player.playerid;
						self.XBMC.player.speed = json.params.data.player.speed;
						self.XBMC.player.item.id = json.params.data.item.id; // may be useful in future?
						stopNowPlayingLoop();
						break;
					case "Player.OnStop":
						console.log(json);
						consolelog("Received stop notification from XBMC...");
						//stopNowPlayingLoop();

						// wait 3sec before clearing gui incase another item is queued
						OnStopTimeoutID = setTimeout(function() {
							// clear GUI
							resetGUI();
							//nowPlayingLoop.enabled = false;
							stopNowPlayingLoop();
						}, 3000);
						break;
					case "Player.OnPropertyChanged":
						if (json.params.data.property.hasOwnProperty("repeat")) {
							// repeat status changed
							// 3 stage image with button below, grrr
							CF.setJoins([
								{	join:	"s"+self.joins.repeat,
									value:	"overlays\\repeat_" + json.params.data.property.repeat + ".png"	// sync repeat button overlay(image)
								},
								{	join:	"d"+self.joins.repeat,
									tokens: {
											"[repeat]": json.params.data.property.repeat	// set token of repeat state on button join
										}
								},
								{
									join:	"s"+self.joins.player.id,				// may as well update playerid at same time...
									value:	json.params.data.player.playerid
								}
							]);
						}
						break;
				}
				break;
			default:
				console.log(json);
				if ( json.hasOwnProperty("result") ) {
					consolelog("json.result = " + json.result);
					switch(json.result) {
						case "pong":
							// not needed if using connected join?
							CFlog("Ping response received");
							CF.setJoin("d"+self.XBMC.joins.connected.join, 1); // force connected join update
							break;
						default:
							//console.log(json);
							consolelog("typeof result.hasOwnProperty = " + (typeof json.result.hasOwnProperty));
							if ( typeof json.result.hasOwnProperty == "function" && json.result.hasOwnProperty("speed") ) {
								// update player speed and status indicator
								self.XBMC.player.speed = json.result.speed;
								updateStatus();
								//CF.setJoin("s"+self.XBMC.joins.connected.join, "http://www.southernelectriq.com.au/commandfusion/raglan/images/yatse_status_" + ((self.XBMC.player.speed == 0) ? "white" : "green") + ".png"); // connected, idle
								consolelog("Current player speed updated to = " + self.XBMC.player.speed);
							} else {
								CFlog("Nothing required from JSON response in jsonCallback()");
							}
					}
				}
		}
	}

	function init(callback) {

		function syncVolume() {
			// Get volume state on startup
			self.XBMC.QueueInitMsg("syncing xbmc volume...");
			self.getVolume();

			consolelog("All gui data requests. Prematurely starting now playing loop...");
			startNowPlayingLoop({enabled: true});
		}

		function loadMediaLists() {
			//types = ["movies", "tvshows", "artists"];
			self.XBMC.QueueInitMsg("refreshing media lists from xbmc...");
			try {
				for ( var i = 0; i < self.XBMC.mediaListTypes.length; i++ )
					self.loadXBMCList( { type: self.XBMC.mediaListTypes[i] } ); // maybe force refresh of lists from XBMC??
			 } catch (e) {
				 consolelog("Caught exception in loadMediaLists() - " + e);
			 }

			var id = setInterval(function() {
				if (self.XBMC.listsComplete) {
					clearInterval(id);
					id = null;
					delete id;
					syncVolume();
				}
			}, 300);
		}

		//resetGUI();  // not 100% sure if needed here as called again in onStopNowPlaying()

		// Check XBMC connectivity by triggering the loop.
		//nowPlayingLoop.enabled = true;
		//startNowPlayingLoop({enabled: true});

		// start interval to wait for GUI to finish loading
		/*
		listIntervalID = setInterval(function() {
			if (guiComplete) {
				clearInterval(listIntervalID);
				listIntervalID = null;
				// Preload list of movies
				CF.getJoin(CF.GlobalTokensJoin, function(j, v, tokens) {
					for (var key in tokens) {
						if (tokens.hasOwnProperty(key)) {
							switch(key) {
								case "[XBMC_Movies]":
								case "[XBMC_TVShows]":
								case "[XBMC_Artists]":
									//type = key.substring(6, key.length - 1).toLowerCase();
									//consolelog("type = " + type);
									listType = key.substring(6, key.length - 1).toLowerCase();
									self.loadXBMCList( { type: listType, list: tokens[key] } );
									break;
							}
						}
					}
				});
			}
		}, 300);
		*/

		// queue dummy command to test XBMC connection - first queued command may get lost if disconnected at startup
		self.XBMC.QueueInitMsg("testing xbmc connectivity...");
		self.XBMC.Ping();

		// Load persistent data from CF.GlobalTokensJoin
		self.XBMC.QueueInitMsg("loading saved information for xbmc...");

		CF.getJoin(CF.GlobalTokensJoin, function(j, v, tokens) {
			// token to load
			var keys = [];
			keys = ["currentList"];
			keys = keys.concat(self.XBMC.mediaListTypes);
			console.log(keys);
			try {
				//consolelog("keys.length = " + keys.length);
			for ( var i = 0; i < keys.length; i++) {
				consolelog("keys.length = " + keys.length);
				if (self.XBMC.in_array(keys[i], self.XBMC.mediaListTypes)) {
					// load media list
					if (tokens["[" + keys[i] + "]"] != "") {
						// token contains data
						//listType = key.substring(6, key.length - 1).toLowerCase();
						self.loadXBMCList( { type: keys[i], list: tokens["[" + keys[i] + "]"] } );
					}
				// load saved variable as string
				} else if ( typeof tokens["[" + keys[i] + "]"] != "undefined" ) {
					consolelog("Loading saved variabled self." + keys[i] + " = " + tokens["[" + keys[i] + "]"]);
					self[keys[i]] = tokens["[" + keys[i] + "]"]; // save as self.key = token value
				}

				/*
				switch(keys[i]) {
					case "[Movies]":
					case "[TVShows]":
					case "[XBMC_Artists]":
						if (tokens["[" + keys[i] + "]"] != "") {
							// token contains data
							listType = key.substring(6, key.length - 1).toLowerCase();
							self.loadXBMCList( { type: listType, list: tokens[key[i]] } );
						}
						break;
					default:
						// remove braces from token key sets variable in self
						consolelog("Loaded saved variable -> self.['[" + keys[i] + "]'] = " + tokens["[" + keys[i] + "]"]);
						self[keys[i]] = tokens["[" + keys[i] + "]"];
						break;
				}
				*/


				if (i == (keys.length - 1)){
					CF.getJoin("d"+self.XBMC.joins.connected.join, function(j, v, t) {

						if ( v == 1 ) loadMediaLists(); // will be force loaded once connected
						else {
							self.XBMC.QueueInitMsg("failed to connect to xbmc client..");
							clearTimeout(preloadTimeoutID);
							preloadTimeoutID = null;
							updateStatus();
						}
					});
				}
			}
			} catch (e) { consolelog("error in for loop - " + e) }
		});

		// start 30sec timeout before loading gui without connection
		// still needed or just wait for init msgs to finish?
		var preloadTimeoutID = setTimeout(function(){
			consolelog("Preloading timeout expired!!");
			clearTimeout(preloadTimeoutID);
			preloadTimeoutID = null;
			self.XBMC.QueueInitMsg("xbmc connection timed out...");
		}, 30000);

		// start interval to check for preloading complete
		var preloadIntervalID = setInterval(function() {
			// check to see if artist list has been loaded or preload timeout expired before presenting interface
			//if ( (preloadTimeoutID === null || guiComplete == true) && self.XBMC.joins.init.queue.length == 0 ) {

			try {
				if (guiComplete === true && self.XBMC.joins.init.queue.length == 0) {
					// nowPlayingLoop complete at least one loop and completed the gui
					// no init msgs left in queue

					// clear the preload timeout
					if (preloadTimeoutID !== null) {
						clearTimeout(preloadTimeoutID);
						preloadTimeoutID = null;
					}

					// ok to run the callback function
				} else throw ""; //?
			} catch (e) {

			}
			if ( preloadTimeoutID === null) {

				//CF.setJoin("s"+self.joins.init, ("xbmc initialiasation complete..."));
				clearInterval(preloadIntervalID);
				preloadIntervalID = null;
				// initialisation complete, run the callback function if req'd
				if (typeof callback == "function") callback();
			}
		}, 300);
	}

	function onPreloadingComplete() {
		//CF.unwatch(CF.PreloadingCompleteEvent);
		self.XBMC.QueueInitMsg("initialising xbmc...");
		consolelog("onPreloadingComplete() fired");
		/*
		moved to onConnectionStatusChange??
		init(function() {
			setTimeout(function() {
				console.log("Preloading complete! Present the interface...");
				CF.setJoin("d"+self.joins.yatse.page, 1); // present the GUI after preloading of assets has completed

				startNowPlayingLoop({enabled: true});	// restart now playing loop
			}, 500);
		});
		*/
	}

	function onJoinChange(join, value, tokens) {
		consolelog("onJoinChange(" + join + ", " + value + ", " + tokens + ")");
		switch (join) {
			case "d"+self.XBMC.joins.connected.join:
				self.XBMC.joins.connected.value = value;
				if (value == 1) {
					if ( self.XBMC.jsonQueue.length > 0 ) must = "restart the json loop";

					//if (!(guiComplete)) init(); // start init again
					//else startNowPlayingLoop({enabled: true});
				} else stopNowPlayingLoop({disconnected: true}); // force reset of GUI
				break;
			case "d"+self.joins.subtitles:
				if (value == 1) {
					consolelog("SUBTITLES join triggered high");
					self.XBMC.Subtitles(tokens["[shuffle]"]);
				}
				break;
			case "d"+self.joins.shuffle:
				if (value == 1) {
					consolelog("SHUFFLE join triggered high");
					self.XBMC.Shuffle(tokens["[shuffle]"]);
				}
				break;
			case "d"+self.joins.repeat:
				if (value == 1) {
					consolelog("REPEAT join triggered high");
					self.XBMC.Repeat(tokens["[repeat]"]);
				}
				break;
			case "d"+self.joins.yatse.wall:
				if ( value == 1) {
					// showing the media wall page
					CF.listContents("l"+self.joins.yatse.mediaList, 0, 0, function(items) {
					    // ... use the returned items here ...
					    consolelog("Requesting to build the " + self.currentList + " media wall...");
					    console.log(items);
					    consolelog("items.length = " + items.length);
					    if (self.XBMC.GetListArray(self.currentList).length == 0 || items.length == 0) self.buildWall(self.currentList); // refresh the media list with movies
					});
				}
				break;
			case "d"+self.joins.yatse.settings.xbmc:
				CF.getJoin("d"+self.XBMC.config.mysqlenabled.join, function(j, v, t) {
					onJoinChange(j, v, t); // move subpages to correct positions
					CF.setJoin("d"+self.joins.yatse.settings.mysql, value);  // keep both pages in sync
				});
			case "d"+self.joins.yatse.special_commands:
			case "d"+self.joins.yatse.pc_commands:
			case "d"+self.joins.yatse.diagnostics.subpage:
				// show/hide the popup hider page
				CF.setJoin("d"+self.joins.yatse.popup_hider, value);
				break;
			case "d"+self.joins.playing:
				CF.setJoin("s"+self.joins.yatse.transport_playpause, "images\\yatse_transport_" + ((value == 1) ? "pause" : "play") + ".png");
				break;
			case "d"+self.joins.yatse.topbar.subpage:
				CF.setJoin("d"+self.joins.yatse.topbar.done, value); // sync done button with activated topbar state
				break;
			case "s"+self.joins.yatse.fanart.join:
				self.joins.yatse.fanart.url = value;
				break;
			case "s"+self.joins.yatse.np_thumbnail.join:
				self.joins.yatse.np_thumbnail.url = value;
				break;
			case "d"+self.XBMC.config.mysqlenabled.join:
				switch(value) {
					case 0:
						// move xbmc subpage to y(275) and mysql to y(479)
						CF.setProperties([
							{join: "d"+self.joins.yatse.settings.xbmc, y: 275},
							{join: "d"+self.joins.yatse.settings.mysql, y: 479}
						], 0, 1.5, CF.AnimationCurveEaseOut);
						break;
					case 1:
						// move xbmc subpage to y(88) and mysql to y(666)
						CF.setProperties([
							{join: "d"+self.joins.yatse.settings.xbmc, y: 88},
							{join: "d"+self.joins.yatse.settings.mysql, y: 666}
						], 0, 1.5, CF.AnimationCurveEaseOut);
						break;
				}
				break;

		}
	}

	function onConfigChange(join, value, tokens) {
		consolelog("Updating persitent config data...");
		// request the value's from the joins
		CF.getJoins(self.XBMC.configJoins, function(obj) {
			//console.log(obj);
			var data = {};
			for ( var prop in obj ) {
				if (obj[prop].hasOwnProperty("value")) {
					for ( var key in self.XBMC.config ) {
						if (self.XBMC.config[key].hasOwnProperty("join") && self.XBMC.config[key].join == prop.substr(1)) data[key] = obj[prop].value;
					}
				}
			}
			//console.log(data);
			// save the data to the Global Token to persist across sessions
			consolelog("Setting [XBMC_Config] to = " + JSON.stringify(data));
			//CF.setToken(CF.GlobalTokensJoin, "[XBMC_Config]", JSON.stringify(data));
			CF.setJoins([{join: CF.GlobalTokensJoin, tokens: {"[XBMC_Config]": JSON.stringify(data)}}]);
		});
	}

	function onConnectionChange(system, connected, remote) {
		// On connected==true, the remote is a string
		// for example: "192.168.0.16:5050"
		// When getting initial status, if the system is not connected, remote is null.
		if (connected) {
			consolelog("System " + system + " connected with " + remote);
			init(function() {
				setTimeout(function() {
					console.log("Preloading complete! Present the interface...");
					CF.setJoin("d"+self.joins.yatse.page, 1); // present the GUI after preloading of assets has completed

					startNowPlayingLoop({enabled: true});	// restart now playing loop -> may look at moving to onPreloadComplete with a connection ok status check before running...
				}, 500);
			});
		} else {
			if (remote === null) consolelog("Initial status: system " + system + " is not connected.");
			else consolelog("System " + system + " disconnected from " + remote);
		}
	}

	function onSliderPressed(j, v, t) {
		switch (j) {
			case "a"+self.joins.progress:
				consolelog("Disabling progress bar updates from XBMC...");
				disableProgressUpdates = true;
				break;
		}
	}

	function onSliderDragged(j, v, t) {
		// --
	}

	function onSliderReleased(j, v, t) {
		switch (j) {
			case "a"+self.joins.progress:
				// send seek command to XBMC
				try {
					self.XBMC.Seek( (v / 65535) * 100 );
				} catch (e) {
					consolelog("exception caught onSliderReleased() - " + e);
				}

				disableProgressUpdates = false;
				consolelog("Enabling progress bar updates from XBMC...\nAnalog progress value = " + v + "\nPercentage progress = " + (v / 65535) * 100 + "%");
				break;
		}
	}

	function resetGUI() {
		setMediaListTitle(); // set to default

		clearJoins = function() {
			CF.setJoins([
				{join: "s"+self.joins.yatse.np_info_one.join, value: ""},
				{join: "s"+self.joins.yatse.np_info_two, value: ""},
				{join: "s"+self.joins.yatse.np_info_three, value: ""},
				{join: "s"+self.joins.yatse.fanart.join, value: ""},
				{join: "s"+self.joins.yatse.np_thumbnail.join, value: ""},
				{join: "a"+self.joins.progress, value: 0},
				{join: "s"+self.joins.yatse.sidemenu.np_thumbnail.join, value: ""},
				{join: "s"+self.joins.yatse.sidemenu.np_primary_info, value: ""},
				{join: "s"+self.joins.yatse.sidemenu.np_secondary_info, value: ""},
			]);
		}

		faders = [
			{join: "s"+self.joins.yatse.fanart.join, opacity: 0},
			{join: "s"+self.joins.yatse.np_thumbnail.join, opacity: 0},
			{join: "s"+self.joins.yatse.sidemenu.np_thumbnail.join, opacity: 0},
			{join: "s"+self.joins.yatse.sidemenu.np_primary_info, opacity: 0},
			{join: "s"+self.joins.yatse.sidemenu.np_secondary_info, opacity: 0},
		];

		CF.getProperties("s"+self.joins.yatse.fanart.join, function(j) {
			if (j.opacity > 0) {
				// fade out the fanart and thumbnails
				//CF.setProperties({join: "s"+self.joins.yatse.fanart.join, opacity: 0}, 0, 3, CF.AnimationCurveLinear, function() {
				CF.setProperties(faders, 0, 3, CF.AnimationCurveLinear, function() {
					clearJoins();
				});
			} else clearJoins();
		});
	}

	// This is the function that creates the loop, runs every 3 seconds. Alternatively can use setInterval.
	function startNowPlayingLoop(update) {
		consolelog("Request made to start the Now Playing Loop...\n");
		if ( typeof update == "object" ) {
			console.log(update);
			consolelog("self.XBMC.player.speed = " + self.XBMC.player.speed);
			//									 disable loop if nothing is playing
			if ( update.hasOwnProperty("enabled") && typeof update.enabled == "boolean" && self.XBMC.player.speed !== 0) nowPlayingLoop.enabled = update.enabled;
			if ( update.hasOwnProperty("complete") && update.complete == true ) nowPlayingLoop.complete = true;
		}

		consolelog("startNowPlayingLoop(update): enabled = " + nowPlayingLoop.enabled + ", complete = " + nowPlayingLoop.complete);


		consolelog("JSON command queue length = " + self.XBMC.jsonQueue.length);
		// wait for json queue to clear before running again...
		if (self.XBMC.jsonQueue.length > 0) {
			// make sure no timer is already running
			consolelog("nowPlayingLoopID = " + nowPlayingLoopID + ", (nowPlayingLoopID === null) = " + (nowPlayingLoopID === null));
			if (nowPlayingLoopID === null) {
				nowPlayingLoopID = setTimeout(function() {
					//console.log(CF.systems);
					consolelog("now playing loop timer expired - calling startNowPlayingLoop() again...");
					nowPlayingLoopID = null;
					startNowPlayingLoop();
				}, 5000);  // <-- adjust back to 300 once json query working
			}
		} else if (nowPlayingLoop.enabled == true && nowPlayingLoop.complete == true) {
			clearTimeout(nowPlayingLoopID);
			nowPlayingLoopID = null;

			consolelog("Next pass of now playing loop running..."); // working

			if (!(guiComplete)) self.XBMC.QueueInitMsg("getting player status from xbmc...");
			nowPlayingLoop.complete = false; // prevent multiple loops running
			self.XBMC.GetNowPlaying();
		} else if (nowPlayingLoopID !== null) {
			// now playing loop has been disabled so clear the timer
			clearInterval(nowPlayingLoopID);
			nowPlayingLoopID = null;
		}
	}

	// This is the function that stops the loop from running. Alternatively should use clearInterval.
	function stopNowPlayingLoop(data) {
		consolelog("Stopping the Now Playing Loop...");
		nowPlayingLoop.enabled = false;
		nowPlayingLoop.complete = true;
		//if (!(guiComplete)) guiComplete = true;
		if (typeof data != "data") data = {};

		/*
		clearInterval(nowPlayingLoopID);
		nowPlayingLoopID = null;
		*/

		if (self.XBMC.player.id === null || data.hasOwnProperty("disconnected")) {
			// no active players or XBMC has been disconnected to reset the GUI
			// XBMC may have been disconnected for this to be called so don't relay on XBMC responses to update GUI
			//CF.setProperties({join: "s"+self.joins.yatse.fanart.join, opacity: 0}, 0, 5, CF.AnimationCurveLinear);
			resetGUI();
			self.XBMC.player.speed = 0;
			if (!(guiComplete)) guiComplete = true; // loop breakout if no active player when gui loads
		}
		updateStatus();
	}

	function updateStatus() {
		CF.getJoins(["d"+self.XBMC.joins.connected.join, CF.GlobalTokensJoin], function(joins) {
			consolelog("updatingLists.length = " + updatingLists.length);
			if ( parseInt(joins["d"+self.XBMC.joins.connected.join].value) === 0 ) status = "red";			// disconnected
			else if (updatingLists) status = "blue";							// connected, updating (updatingLists == undefined when finished)
			else if (self.XBMC.player.speed == 0 || self.XBMC.player.speed === null) status = "white";	// connected, idle
			else status = "green";										// connected, active

			CF.setJoin("s"+self.XBMC.joins.connected.join, "http://www.southernelectriq.com.au/commandfusion/raglan/images/yatse_status_" + status + ".png");
			CF.setJoin("d"+self.joins.playing, (self.XBMC.player.speed == 1) ? 1 : 0); // update play/pause button state
		});

	}

	// function for decoding string with accents
	function decode_utf8(string) {
		return decodeURIComponent(escape(string));
	};

	function cleanImage(img) {
		try {
			if (img == "") return img;
			else {
				/*
				PRE-FRODO
				//console.log("Clean image substr(8) = " + img.substr(8));
				img = img.substr(8); // remove 'image://'
				//console.log("Clean image substring(0,7) = " + decodeURIComponent(img).substring(0,7));
				if (decodeURIComponent(img).substring(0,7) != "http://") {
					// XBMC's 'special' protocol
					img = self.getURL("HTTP") + "vfs/" + img;
				} else {
					img = decodeURIComponent(img);
				}
				//console.log("Cleaned Image = " + img.substring(0, img.length-1));
				return img.substring(0, img.length-1); // remove trailing '/' (no idea why XBMC has this...)
				*/
				//console.log(self.URL + "image/" + encodeURIComponent(img));
				return self.XBMC.GetURL("HTTP") + "image/" + encodeURIComponent(img);

			}
		} catch (e) {
			console.log ("Exception caught in cleanImage() - " + e);
			return img;
		}
	};

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
				console.log("Invalid mac address(" + mac + ") supplied for WOL command");
				return false;
			}
		}
	}

	function consolelog(msg) {
		if (CF.debug) console.log("XBMC_GUI: " + msg);
	}

	function CFlog(msg) {
		if (CF.debug) CF.log("XBMC_GUI: " + msg);
	}

	// --- Initialisation --- //
	return self;

	} catch (e) {
		consolelog("top level exception caught - " + e);
	}

}