/*=====================================================================

Optional params =
hours		=> maximum time in hours to be displayed per guide page (2 > 6)
minutes		=> maximum time in minutes to be display per guide page (120 > 260)
filter		=> include only the LCN's provided here


=====================================================================*/

var TVGuide = function( params, listJoin ) {
	var backendTV = null;
	self = {
		channels:		new Array(),
		guides:			new Array(),
		logo:			{
						width: 175,
						height: 120,
						max_width: 155,
						max_height: 100,
					},
		joins:			{
						//connected:		3000, // D(status)
						//address:		3000, // S(text)
						"tvGuideList":		listJoin || 3101,
						"page":			3,
						"logoImg":		1,
						"recordIcon":		0,
						"title":		1,
						"description":		2,
						"startFinish":		3,
						"timeline":		3011,
						"day":			3001, // S(text)
						"date":			3002, // S(text)
						"progress":		3003, // S(image)
						"past":			3004, // S(image)
						//"loadingTimer":		2, // a(timer)
						"wait":			3006,
						"menu":			3012,
						"menuToggle":		3013,
						// Program information page
						"programInfoPage":	3005,
						"infoPoster":		200,
						"infoBanner":		201,
						"infoNetwork":		202,
						"infoFanart":		203,
						"infoTitleArt":		204,
						"infoCharacterArt":	205,
						"infoTitleText":	210,
						"infoTagline":		211,
						"infoSynopsis":		212,
						"infoInfoLeft":		213,
						"infoInfoRight":	214,
						"infoIMDB":		220,
						"IMDBwindow":		3200,
						"IMDBurl":		3201,
						"IMDBtitle":		3202,
						"IMDBback":		3203,
						"IMDBforward":		3204,
						"IMDBstop":		3205,
						"IMDBrefresh":		3206,


						// timeline labels 11-17
						// timeline knicks/tiles 21-27

					},
		channelFilter:		("filter" in params) ? filter : null,
		maxHours:		("hours" in params && parseInt(params.hours, 10) >= 2 && parseInt(params.hours, 10) <= 6 ) ? parseInt(params.hours, 10) : undefined,
		maxMinutes:		("minutes" in params && parseInt(params.minutes, 120) >= 2 && parseInt(params.minutes, 10) <= 360 ) ? parseInt(params.minutes, 10) : undefined,
		guideWidth:		0,
		displayWidth:		0,
		pxToMinsRatio:		0,
		progressOffset:		25,
		timelineOffset:		158,
		recordIconWidth:	42,
		beginningTime:		0,
		guideGUIDs:		[],
		channelGUIDs:		[],
		recordings:		null,
		completed:		false,
		channelListComplete:	false,
		guideDataComplete:	false,
		setupComplete:		false,
		maxProgramTiles:	10,
		minProgramWidth:	75,
		refreshPercent:		75,	// % of total display time before refresh guide
		refreshRate:		null,	// set in hours during setup()
		// cleanUpComplete:	false, // not req'd
		itemBorder:		20,
		padding:		2,
		chr_id:			null, // character art interval id
		infoPageShowing: 	false,
		loading:		false,
		guideTime:		Date.now(),
		init:		{
						guide:		[],
		},
		//info:			[],
	};


	self.setup = function() {
		//if (backendTV == null) {
		DisplayInitMsg("connecting to argus tv server...");
		backendTV = new ArgusTV();
		//backendTV.ping(); // built in setup() of ArgusTV
		//}


		self.hideProgramInfo();
		CF.watch(CF.JoinChangeEvent, "d"+self.joins.page, self.onPageShowing);
		//CF.watch(CF.JoinChangeEvent, "a"+self.joins.loadingTimer, self.onLoadingTimerChange);
		//CF.watch(CF.JoinChangeEvent, "d"+self.joins.menuToggle, self.onMenuToggle);

		//CF.setToken("a"+self.joins.loadingTimer, "pos", -self.progressOffset*2);
		CF.setToken("s"+self.joins.progress, "pos", -self.progressOffset*2); // set progress bar to initial loading x position

		// setup joins
		CF.setJoins([
			{join: "s"+self.joins.day, value: ""},
			{join: "s"+self.joins.date, value: ""},
			{join: "s"+self.joins.infoTitleText, value: ""},
			{join: "s"+self.joins.infoTagline, value: ""},
			{join: "s"+self.joins.infoSynopsis, value: ""},
			{join: "s"+self.joins.infoInfoLeft, value: ""},
			{join: "s"+self.joins.infoInfoRight, value: ""},
			//{join: "a"+self.joins.loadingTimer, value: 3000}, // set to 3secs
			{join: "d"+self.joins.menu, value: 0},
			{join: "d"+self.joins.wait, value: 0},
		]);

		/*
		CF.setProperties([
			{join: "s"+self.joins.infoFanart, y: -520, h: 1080},
			{join: "s"+self.joins.past, opacity: 0},

		]);
		*/
		DisplayInitMsg("building tv guide interface...");
		self.maxMinutes = (self.maxHours == 0 && self.maxMinutes == 0) ? 240 : (self.maxMinutes || (self.maxHours * 60));
		self.refreshRate = Math.floor(self.maxMinutes/60 * self.refreshPercent/100);
		self.menuState = 0;

		CF.getGuiDescription(function(info) {
			self.displayWidth = info.landscapeSize.w;
			self.displayHeight = info.landscapeSize.h;
			self.pxToMinsRatio = Math.ceil((self.displayWidth - self.logo.width - self.padding) / (self.maxMinutes));
			/*
			var xpos = self.logo.width + self.padding; // position of first timeline tile
			for (n = 1; n <= 7; n++) {
				if ( xpos < self.displayWidth ) {
					CF.setProperties([{join: "s1"+n, x: xpos + 8}, {join: "s2"+n, x: xpos, w: 60*self.pxToMinsRatio, value: "images/timeline_" + self.pxToMinsRatio + "px.png"}], 0, 0.5, CF.AnimationCurveLinear);
					xpos += 60 * self.pxToMinsRatio;
				}
			}
			*/
			//self.consolelog("pxToMinsRatio = " + self.pxToMinsRatio);

			// prepare UI
			CF.setProperties([
				{join: "s"+self.joins.progress, x: self.displayWidth},
				{join: "s"+self.joins.infoFanart, y: -520, h: 1080},
				{join: "s"+self.joins.past, x: self.logo.width + self.padding, w: 0, opacity: 0.0},
				{join: "d"+self.joins.menu, x: (225 - 1900)},
			]);

			self.setupComplete = true;
			self.consolelog("Setup of a new TVGuide has been completed...");
			DisplayInitMsg("tv guide interface ready...");
		});
	};

/*
	self.onLoadingTimerChange = function(join, value, tokens) {
		self.consolelog("onLoadingTimerChange() called. join = " + join + ", value = " + value + ", value type = " + (typeof value));
		self.consolelog("tokens to follow --v");
		console.log(tokens);
		try {
			//self.consolelog(tokens);
			if (tokens["complete"] == 1) {
				self.consolelog("updating completed status to true");
				self.completed = true;
			}
		} catch (e) {

		}
	};
*/

	self.onPageShowing = function(join, value, tokens) {
		self.consolelog("onPageShowing() called. value = " + value + ", value type = " + (typeof value));
		if ( value == 1 ) {
			try {
				// check backend server status every 1s until found
				pageID = setInterval(function() {
					if (self.setupComplete == true) {
						self.consolelog("Running backend server check... " + backendTV.online);
						if (backendTV.online === true) {
							clearInterval(pageID);
							CF.setJoin("d"+self.joins.wait, 0);

							// see if tv guide list has previously been loaded
							CF.listInfo("l"+self.joins.tvGuideList, function(list, count, first, numVisible, scrollPosition) {
							    //self.consolelog("TV List " + list + " has " + count + " items, showing " + numVisible + " items starting from " + first + " (scroll position: " + scrollPosition + "px)");
							    if ( count > 0 ) {
								self.redraw();
							    } else {
								//if ( self.loading === false ) self.load();
								self.build();
							    }
							});
						} else {
							// ping backend TV server
							if ( typeof backendTV.online != "undefined" ) CF.setJoin("d"+self.joins.wait, 1);
							backendTV.ping();
						}
					}
				}, 1000);
			} catch (e) {
				self.consolelog("exception caught! /n" + e);
			}
		} else {
			backendTV.online = false; // force refresh of server status on next page load... ?
		}
	};

	self.toggleMenu = function(force) {
			self.menuState = (force === 1 || self.menuState == 0) ? 1 : 0;
			switch(self.menuState) {
				case 1:
					// expand
					CF.setProperties({join: "d"+self.joins.menu, x: 0}, 0, 1, CF.AnimationCurveEaseOut);
					break;
				case 0:
					// contract
					CF.setProperties({join: "d"+self.joins.menu, x: (225-1900)}, 0, 1, CF.AnimationCurveEaseOut);
					break;
			}
	}

	// pos = next position for progress bar to move to
	self.load = function() {
		pos = -self.progressOffset*2;
		speed = 3; // time in seconds

		self.consolelog("progress pos = " + pos);
		CF.setProperties({join: "s"+self.joins.progress, x: pos, opacity: 1.0}, 0, speed, CF.AnimationCurveEaseInOut);
		pos = (pos > 0) ? (-self.progressOffset*2) : self.displayWidth;

		loadID = setInterval(function() {
			if (typeof fin == "undefined") {
				self.consolelog("progress pos = " + pos);
				CF.setProperties({join: "s"+self.joins.progress, x: pos, opacity: 1.0}, 0, speed, CF.AnimationCurveEaseInOut);
				pos = (pos > 0) ? (-self.progressOffset*2) : self.displayWidth;
			}

			try {
				if ( self.completed && pos > 0 ) {
					clearInterval(loadID);
					self.consolelog("Begin presenting interface...");
					// send the progress bar back to the start
					//CF.setProperties({join: "s"+self.joins.progress, x: -self.progressOffset*2, opacity: 1.0}, speed, speed, CF.AnimationCurveEaseInOut);

					// finished loading and progress bar previously heading right
					//CF.setJoin("a"+self.joins.loadingTimer, 0); // disable timer // no longer used??


					// start fading in timeline and guide list, set to 5 secs in guiDesigner
					CF.setJoin("d"+self.joins.timeline, 1);

					// fade the TV guide list in after 1.5sec delay over 3 sec duration = 6sec totals
					CF.setProperties({join: "l"+self.joins.tvGuideList, opacity: 1.0}, 1.5, speed, CF.AnimationCurveLinear);

					// hide the progress bar and move it to the starting position after a delay of 3.5 secs (a smidge longer than one screen crossing)
					CF.setProperties({join: "s"+self.joins.progress, opacity: 0.0, x: self.logo.width + self.padding - self.progressOffset}, speed+0.5, 0, CF.AnimationCurveLinear);

					// show the menu bar after 2.5 seconds
					setTimeout(function() {
						CF.setJoin("d"+self.joins.menu, 1);
					}, 4000);
					// wait 4 sets then fade the progress bar into view
					//CF.setProperties({join: "s"+self.joins.progress, opacity: 1.0}, 3.5, 2, CF.AnimationCurveLinear); // 4sec delay + 1sec duration = 5sec

					// wait 5sec then update the position of the progress bar and history cover and we're done!
					setTimeout(function() {
						self.consolelog("Updating position of progress bar during loading phase");
						self.updateTimePosition({duration: speed});
					//}, 7000); - for use when fading the progress bar on its own
					}, (speed+1)*1000);

					fin = true;


					//setJoin("a"+self.joins.loadingTimer, 0);
					//self.loading = false; // reset
				}
			} catch (e) {
				self.consolelog("Continue loading, guide not completed yet... (" + e + ")");
			}
		}, speed*1000); // time taken for complete loop of loading anim
	};

	self.build = function() {

		if ( self.completed == false || self.recordings === null || self.channelListComplete == false || self.guideDataComplete == false ) {
			self.completed = false;
			//if ( self.completed == false ) self.loading(-self.progressOffset*2);
			//if ( self.completed == false ) self.load();
			self.load();
			//setTimeout(function() {
				self.consolelog("ok, let's build the tv guide...")
				// guide has not been created in this instance before
				CF.setProperties({join: "l"+self.joins.tvGuideList, opacity: 0.0});

				self.recordings = null;
				backendTV.getRecordings(self.receiveRecordings);
				// Wait for program recording schedules to populate
				timeID = setTimeout( function() {
						clearInterval(intID);
						self.consolelog("Failed to load recordings :(");

						// show WOL option?


				}, 10000 );

				intID = setInterval(function() {
					if ( self.recordings !== null ) {
						clearInterval(intID);
						clearTimeout(timeID);
						//self.consolelog("Guides successfully loaded into TVGuide");
						// load the next stuff here....

						// load the channel list if not redrawing guide
						if ( self.completed != true ) self.loadChannelList();
					}
				}, 200);
			//}, 3000);


		} else self.redraw();
	};

	self.receiveLogo = function(id, data) {
		try {
			i = self.channelGUIDs.indexOf(id);
			self.consolelog("receiving channel logo for listIndex = " + i);
			// Argus sends raw image/png data rather than a link :(
			if ( i >= 0) {
				var pngFileAsBlob = new Blob([data], {type:'image/png'});

				img = new Image();
				img.src = webkitURL.createObjectURL(pngFileAsBlob);

				//img.height = 60;
				img.onload = function(e) {
					self.consolelog("revoking img");
					webkitURL.revokeObjectURL(this.src);
				};

				self.consolelog("logo = " + img.src);
				self.channels[i].s1 = decodeURIComponent(img.src).substr(5);
				//self.channels[0].s1 = "tvlogos/1.png";
				//self.channels[i].s1 = "data:image/png;base64," + window.btoa(data);
				self.consolelog(self.channels[i].s1);

			}
		} catch (e) {
			self.consolelog("Exception caught in TVGuide.receiveLogo(). id = " + id + ".\n" + e);
		}
	};

	self.receiveChannelList = function(data) {
		// Basic list population: Add a title and three items, all at once
		//self.consolelog(data);
		CF.setJoin("l"+self.joins.tvGuideList, "0x");
		try {
			//self.consolelog("TVGuide.receiveChannelList called");



			// CHANGE TO for ( var key in data )
			data.forEach( function(val, idx, arr) {
				//self.consolelog(val);
				self.consolelog("Channel logo = http://192.168.10.100:49943/ArgusTV/Scheduler/ChannelLogo/" + val.ChannelId + "/300/300/true/19000101T010101");

				//backendTV.getLogo(self.receiveLogo, val.ChannelId);

				self.channels.push({
					s1: "tvlogos/" + val.LogicalChannelNumber + ".png",
					//s1: "http://192.168.10.100:49943/ArgusTV/Scheduler/ChannelLogo/" + val.ChannelId + "/300/300/true/19000101T010101",
					d1: {
						tokens: {
							"channelID":	val.Id,
							"channelGUID":	val.ChannelId,
							"guideGUID":	val.GuideChannelId,
							"name":		val.DisplayName,
							"lcn":		val.LogicalChannelNumber,
						},
						properties: {
							"theme":	((((idx/2) % 1) > 0) ? "tv_logo_light" : "")
						}
					},
					//s21: idx,
					//s31: "tvlogos/" + val.LogicalChannelNumber + ".png",
					//s41: "",
					//s51: "",
				});
				self.guideGUIDs.push(val.GuideChannelId);
				self.channelGUIDs.push(val.ChannelId);
				//backendTV.getChannelGuide() {}
			});
			self.channelListComplete = true;
			//self.consolelog(self.channels);
			//CF.listAdd("l"+self.joins.tvGuideList, self.channels);
		} catch (e) {
			self.consolelog("Caught exception in TVGuide.receiveChannelList - " + e);
		}

	};

	self.receiveRecordings = function(data) {
		//self.recordings = null;
		self.recordings = data;
		self.consolelog("received recording data...");
		self.consolelog(self.recordings);
	};

	self.receiveChannelGuides = function(data) {
		//self.consolelog(data);
		var iPrev = null;
		var x = 0;

		var cleanTitle = [
			" - Encore",
			" - New",
			" - New Episode",
			" - Double Episode",
			" - Premiere",
			" (Includes Sneak Preview",
			" (Includes Sneek Preview",
			" (Includes Sneak Peek",
			" (Includes Sneek Peek",
			" (Includes Sneek Peak",
			" (Includes Sneak Peak",
		];
		//self.consolelog(self.guideGUIDs);
		data.forEach( function(val, idx, arr) {

			//self.consolelog("trimmed title = " + val.Title);
			// remove junk from pita guide programmers
			cleanTitle.forEach(function(str) {
				//if ( val.Title.indexOf(str, val.Title.length - str.length) > 0 ) val.Title = val.Title.substr(0, val.Title - str.length);
				//self.consolelog("trash title match = " + val.Title.substr(0, val.Title.indexOf(str)) + ", indexOf(" + str + ") = " + val.Title.indexOf(str));
				//if ( val.Title.length > str.length && val.Title.substr(-str.length) == str) {
				if ( val.Title.length > str.length && val.Title.indexOf(str) > 0) {
					//self.consolelog("old title = " + val.Title);
					val.Title = val.Title.substr(0, val.Title.indexOf(str));
					//self.consolelog("new title = " + val.Title);
				}
			});
			val.Title = val.Title.trim();
			start = new Date(parseInt(val.StartTimeUtc.match(/[0-9]+/)[0]));
			end = new Date(parseInt(val.StopTimeUtc.match(/[0-9]+/)[0]));
			self.consolelog("\nstart time = " + start);
			self.consolelog("end time = " + end);
			start.setSeconds(0);
			end.setSeconds(0);

			self.consolelog("(end-start) time = " + (end-start));
			duration = (end - start) / 1000 / 60;
			self.consolelog("duration time = " + duration + ", pxRatio = " + self.pxToMinsRatio + ", pxDuration = " + (self.pxToMinsRatio * duration));


			i = self.guideGUIDs.indexOf(val.GuideChannelId);
			//self.consolelog("index of GuideChannelId = " + i);
			if ( i >= 0 ) {
				if (i != iPrev) {
					iPrev = i;
					n = 2; // first program item join in the listItem
					xNext = self.logo.width + self.padding;
				} else n++;
				//self.consolelog("starting x pos for tile = " + x);
				//x = self.logo.width + self.padding;
				//while (self.channels[i].hasOwnProperty("d"+n) && n < 20) {
					// skip through previous programs whilst grabbing there duration (pixel width)
					//self.consolelog("Previous item duration = " + (Math.round(self.channels[i]["d"+n].tokens.duration * self.pxToMinsRatio) + self.padding));
					//self.consolelog("receiveChannelGuide: i = " + i + ", idx = " + idx + ", val.GuideChannelId = " + val.GuideChannelId);
					//if ("duration" in self.channels[i]["d"+n].tokens) {
						//x += Math.round(self.channels[i]["d"+n]["tokens"]["duration"] * self.pxToMinsRatio) + self.padding;
					//}
				//	n++;
				//}

				if ( n == 2 ) {
					//self.consolelog("\n");
					// first program item added
					self.consolelog("adjusting width of first tile for ' " + val.Title + "'");
					duration = (end - self.beginningTime) / 1000 / 60;
				}
				//self.consolelog("item#" + i + "-d" + n + " duration = " + duration);

				// add code to get recording status of program

				//self.consolelog(val.GuideProgramId);
				//recording = false;
				//if (self.recordings !== null) {
					//self.consolelog("self.recordings != null");
					recording = ( val.GuideProgramId in self.recordings ) ? self.recordings[val.GuideProgramId] : false; // false || single || series
				//}
				//self.consolelog("xNext < displayWidth => " + xNext + " < " + self.displayWidth);

				if ( xNext < self.displayWidth ) {
					// show program
					x = xNext;
					w = Math.round(duration * self.pxToMinsRatio);
					recordX = xNext + w - self.itemBorder/2 - self.recordIconWidth;
					contentWidth = w - (self.itemBorder * 2);
					op = 1.0;
					startFinish = ("0"+start.getHours()).substr(-2) + ":" + ("0"+start.getMinutes()).substr(-2) + " - " + ("0"+end.getHours()).substr(-2) + ":" + ("0"+end.getMinutes()).substr(-2)
				} else {
					// hide program completely
					x = self.displayWidth;
					recordX = x;
					w = 0;
					contentWidth = w;
					op = 0.0;
				}

				w -= self.padding;

				if ( (x + w) >= self.displayWidth ) {
					// shorten width of program tile and hide content
					w = self.displayWidth - x;
					if ( w <= self.minProgramWidth ) {
						val.Title = "...";
						val.Description = "";
						startFinish = "";
						recording = false;
					}
				}



				self.channels[i]["d"+n] = {
					tokens:	{
						"programID":	val.Id,
						"programGUID":	val.GuideProgramId,
						"duration":	duration,
					},
					properties: {
						"x":		x,
						"w":		w,
						"opacity":	op,
						"theme":	"tv_program_" + ((((i/2) % 1) > 0) ? "light" : "dark")
					},
				};

				//xNext += (Math.round(duration* self.pxToMinsRatio) + self.padding);
				xNext += Math.round(duration* self.pxToMinsRatio);
				self.consolelog("\ntitle = " + val.Title + ", next x = " + x + ", duration = " + duration);

				// fix to hide items less than 60ish px wide
				//if (w <= self.recordIconWidth + (self.itemBorder / 2)) {

				// fix to adjust items less than the minimum width
				if (w <= self.minProgramWidth) {
					// hiding content that is to small to be displayed adequately
					//self.consolelog("Hiding content that is just, too, small :(");
					x = self.displayWidth;
					recordX = x;
					w = 0;
					contentWidth = w;
					op = 0.0;
				} else x += self.itemBorder;


				self.channels[i]["s"+n+self.joins.title] = {
					value:	val.Title,
					properties: {
						"x":		x,
						"w":		(recording == false) ? contentWidth : contentWidth - self.recordIconWidth,
						"opacity":	op
					}
				};

				self.channels[i]["s"+n+self.joins.description] = {
					value:		val.Description,
					properties: {
						"x":		x,
						"w":		contentWidth,
						"opacity":	op
					}
				};

				self.channels[i]["s"+n+self.joins.startFinish] = {
					value:		(typeof startFinish != "undefined") ? startFinish : "",
					properties: {
						"x":		x,
						"w":		contentWidth,
						"opacity":	op
					}
				};

				// record icon
				self.channels[i]["s"+n+self.joins.recordIcon] = {
					value:		"/images/tv_rec_" + ((recording == "series") ? "series" : "single") + ".png",
					properties: {
						"x":		recordX,
						"opacity":	(recording == false) ? 0.0 : op
					}
				};



			}
		});

		//self.consolelog(self.channels);
		self.guideDataComplete = true;
		//CF.listAdd("l"+self.joins.tvGuideList, self.channels);

	};

	self.loadChannelList = function() {
		self.consolelog("loading channel list...");
		backendTV.getChannels(self.receiveChannelList, "TV");

		self.channelListComplete = false;

		// Wait for channel list to populate
		timeID = setTimeout( function() {
				clearInterval(intID);
				self.consolelog("Failed to load channel list :(");
			}, 10000 );

		intID = setInterval(function() {
			if ( self.channelListComplete == true ) {
				clearInterval(intID);
				clearTimeout(timeID);
				//diff = {};
				d = new Date();

				//diff.mins = d.getMinutes();
				//diff.hrs = ((d.getHours()/4) % 1) * 4;

				//d = Date(d - (4 - ((d.getHours()/4) % 1) * 4));
				//self.consolelog("current hours = " + d.getHours());
				//self.consolelog("current mins = " + d.getMinutes());

				// Set the beginning display time for the guide - round to the total time displayed
				//(refresh @ 75% of total display time)



				//d.setHours(d.getHours() - ((d.getHours()/4) % 1) * 4);// working version - static @ 4 hours
				refreshRate = Math.round(self.maxMinutes/60 * self.refreshPercent/100);
				d.setHours(d.getHours() - ((d.getHours()/refreshRate) % 1) * refreshRate);
				d.setMinutes(0);
				d.setSeconds(0);



				self.consolelog("time rounded to previous " + refreshRate + " hour divisor = " + d);
				//self.beginningTime = Date.now();
				self.beginningTime = d;
				//self.consolelog("Channels successfully loaded into TVGuide");

				// Setup timeline
				//xpos = self.logo.width + self.padding - self.timelineOffset;
				//self.consolelog("timeline x pos = " + xpos + " => " + (diff.mins + diff.hrs*60) + " mins");
				//CF.setJoin("d"+self.joins.timeline, 1);

				//CF.setProperties({join: "d"+self.joins.timeline, x: xpos - self.timelineOffset}, 0, 5, CF.AnimaitionCurveLinear);

				// build the timeline graphic
				self.drawTimeline();
				/*
				xpos = self.logo.width + self.padding; // position of first timeline tile
				for (n = 1; n <= 7; n++) {
					op =  ( xpos < self.displayWidth ) ? 1.0 : 0.0;
					CF.setProperties([
						{ join: "s1"+n, x: xpos + 7, opacity: op },
						{ join: "s2"+n, x: xpos, w: 60*self.pxToMinsRatio, opacity: op }
					], 0, 0.5, CF.AnimationCurveEaseOut);
					time = self.beginningTime.getHours() + n - 1;
					if ( time >= 24 ) time = time - 24;
					CF.setJoins([
						{ join: "s1"+n, value: ("0" + time).substr(-2) + ":00" },
						{ join: "s2"+n, value: "images/timeline_" + self.pxToMinsRatio + "px.png"}
					]);

					xpos += 60 * self.pxToMinsRatio;

				}
				var monthNames = [ "January", "February", "March", "April", "May", "June",
				"July", "August", "September", "October", "November", "December" ];
				var dayNames = [ "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday" ];


				CF.setJoins([
					//{join : "d"+self.joins.timeline, value : 1}, // moved to cleanup()
					{join: "s"+self.joins.day, value: dayNames[self.beginningTime.getDay()]},
					{join: "s"+self.joins.date, value: monthNames[self.beginningTime.getMonth()] + " " + self.beginningTime.getDate()},
					]);
				*/
				// load the next stuff here....
				self.loadChannelGuides();
			};
		}, 200);
	};

	self.loadChannelGuides = function(params) { // (optional) -which id needed to get single channel guide??
		self.guideDataComplete = false;
		if (typeof params == "object") {
			params.guideids =	( typeof params.guideids != "undefined") ? params.guideids : self.guideGUIDs;
			params.startTime =	( typeof params.startTime != "undefined" && typeof params.startTime.getMonth === "function") ? params.startTime : self.beginningTime;
			params.endTime =	( typeof params.endTime != "undefined" && typeof params.endTime.getMonth === "function") ? params.endTime : Math.ceil((self.displayWidth - self.logo.image - self.padding) / self.pxToMinsRatio / 60);
		} else {
			params = {};
			params.guideIDs = self.guideGUIDs,
			params.startTime = self.beginningTime;
			params.endTime = Math.ceil((self.displayWidth - self.logo.image - self.padding) / self.pxToMinsRatio / 60);
		}

		//backendTV.getGuides(self.guideIDs, self.beginningTime)
		//backendTV.getGuides(guideids, self.receiveChannelGuides);




		backendTV.getGuides(params, self.receiveChannelGuides);

		// Wait for channel guides to populate
		timeID = setTimeout( function() {
				clearInterval(intID);
				self.consolelog("Failed to load channel guides :(");

				// show WOL option?


			}, 10000 );

		intID = setInterval(function() {
			if ( self.guideDataComplete == true ) {
				clearInterval(intID);
				clearTimeout(timeID);
				//self.consolelog("Guides successfully loaded into TVGuide");
				// load the next stuff here....
				self.cleanUp();
			};
		}, 200);

	};

	self.cleanUp = function() {

		x = self.displayWidth;
		w = 0;
		op = 0.0;
		self.consolelog(self.channels);
		self.channels.forEach( function(val, i) {
			n = self.maxProgramTiles; // max program buttons available to be used
			//self.consolelog(self.channels[i]);
			while ( !(self.channels[i].hasOwnProperty("d"+n)) && n > 0 ) {
				//self.consolelog("Item Ref # " + i + "." + n + " doesnt have any content so hide it!");

				self.channels[i]["d"+n] = {
					properties: {
						"x":		x,
						"w":		w,
						"opacity":	op
					},
				};
				self.channels[i]["s"+n+self.joins.title] = {
					value:	val.Title,
					properties: {
						"x":		x,
						"w":		w,
						"opacity":	op
					}
				};

				self.channels[i]["s"+n+self.joins.description] = {
					value:		val.Description,
					properties: {
						"x":		x,
						"w":		w,
						"opacity":	op
					}
				};

				self.channels[i]["s"+n+self.joins.startFinish] = {
					properties: {
						"x":		x,
						"w":		w,
						"opacity":	op
					}
				};

				// record icon
				self.channels[i]["s"+n+self.joins.recordIcon] = {
					properties: {
						"x":		x,
						"opacity":	op
					}
				};
				n--;
			}
		});

		// self.cleanUpComplete = true; //not req'd
		CF.listAdd("l"+self.joins.tvGuideList, self.channels);

		//self.onTVGuideListChange("", {}, "");
		//CF.setJoin("a"+self.joins.loadingTimer, 0);
		//CF.setToken("a"+self.loadingTimer, "complete", true);
		//CF.setToken("a2", "complete", true);
		if (self.completed == false) {
			//CF.setToken("a"+self.joins.loadingTimer, "complete", 1);  // remove if working
			//self.consolelog("'Complete' token changed, hopefully join event triggered??"); // remove if working loadingTimer join may no longer be needed all together
			//CF.setJoin("a"+self.joins.loadingTimer, 2999);

			self.completed = true;
			self.consolelog("TV finished loading!! (self.completed = true)");
		}


	};


	// params = { datetime: Date(), duration: Int() }
	self.updateTimePosition = function(params) {
		//current = (typeof params != "undefined" && typeof params.datetime === "object") ? params.datetime : new Date(); // NEEDS FIXING....!!
		current = new Date();
		duration = (typeof params != "undefined" && typeof params.duration === "number") ? params.duration : 5; // duration = time taken for complete cross of screen
		//diff = new Date();
		//setHours(diff.getHours() - self.beginningTime.getHours())
		hrs = (current.getHours() - self.beginningTime.getHours()); //hrs
		mins = (current.getMinutes() - self.beginningTime.getMinutes()); //mins
		px = (hrs * 60 + mins) * self.pxToMinsRatio;

		// redraw guide once progress bar gets to 75% to screen
		//if (px > (self.refreshAt/100 * (self.displayWidth - self.logo.width - self.padding))) self.redraw();
		self.consolelog("self.pxToMinsRatio * self.refreshRate = " + self.pxToMinsRatio * self.refreshRate * 60 + ", px = " + px);
		// redraw guide once progress bar gets past the refresh time threshold (in hours)
		if ( px > (self.pxToMinsRatio * self.refreshRate * 60)) self.redraw();
		else {


			//self.consolelog("progress bar difference = " + hrs + " hrs + " + mins + " mins => " + px + "px. duration = " + duration);

			//diff = Math.floor((Date.now() - self.beginningTime) / 1000 / 60); //mins
			pos = Math.round(px + self.logo.width + self.padding - self.progressOffset);

			//self.consolelog("time difference = " + (hrs*60+mins) + " mins\nNew position = " + pos);

			//if (duration > 0.5)
			duration *= px/(self.displayWidth - self.logo.width - self.padding);

			CF.setProperties([
				{ join: "s"+self.joins.progress, x: pos, opacity: 1.0 },
				{ join: "s"+self.joins.past, w: (pos + self.progressOffset - self.logo.width), opacity: 1.0 }
				],
				0, //delay
				duration, //duration
				CF.AnimationCurveEaseOut
			);
		}
		/*
		CF.setProperties({ join: "s"+self.joins.past, w: (pos + self.progressOffset - self.logo.width) },
					0,
					0.5,
					CF.AnimationCurveLinear
				);
		*/
	};

	self.redraw = function(time) {
		switch (typeof time) {
			case "object":
				if (typeof time.hours != "undefined") self.beginningTime.setHours(self.beginningTime.getHours() + time.hours);
				break;
			default:
				d = new Date();
				refreshRate = Math.round(self.maxMinutes/60 * self.refreshPercent/100);
				d.setHours(d.getHours() - ((d.getHours()/refreshRate) % 1) * refreshRate);
				d.setMinutes(0);
				d.setSeconds(0);
				self.beginningTime = d;
				break;
		}
		self.consolelog("Redrawing guide...");
		self.guideDataComplete =	false;
		self.recordings =		null;

		// clear existing guide list...
		CF.listRemove("l"+self.joins.tvGuideList);

		intID = setInterval(function() {
			if ( self.recordings === null && self.guideDataComplete === false ) {
				clearInterval(intID);
				backendTV.getRecordings(self.receiveRecordings);
			}
		}, 200);

		intRec = setInterval(function() {
			if ( self.recordings !== null ) {
				clearInterval(intRec);
				//params = { startTime: self.guideTime };
				self.loadChannelGuides();
				self.drawTimeline();
			}
		}, 200);

		intGuide = setInterval(function() {
			if ( self.guideDataComplete !== false ) {
				clearInterval(intGuide);
				self.updateTimePosition();
			}
		}, 200);

	};

	self.drawTimeline = function() {
		xpos = self.logo.width + self.padding; // position of first timeline tile
		for (n = 1; n <= 7; n++) {
			op =  ( xpos < self.displayWidth ) ? 1.0 : 0.0;
			CF.setProperties([
				{ join: "s1"+n, x: xpos + 7, opacity: op },
				{ join: "s2"+n, x: xpos, w: 60*self.pxToMinsRatio, opacity: op }
			], 0, 0.5, CF.AnimationCurveEaseOut);
			time = self.beginningTime.getHours() + n - 1;
			if ( time >= 24 ) time = time - 24;
			CF.setJoins([
				{ join: "s1"+n, value: ("0" + time).substr(-2) + ":00" },
				{ join: "s2"+n, value: "images/timeline_" + self.pxToMinsRatio + "px.png"}
			]);

			xpos += 60 * self.pxToMinsRatio;

		}
		var monthNames = [ "January", "February", "March", "April", "May", "June",
		"July", "August", "September", "October", "November", "December" ];
		var dayNames = [ "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday" ];

		CF.setJoins([
			//{join : "d"+self.joins.timeline, value : 1}, // moved to cleanup()
			{join: "s"+self.joins.day, value: dayNames[self.beginningTime.getDay()]},
			{join: "s"+self.joins.date, value: monthNames[self.beginningTime.getMonth()] + " " + self.beginningTime.getDate()},
			]);
	};

	self.showProgramInfo = function( join, list, listIndex  ) {
		CF.setJoin("d"+self.joins.programInfoPage, 1);
		self.infoPageShowing = true;
		self.info = {};

		apikey = {
			fanart:		"ef3f42cdacfb67d6eb2c7218f05461e0",
			tvdb:		"A1285A1F5F7B4A61",
		};

		address = {
			//fanart:	"http://api.fanart.tv/webservice/series/apikey/thetvdb_id/format/type/sort/limit/",
			fanart:		"http://api.fanart.tv/webservice/series/ef3f42cdacfb67d6eb2c7218f05461e0/{tvdb_id}/json/all/1/1/",
			tvdb:		{
				search:		"http://thetvdb.com/api/GetSeries.php?seriesname=",
				art:		"http://thetvdb.com/api/{api_key}/series/{tvdb_id}/banners.xml",
				summary:	"http://thetvdb.com/api/{api_key}/series/{tvdb_id}/en.xml",
			},

		};

		// set network logo
		CF.getJoin(list+":"+listIndex+":s1", function(j, v, t) {
			CF.setJoin("s"+self.joins.infoNetwork, v.replace(".png", "-hd.png"));
		});

		//fanart_suffix = "/preview";  // for low-res versions append to end of image
		self.consolelog(join.substr(1,2));
		self.consolelog("selected title join = " + list+":"+listIndex+":"+"s"+join.substr(1,2)+"1");
		//CF.getJoin(list+":"+listIndex+":"+"s"+join.substr(1,2)+"1", function(join, programTitle, tokens) {
		CF.getJoin(list+":"+listIndex+":"+"s"+join.substr(1,2)+self.joins.title, function(j, programTitle, t) {
			var id = undefined;
			//programTitle = "the following"; // for testing


			self.rpc(address.tvdb.search + encodeURI(programTitle), null, function(data) {
				// reset the program information
				//if ( data.getElementsByTagName("seriesid").length > 0 ) {
					try {
						id = data.getElementsByTagName("seriesid")[0].textContent;
					} catch (e) {
						id = "";
					}
					self.consolelog("TVDB id = " + id);

					if ( typeof data.getElementsByTagName("IMDB_ID")[0] != "undefined" ) {
						CF.setProperties({join: "d"+self.joins.infoIMDB, opacity: 1.0});
						CF.setToken("d"+self.joins.infoIMDB, "id", data.getElementsByTagName("IMDB_ID")[0].textContent);
					} else CF.setProperties({join: "d"+self.joins.infoIMDB, opacity: 0.0});

					//if ( id > 0 ) {

					// art from thetvdb
					self.rpc(address.tvdb.summary.replace("{tvdb_id}", id).replace("{api_key}", apikey.tvdb), null, function(data) {
						tmdb_img_path = "http://thetvdb.com/banners/"; // add '_cache' for smaller version

						self.consolelog(data);
						//self.consolelog("banner = " + data.getElementsByTagName("banner")[0].textContent);
						//var inf = new Array();
						//var val, idx;

						info = {
							art:	{
								banner:		null,
								fanart:		null,
								poster:		null,
							},
							text:	{
								SeriesName:	null,
								Overview:	null,
								FirstAired:	null,
								Genre:		null,
								Rating:		null,
								Runtime:	null
							}
						};

						try {

							self.consolelog("now try forEach...");
						for ( var idx in info ) {
							self.consolelog("val = " + info[idx]);
							self.consolelog("idx="+idx+", val type = " + (typeof info[idx]));

							try {
								for ( var i in info[idx] ) {
									self.consolelog("i="+i+", val = " + info[idx][i]);
									try {
										info[idx][i] = ((idx == "art") ? tmdb_img_path : "") + data.getElementsByTagName(i)[0].textContent;
									} catch (e) {
										info[idx][i] = "";
									}
								};
							} catch (e) {
								self.consolelog("inner foreach caught - " +e);
							}

						};
						//},inf);
						}catch (e) {
							self.consolelog("outer foreach caught - " + e);
						}

						self.consolelog(info);

						/*
						banner= tmdb_img_path + data.getElementsByTagName("banner")[0].textContent || "";
						fanart	= tmdb_img_path + data.getElementsByTagName("fanart")[0].textContent || "";
						poster	= tmdb_img_path + data.getElementsByTagName("poster")[0].textContent || "";
						title	= data.getElementsByTagName("SeriesName")[0].textContent || "";
						synopsis = data.getElementsByTagName("Overview")[0].textContent || "";

						firstaired = data.getElementsByTagName("FirstAired")[0].textContent || "";
						genres	= data.getElementsByTagName("Genre")[0].textContent.split("|") || "";
						rating	= data.getElementsByTagName("Rating")[0].textContent || "";
						runtime	= data.getElementsByTagName("Runtime")[0].textContent || "";
						*/

						self.consolelog("join var = " + join);
						self.consolelog("desc join = " + list+":"+listIndex+":s"+join.substr(1,2)+self.joins.description);
						CF.getJoins([
							list+":"+listIndex+":s"+join.substr(1,2)+self.joins.title,
							list+":"+listIndex+":s"+join.substr(1,2)+self.joins.description
						], function(j) {
							self.consolelog(j);

							CF.setJoins([
								{join: "s"+self.joins.infoTitleText, value: (info.text.SeriesName == "") ? j[list+":"+listIndex+":s"+join.substr(1,2)+self.joins.title].value : info.text.SeriesName},
								//{join: "s"+self.joins.infoTitleText, value: (info.text.SeriesName == "") ? j["l1:3:s31"].value : info.text.SeriesName + " - info"},
								{join: "s"+self.joins.infoSynopsis, value: (info.text.Overview == "") ? j[list+":"+listIndex+":s"+join.substr(1,2)+self.joins.description].value : info.text.Overview},
								{join: "s"+self.joins.infoBanner, value: info.art.banner},
								{join: "s"+self.joins.infoFanart, value: info.art.fanart},
								{join: "s"+self.joins.infoPoster, value: info.art.poster},
							]);


							// art from fanart.tv
							self.rpc(address.fanart.replace("{tvdb_id}", id), null, function(data) {
								self.consolelog(data);
								self.consolelog("art.tv data type = " + (typeof data));
								try {
									art = data[Object.keys(data)[0]];
								} catch (e) {
									self.consolelog("No artwork found from fanart.tv...");
									art = new Object();
								}
								self.consolelog("art variable coming next");
								self.consolelog(art);
								//thumbnail = ( art.hasOwnProperty("tvthumb") ) ? thumbnail = art.tvthumb[0].url : "";

								if ( art.hasOwnProperty("hdtvlogo") || art.hasOwnProperty("clearlogo") ) {
									self.consolelog("found a logo to display instead of the text title");
									img = new Image();
									img.src = art.clearlogo[0].url || art.hdtvlogo[0].url;

									img.onload = function() {
										//CF.getProperties("s"+self.joins.infoTitleText, function(j) {
											ratio = this.width / this.height;
											if ( 200 * ratio > this.w ) {
												// adjust based on width
												this.width = 710;
												this.height = this.width / ratio;
											} else {
												// adjust based on height
												this.height = 200;
												this.width = this.height * ratio;
											}
											//self.consolelog("ratio = " + ratio + ", j.w = " + j.w + ", j.h = " + j.h);
											//self.consolelog("title image = " + img.src + ", width = " + img.width + ", height = " + img.height);
											CF.setJoin("s"+self.joins.infoTitleArt, this.src);
											xpos = (self.displayWidth / 2) - (this.width / 2);
											CF.setProperties({join: "s"+self.joins.infoTitleArt, opacity: 1.0, x: xpos, w: this.width, h: this.height}, 0, 1, CF.AnimationCurveLinear);
										//});
									};
									//img = null;
								} else {
									self.consolelog("attempting to show the text title");
									CF.setProperties({join: "s"+self.joins.infoTitleText, opacity: 1.0}, 0, 1, CF.AnimationCurveLinear);
								}

								if ( art.hasOwnProperty("characterart") ) {
									var n = 0;
									duration = 3000; // msecs
									pause = 5000; // msecs
									margin = 20; // px
									showImage = function() {
										try {
											if (self.infoPageShowing == true) {
												img = new Image();
												img.src = art.characterart[n].url;
												CF.setJoin("s"+self.joins.infoCharacterArt, img.src);
												img.onload = function() {
													// set the width/height of image
													CF.setProperties(
													{	join: "s"+self.joins.infoCharacterArt,
														w: img.width,
														h: img.height,
														x: self.displayWidth - img.width,
														y: self.displayHeight - img.height - margin,
														opacity: 0.0
													}, 0, 0, CF.AnimationCurveLinear, function(js) {
														if ( self.infoPageShowing == true ) {
															// show the characterart
															self.consolelog("show image for join " + js);
															CF.setProperties(
															{	join: js,
																opacity: 1.0
															}, 1, duration/1000, CF.AnimationCurveLinear, function(js) {
																// rotate images if more than 1 characterart available
																if ( art.characterart.length > 1) {
																	// hide the characterart after preset delay
																	self.consolelog("hiding image after delay for join " + js);
																	CF.setProperties(
																	{	join: js,
																		opacity: 0.0
																	}, pause/1000, duration/1000, CF.AnimationCurveLinear, function(js) {
																		n = (n < art.characterart.length-1) ? n + 1 : 0;
																		setTimeout(showImage(), pause - 1000);
																	}, js);
																}
															}, js);
														}
													}, "s"+self.joins.infoCharacterArt);
												};
											}
										} catch (e) {
											self.consolelog("Exception caught manipulating hte characterart images - " + e);
										}
									}
									showImage();
								}
								/*
								if ( art.hasOwnProperty("showbackground") ) {
									CF.setJoin("s"+self.join.infoFanart, art.showbackground[0].url);
									self.consolelog("setting fanart to => " + art.showbackground[0].url);
								}
								if ( art.hasOwnProperty("tvbanner") ) {
									CF.setJoin("s"+self.joins.infoBanner, art.tvbanner[0].url);
									self.consolelog("setting banner to => " + art.tvbanner[0].url);
								}
								*/


							});
						});
					});

				//} else {
				//	self.consolelog("Not TV series found for '" + programTitle + "'");
				//}
			});


		});


	};

	self.showIMDB = function(id) {

		address = "http://www.imdb.com/title/";
		self.consolelog("show imdb page " + address + id);
		CF.setJoins([
		{ join: "s"+self.joins.IMDBurl, value: address + id},
		{ join: "d"+self.joins.IMDBwindow, value: 1},
		]);
	};

	self.receivedTVDB = function(data) {
		self.consolelog(data);
	};

	// rpc("string", "string" | {object}, function())
	self.rpc = function(address, params, callback) {
		try {
			self.consolelog(address);
			//CF.logObject(params);
			//self.consolelog("params type = " + (typeof params).toLowerCase());
			//self.consolelog("params value = " + params);

			//self.consolelog("JSON parse = " + JSON.parse(params));
			if (params !== null && (typeof params).toLowerCase() == "object" && JSON.parse(JSON.stringify(params)) != null) {
				params.json = "2.0";
				//params.id = self.reqID++;
				params.id = 1;
				params = JSON.stringify(params);
				self.consolelog("json rpc string = " + params);
			}// else params = "";



			//CF.request(address, "POST", {"content-type": "application/json"}, params, function(status, headers, body) {
			CF.request(address, "GET", null, params, function(status, headers, body) {
				try {
					if (status == 200) {
						//CF.setJoin("d"+joins.onlineStatus, 1);
						//self.consolelog(body);
						try {
							data = JSON.parse(body);
							self.consolelog(data);
						} catch (e) {
							self.consolelog("Non JSON response - try XML...");
							try {
								//var parser = new ;
								var data = new DOMParser();
								data = data.parseFromString(body, "text/xml");

							} catch (e) {
								self.consolelog("Caught exception in xml parsing - " + e);
							}
						}

						self.consolelog("typeof data = " + (typeof data));
						if ( data == null ) {
							self.CFlog("RPC JSON RESPONSE FAILURE --------- NULL OBJECT");
							CF.logObject(data);
							callback(data);
						} else if (typeof data == "object" && "error" in data) {
							self.lastError = data.error;
							self.CFlog("RPC JSON RESPONSE FAILURE --------- ERROR IN OBJECT");
							CF.logObject(data);
							callback(false);
						} else {
							self.consolelog("Rest response ok - proceed with callback");
							//self.consolelog("\n" + body);
							// NULL = no channel found
							try {
								callback(data);
							} catch (e) {
								self.consolelog("Exception caught in self.rpc() callback function - " + e);
							}
						}
					} else {
						self.CFlog("RPC STATUS FAILURE ---------");
						self.CFlog(status);
						CF.logObject(headers);
						self.CFlog(body);
						callback(false);
					}
				} catch (e) {
					self.consolelog("Exception caught in self.rpc()- " + e);
				}
			});
		} catch (e) {
			self.consolelog("Exception caught in self.rpc() - " + e);
		}
	};

	self.hideProgramInfo = function( join, list, listIndex  ) {
		CF.setJoin("d"+self.joins.programInfoPage, 0);
		self.infoPageShowing = false;
		CF.setProperties([
			{join: "s"+self.joins.infoTitleArt, opacity: 0.0},
			{join: "s"+self.joins.infoTitleText, opacity: 0.0},
			{join: "s"+self.joins.infoTitleBanner, opacity: 0.0},
			{join: "s"+self.joins.infoTitlePoster, opacity: 0.0},
			{join: "s"+self.joins.infoTitleNetwork, opacity: 0.0}
		], 3, 2, CF.AnimationCurveLinear, function() {
			// hide the characterart here also incase only one characterart is available
			CF.setProperties(
			{	join: "s"+self.joins.infoCharacterArt,
				opacity: 0.0
			}, 1, 5, CF.AnimationCurveLinear);
		});
	};

	self.changeChannel = function(lcn) {
		// need interface to device that changes channels
		// need another 'user editable' script to provide this

		/*
		device = new tvGuideDevice("Channel");

		device.changeChannel(lcn);

		*/
		self.consolelog("changing to channel " + lcn);
		for ( i = 0; i < lcn.length; i++) {
			CF.runCommand(null, "TV Digit " + lcn[i]);
			if ( i == (lcn.length - 1) ) CF.runCommand(null, "TV Menu Select");
		}


	};


	self.consolelog = function(msg) {
		if (CF.debug) console.log("TVGuide: " + msg);
	};

	self.CFlog = function(msg) {
			if (CF.debug) CF.log("TVGuide: " + msg);
	};

	// Public functions
	function DisplayInitMsg(msg) {
		if (typeof msg == "object") self.init.queue.push(msg);
	}

	self.setup();

	return self;
};