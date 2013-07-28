/* Argus TV / Guide module
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

 AUTHORS:	Matt Hosken
 CONTACT:	matt.hosken@gmail.com
 VERSION:	v 1.0

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

 USAGE:

 // Custom parameters
 var myTVGuide = new TVGuide("s1", {address: "192.168.10.100", http: 49943, https: 49941, username: "argus", password: "tv"});
 // Default parameters - just need to supply ip address. Defaults to http port 49943
 var myTVGuideBasic = new TVGuide("s10");


/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
*/
var ArgusTV = function(join, params) {
	if (typeof params != "object") params = {}; // use defaults
	var self = {
		reqID:		0,
		address:	params.address || "192.168.10.100",
		port:		params.port || null,
		username:	params.username || "",
		password:	params.password || "",
		//protocol:	params.protocol || "http",
		host:		null,
		online:		false,
		joins:		{
					connected:	3050, // D(status)
					address:	3051, // S(text)
					port:		3052, // S(text)
					username:	3053, // S(text)
					password:	3054, // S(text)
		},
	};

	self.setup = function() {

		CF.watch(CF.JoinChangeEvent, "d"+self.joins.connected, function(j, v, t) {
			self.online = ( v == 1 ) ? true: false;
		});

		CF.setJoins([
			{join: "s"+self.joins.address,	value: self.address},
			{join: "s"+self.joins.port,	value: self.port},
			{join: "s"+self.joins.username,	value: self.username},
			{join: "s"+self.joins.password,	value: self.password},
		]);

		try {
			if (self.username.length <= 0) throw "Invalid username";
			self.host =  "https://" + self.username + ( (self.password.length > 0) ? ":" + self.password : "") + "@" + self.address + ":" + ( (typeof self.port == "number") ? self.port : "49941") + "/ArgusTV/";
		} catch (e) {
			consolelog("Reverting to connection using HTTP...\n" + e);
			self.host =  "http://" + self.address + ":" + ( (typeof self.port == "number") ? self.port : "49943") + "/ArgusTV/";
		}

		// test server connection
		self.ping();
	};

	// rpc("string", "string" | {object}, function())
	self.rpc = function(address, params, callback) {
		try {
			console.log(self.host + address);
			//CF.logObject(params);
			//console.log("params type = " + (typeof params).toLowerCase());
			//console.log("params value = " + params);

			//console.log("JSON parse = " + JSON.parse(params));
			if (params !== null && (typeof params).toLowerCase() == "object" && JSON.parse(JSON.stringify(params)) != "") {
				params.json = "2.0";
				params.id = self.reqID++;
				params = JSON.stringify(params);
				consolelog("json rpc string = " + params);
			}// else params = "";



			CF.request(self.host + address, "POST", {"content-type": "application/json"}, params, function(status, headers, body) {
				try {
					if (status == 200) {
						//CF.setJoin("d"+joins.onlineStatus, 1);
						//console.log(body);
						//CF.log(body);
						data = JSON.parse(body);

						if (typeof data == "object" && "error" in data) {
							self.lastError = data.error;
							CFlog("RPC JSON RESPONSE FAILURE ---------");
							CF.logObject(data);
							//callback(false);
						} else {
							console.log("Rest response ok - proceed with callback");
							//console.log("\n" + body);
							// NULL = no channel found
							//callback(data);
						}
					} else if (status == 204) {
						//callback(data);
						CFlog("RPC STATUS " + status + " --------");
					} else {
						CFlog("RPC STATUS FAILURE ---------");
						CFlog(status);
						CF.logObject(headers);
						CFlog(body);
						//callback(false);
						data = false;
					}

					callback(data);
					CF.setJoin("d"+self.joins.connection, (data == false) ? 0 : 1);
				} catch (e) {
					consolelog("Exception caught in self.rpc() callback - " + e);
				}
			});
		} catch (e) {
			consolelog("Exception caught in self.rpc() - " + e);
		}
	};

	self.ping = function() {
		self.rpc("Core/Ping/50", null, function(data) {
			//consolelog(data);

			//self.online = ( data === false ) ? false : true;

			//consolelog( "online = " + ((self.online == true) ? "TRUE!" : "FALSE!") );
		});
	};

	// ------------ TV CHANNEL FUNCTIONS -------------

	// getChannelTypeValue("tv" | "radio")
	self.getChannelTypeValue = function(type) {
		return (type !== undefined && type.toLowerCase(type) == "radio") ? 1 : 0;
	};

	// getChannelList( "tv" | "radio", function(data) )
	self.getChannelList = function(type, callback) {
			self.rpc("Guide/Channels/" + self.getChannelTypeValue(type), null, function(data) {
				//console.log("Now show the channel list!");
				if ( callback !== undefined ) callback(data);
			});
	};

	// Check if a channel exists by either name, XMLTV ID and Channel Type??/
	// findChannel({"name" | "xmlTvId" : "string"})
	self.findChannel = function(params) {
		searchType =	(params.name !== undefined) ? "Name" : "XmlTvId";
		term =		(params.name !== undefined) ? params.name : params.xmlTvId;
		self.rpc("Guide/ChannelBy" + searchType, term, function(data) {
			console.log("Does channel exist?");
		});
	};

	// ------------ TV GUIDE FUNCTIONS -------------

	// getGuide( {object}, "string" );
	// params = {guideIDs, startTime, endTime}
	//
	// PARAMS
	// guideIDs		Guid[]			An array of guide channel IDs.
	// startTime		/Date(gmt_ms+HHmm)/	Return programs that end after this time.
	// endTime		/Date(gmt_ms+HHmm)/	Return programs that start before this time.
	// type			"summary" | "full"	Default to summary info
	self.getGuides = function(params, callback) {
		json = {};
		//console.log(params);
		//console.log(typeof params);
		if ( params === undefined ) params = {};
		//else if ( !("guideIDs" in params) ) params = ((typeof params).toLowerCase() == "object") ? {"guideIDs": params} : {"guideIDs": [params]}; // break if start/endTime supplied without guideIDs


		// get all available channel ids if none selected
		// do I need to select guide type in the getPrograms() too?
		// figure out how to callback to this function with guide ids...
		json.GuideChannelIds = ( "guideIDs" in params ) ? params.guideIDs : self.getChannelList("tv"); // (false) not going to work due to callback

		// TIMING NEEDS WORK!! should pass local time in basic notation eg: 6.30am = 0630
		/*
		json.LowerTime = ( "startTime" in params ) ? params.startTime : function() {
				// startTime = now
				try {
					var d = "\/Date(" + Date().getTime() + "+" + ("00" + (Date().getTimezoneOffset() / 60)).slice(-2) + "00)\/";
					console.log("startTime = " + d);
					return d;
				} catch (e) {
					console.log("Exception caught making startTime - " + e);
				}
			};
		*/

		// params.startTime = Date object
		json.LowerTime = ( "startTime" in params && typeof params.startTime.getMonth == "function") ? params.startTime.valueOf() : (+new Date);
		consolelog("LowerTime = " + new Date(json.LowerTime).toLocaleString());

		// startTime = now
		try {
			var d = "\/Date(" + (json.LowerTime) + "+" + ("00" + ((new Date()).getTimezoneOffset() / 60)).slice(-2) + "00)\/";
			consolelog("LowerTime = " + d);
			json.LowerTime = d;
		} catch (e) {
			console.log("Exception caught making LowerTime - " + e);
		}


		/*
		json.UpperTime = ( "endTime" in params ) ? params.endTime : function(json) {
				try {
					// endTime = now + 12 hours
					d = "\/Date(" + ((+new Date) + 12 * 60 * 60 * 1000) + "+" + ("00" + ((new Date()).getTimezoneOffset() / 60)).slice(-2) + "00)\/";
					console.log("UpperTime = " + d);
					return d;
				} catch (e) {
					console.log("Exception caught making startTime - " + e);
				}
			};
		*/

		try {
			// params.endTime = integer (hours after start time)
			json.UpperTime = ( "endTime" in params && typeof params.endTime.getMonth == "function" ) ? params.endTime.valueOf() : null; // ??? not sure if this will work....

			if (json.UpperTime === null ) {
				json.UpperTime = ("endTime" in params && typeof endTime == "number") ? abs(endTime) : 6; // default to 6 hours later
				json.UpperTime = (+new Date) + json.UpperTime * 60 * 60 * 1000;
			}

			json.UpperTime = "\/Date(" + json.UpperTime + "+" + ("00" + ((new Date()).getTimezoneOffset() / 60)).slice(-2) + "00)\/";
			//console.log("UpperTime = " + json.UpperTime);
			//json.UpperTime = d;
		} catch (e) {
			console.log("Exception caught making UpperTime - " + e);
		}


		var guideType = ( "type" in params ) ? params.type : "full";

		//console.log("JSON = " + JSON.stringify(json));
		//TESTING
		//params = {"GuideChannelIds" : {1,2,3,4,5,6,7,8,9,10}, "LowerTime" : "\/Date(1297293089984+1000)\/", "UpperTime": "\/Date(1297693089984+1000)\/"};
		self.rpc("Guide/" + ((guideType.toLowerCase() == "full") ? "Full" : "") + "ChannelsPrograms/" + ((guideType.toLowerCase() == "full") ? "false" : ""), json, function(data) {
			//console.log("Show " + ((guideType.toLowerCase() == "full") ? "full" : "summary") + " guide for the given channels...");
			try {
				callback(data);
			} catch (e) {
				console.log("Exception caught in ArgusTV.getGuides callback - " + e);
			}
		});
	};


	// getProgram( "string" );
	// Retrieves information about an individual program
	self.getProgram = function(id) {
		self.rpc("Guide/Program/" + id, null, function(data) {
			console.log("Show program guide for a single channel");
		});
	};


	// ------------ ARGUS SCHEDULER FUNCTIONS -------------


	// Returns raw image/png data - not usefully for setting path of an image :(
	//getLogo( _int_, _int_ )
	self.getLogo = function(callback, GuideChannelId) {

		//address = Scheduler/ChannelLogo/{channelId}/{width}/{height}/{useTransparentBackground}/{modifiedAfterTime}?argbBackground={argbBackground}
		address = "Scheduler/ChannelLogo/" + GuideChannelId + "/300/300/true/19000101T010101";
		console.log(self.host + address);



		self.rpc(address, null, function(data) {
			console.log("Show channel logo for id " + GuideChannelId);
			//data = "data:image/png;base64," + data;
			callback(GuideChannelId, data);
		});


	}


	// getChannels( "tv" | "radio" )
	self.getChannels = function(callback, type) {
		// address = Scheduler/Channels/{channelType}?visibleOnly={visibleOnly}
		var channels = null;
		type = (typeof type != "undefined" && type.toUpperCase() == "RADIO") ? "RADIO" : "TV";
		self.rpc("Scheduler/Channels/" + self.getChannelTypeValue(type) + "?visibleOnly=true", null, function(data) {
			//console.log("Show some channels from the schedular API");
			try {
				callback(data);
			} catch (e) {
				console.log("Exception caught in ArgusTV.getChannels callback - " + e);
			}
		});

		/*
		timeID = setTimeout
		intID = setInterval(function() {
			if ( channels !== null ) {
				clearInterval(intID);
				clearTimeout(timeID);
			};
		}, 200);
		*/

		//console.log(channels);
		//return channels;
	}

	// address = Scheduler/SearchGuideByPartialTitle/{channelType}?includeProgramsInPast={includeProgramsInPast}
	// SearchGuide( { type : "tv" | "radio", keyword : _string_ } )
	self.searchGuide = function(params) {
		if ( params.keyword === undefined ) return false;
		self.rpc("Scheduler/SearchGuideByPartialTitle/" + self.getChannelTypeValue(params.type) + "?includeProgramsInPast=false", params.keyword, function(data) {
			console.log("Search for programs with '" + params.keyword + "'");
		});
	};



	// getChannelInfo( { LCN : _int_, name : _string_, type : "tv" | "radio" } )
	self.getChannelInfo = function(params) {
		if ( typeof params != "object" ) return false;
		else if ( "name" in params ) {
			// address = Scheduler/ChannelByDisplayName/{channelType}
			self.rpc( "Scheduler/ChannelByDisplayName/" + self.getChannelTypeValue(params.type), params.name, function(data) {
					console.log("Show channel information for '" + params.name + "'");
				});
		} else if ( "LCN" in params ) {
			// address = Scheduler/ChannelByLCN/{channelType}/{logicalChannelNumber}
			self.rpc( "Scheduler/ChannelByLCN/" + self.getChannelTypeValue(params.type) + "/" + params.LCN, null, function(data) {
					console.log("Show channel information for LCN #" + params.LCN);
				});
		} else return false;

	};

	//----------------- ARGUS RECORDINGS ------------------------
	//Address = Control/UpcomingRecordings/%7BupcomingRecordingsFilter%7D?includeActive={includeActive}
	// type = "simple" || "detail" (optional)
	self.getRecordings = function(callback, type) {
		self.rpc( "Control/UpcomingRecordings/1/?includeActive=true", null, function(data) {
			programs = [];
			type = (typeof type != "undefined") ? type : "simple";
			if (type == "simple") {
				data.forEach(function(val, idx) {
					programs[""+val.Program.GuideProgramId] = (val.Program.IsPartOfSeries == true) ? "series" : "single";
				});
			} else {
				data.forEach(function(val, idx) {
					programs.push({
						GuideProgramId:	val.Program.GuideProgramId,
						ProgramId:	val.Program.Id,
						Series:		val.Program.IsPartOfSeries,
						ChannelGUId:	val.Program.Channel.ChannelId,
						LCN:		val.Program.Channel.LogicalChannelNumber,
						GuideChannelId:	val.Program.Channel.GuideChannelId,
						ChannelId:	val.Program.Channel.Id,
						});
				});
			}
			if (typeof callback == "function") callback(programs);
		});
	};

	function consolelog(msg) {
		if (CF.debug) console.log("ArgusTV: " + msg);
	};

	function CFlog(msg) {
		if (CF.debug) CF.log("ArgusTV: " + msg);
	};

	self.setup();
	return self;
};
//myTVGuide = new ArgusTV("s1", {address: "192.168.10.100"});