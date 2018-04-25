const SETTINGS_NAME = "settings"

let obj: Settings =
	{
		active: true,
		torrents: [],
		debug: false,
		currentKBytesPerSeconds: 100,
		currentClient: 0,
		showNotification: true,
		peerId: ""
	}

try {
	Object.assign(obj, JSON.parse(localStorage.getItem(SETTINGS_NAME)))
}
catch (e) {
	console.error(e)
}

function saveSettings() {
	localStorage.setItem(SETTINGS_NAME, JSON.stringify(settings))
}
setInterval(saveSettings, 10000)

const settings = obj

import { translate } from "../modules/module_i18n"
import { showUnit, Time, Bytes } from "../modules/module_utils"
import { Clients, encode_hash, encodeBufferToURIChar, generateKey, generatePeerId } from "../modules/module_bittorent"

import * as bencode from "bencode"
import * as ParseTorrentFile from "parse-torrent-file"
import * as _url from "url"

/*

 */

//@hack : check if headers are fixed

if (settings.debug) {
	chrome.webRequest.onSendHeaders.addListener(details => {

		if (details.tabId == -1) {
			//@chrome : random behavior
			//@firefox : ?
			console.debug("onSendHeaders", details)
		}
	},
		{
			urls: ["<all_urls>"],
			// @chrome : ignored
			// @firefox : ok but not for favicon.ico
			tabId: -1
		},
		["requestHeaders"])
}

//@hack : fix fetch/xhr headers

function rewriteHeaders(details: chrome.webRequest.WebRequestHeadersDetails) {
	console.debug("rewriteHeaders", details)

	if (details.tabId >= 0) {
		/* reject if not coming from an extension tabId==-1 */

		/* @firefox : .documentUrl & .originUrl */
		/* @chrome : .initiator */

		console.error("rewriteHeaders tabid", details.tabId)

		return
	}

	let headers = []

	/*
		cleanup headers

		@firefox : add "origin" headers with extension id @privacy
		@chrome : add "X-DevTools-Emulate-Network-Conditions-Client-Id" @privacy

	 */

	headers.push(
		{
			name: "User-Agent", value: Clients[settings.currentClient].userAgent
		},
		{
			name: "Accept-Encoding", value: "gzip" // qBittorrent
		},
		{
			//@hack replace keep-alive
			name: "Connection", value: "close"
		})

	//@firefox [0]
	//@chrome : missing
	let host = details.requestHeaders.find(header => header.name.toLowerCase() == "host")

	if (host) {
		headers.push({
			// "Host" : required
			name: host.name, value: host.value
		})
	}

	console.debug("rewriteHeaders headers", headers)

	return { requestHeaders: headers };
}

function updateRewriteHeaders() {
	//@todo
	chrome.webRequest.onBeforeSendHeaders.removeListener(rewriteHeaders)

	if (settings.active && settings.torrents.length) {
		// uniq / supprime les doublons
		let urls = Array.from(new Set(settings.torrents.map(torrent => torrent.announceURL))).map(url => {
			// @chrome & @firefox : remove ":port"

			let x = _url.parse(url)
			return x.protocol + "//" + x.hostname + x.path + "?*"
		})

		chrome.webRequest.onBeforeSendHeaders.addListener(rewriteHeaders,
			{
				urls: urls
				//, types: ["xmlhttprequest"]
			},
			[
				"requestHeaders", "blocking"
			]
		)

		console.debug("updateRewriteHeaders", urls)
	}
	else {
		console.debug("rewriteHeaders disabled")
	}
}

/**
 * enable/disable downloads monitoring based on settings.active
 */
function updateDownloadsMonitoring() {
	let monitored = chrome.downloads.onCreated.hasListener(monitoringDownloads)

	if (settings.active && monitored == false) {
		chrome.downloads.onCreated.addListener(monitoringDownloads)
		console.debug("onCreated added")
	}
	else if (settings.active == false && monitored == true) {
		chrome.downloads.onCreated.removeListener(monitoringDownloads)
		console.debug("onCreated removed")
	}
}

/*

	addTorrent(torrent as ArrayBuffer,download url)
*/
function addTorrent(buffer: ArrayBuffer, url: string) {

	try {
		//@node
		let torrent = ParseTorrentFile.decode(Buffer.from(buffer))

		if (torrent.private &&
			torrent.name &&
			torrent.infoHash &&
			torrent.announce &&
			torrent.announce[0] &&
			/* dupe ? */
			settings.torrents.findIndex(t => t.hash == torrent.infoHash) == -1) {

			console.debug("New torrent", torrent)

			let tracker = torrent.announce[0]

			let page = (torrent.urlList && torrent.urlList.length) ? torrent.urlList[0] : url

			let newTorrent: Torrent = {
				started: new Date(),
				enabled: true,
				name: torrent.name,
				hash: torrent.infoHash,
				totalUploaded: 0,
				announceURL: tracker,
				//@fail
				seeders: 0,
				leechers: 0,
				lastAnnounce: 0,
				interval: 30 * Time.MINUTE,
				size: torrent.length,
				tracker: _url.parse(tracker).hostname,
				pageURL: page,
				lastError: null
			}

			settings.torrents.push(newTorrent)
			sendMessage({ settings: settings })

			updateBA()

			if (settings.showNotification && url != "") {
				chrome.notifications.create(chrome.runtime.id,
					{
						type: "list",
						iconUrl: "icons/logo.png",
						title: translate("extExtension") + " " + translate("newTorrent"),
						message: translate("newTorrent"),
						items:
							[
								{
									title: newTorrent.tracker, message: newTorrent.name
								}
							]
					})
			}
		}
		else {
			console.error("torrent rejected", torrent)
		}
	}
	catch (err) {
		console.error(err) // @todo:invalid torrent
	}
}

function Download(url: string) {

	return new Promise((resolve, reject) => {
		let xhr = new XMLHttpRequest();

		xhr.addEventListener("loadend", function(e: ProgressEvent) {
			let target = e.target as XMLHttpRequest

			if (target.response) {
				console.debug(xhr)
				if (xhr.getResponseHeader("Content-Type") == "application/x-bittorrent" && xhr.status == 200) {
					resolve(xhr)
				}
				else {
					reject(xhr)
				}
			}
		})
		xhr.addEventListener("error", e => {
			reject(xhr)
		})

		xhr.open("get", url, true)
		xhr.withCredentials = true
		xhr.responseType = "arraybuffer"
		xhr.send()
	})
}
/**
 * surveille le téléchargement de fichier .torrent
 * et l'ajoute à la liste des torrents - chrome.downloads.onCreated callback
 *
 * @param {chrome.downloads.DownloadItem} downloadItem [description]
 */
function monitoringDownloads(downloadItem: chrome.downloads.DownloadItem) {

	console.debug("downloads.onCreated", downloadItem)

	if (downloadItem
		&& downloadItem.state == "in_progress"
		&& downloadItem.url
		&& downloadItem.mime
		&& downloadItem.mime.toLowerCase() == "application/x-bittorrent") {

		let url = downloadItem.url

		/*

		@todo

		downloadItem.finalUrl : ?
		downloadItem.referrer : ?
		downloadItem.url : ?

		*/

		Download(url)
			.then((xhr: XMLHttpRequest) => {
				addTorrent(xhr.response, downloadItem.referrer)
			})
			.catch(console.error)
	}
}

function setBAIcon(icon: string) {
	console.debug("SetBAIcon", icon)

	chrome.browserAction.setIcon(
		{
			path: "icons/" + icon
		})
}

/*

	some magic

 */
function freeLeech() {
	let fetching: Array<Torrent> = []

	if (settings.active &&
		settings.torrents.length) {

		let speedPerTorrent = settings.currentKBytesPerSeconds / settings.torrents.length

		settings.torrents.forEach(torrent => {
			if (!torrent.enabled) {
				return
			}

			let now = Date.now()

			let last = torrent.lastAnnounce

			if (last == 0) // new torrent == 0
			{
				torrent.lastAnnounce = now
				return
			}
			else {
				let diff = now - last

				if (diff < torrent.interval) {
					return
				}
			}

			torrent.lastAnnounce = now

			console.debug("fetching", torrent.name)

			fetching.push(torrent)

			let bytes = (Math.random() * speedPerTorrent | 0) * 1024

			let tmp_uploaded = torrent.totalUploaded + (bytes * torrent.interval / Time.SECOND)

			console.debug(torrent.name, showUnit(bytes), "/s", "uploaded", tmp_uploaded);

			let url = torrent.announceURL +
				// The 20 byte sha1 hash of the bencoded form of the info value from the metainfo file.
				// Note that this is a substring of the metainfo file. Don't forget to URL-encode this
				"?info_hash=" + encode_hash(torrent.hash) +
				// A string of length 20 which this downloader uses as its id.
				// Each downloader generates its own id at random at the start of a new download. Don't forget to URL-encode this.
				"&peer_id=" + settings.peerId +
				// Port number this peer is listening on.
				// Common behavior is for a downloader to try to listen on port 6881 and if that port is taken try 6882,
				// then 6883, etc. and give up after 6889.
				"&port=6881" +
				// Total amount uploaded so far, represented in base ten in ASCII.
				`&uploaded=${tmp_uploaded}` +
				// Total amount downloaded so far, represented in base ten in ASCII.
				"&downloaded=0" +
				// Number of bytes this client still has to download, represented in base ten in ASCII.
				// Note that this can't be computed from downloaded and the file length since the client might be resuming an earlier download,
				// and there's a chance that some of the downloaded data failed an integrity check and had to be re-downloaded.
				"&left=0" +

				"&corrupt=0" +
				"&key=" + generateKey() +
				"&event=complete" +

				// Optional key tells the tracker how many addresses the client wants in the tracker's response.
				// The tracker does not have to supply that many. Default is 50.
				"&numwant=0" +

				//// Indicate that the tracker can send the IP address list in a compact form (see below for a detailed description)
				"&compact=1" +

				// Ask the tracker to 'not send the peer id information.
				"&no_peer_id=1" +
				// support crypted
				"&supportcrypto=1" +
				// ?
				"&redundant=0";

			console.debug("fetch", url)

			fetch(url)
				.then(res => {
					console.debug("fetch seeding", res.status, res.statusText, res.headers)
					return res.arrayBuffer()
				})
				.then(buffer => {
					try {
						let json = bencode.decode(new Buffer(buffer))

						console.debug("torrent", json)

						// .failure
						// .warning

						if (json.failure || json.warning) {
							torrent.enabled = false
							//@todo : format ?
							torrent.lastError = json.failure + json.warning
						}
						else {
							torrent.seeders = json.complete
							torrent.leechers = json.incomplete
							torrent.lastError = null
							torrent.totalUploaded = tmp_uploaded

							if (json.interval) {
								torrent.interval = json.interval * Time.SECOND
							}
						}
					}
					catch (err) {
						console.error(err)
					}
				})
				.catch(err => {
					console.error("fetch", err, url)
					//torrent.enabled = false
					torrent.lastError = "fetch error"
					torrent.lastAnnounce = last
				})
		})
	}

	if (fetching.length && settings.showNotification) {

		//@firefox: list not working

		chrome.notifications.create(chrome.runtime.id,
			{
				type: "list",
				iconUrl: "icons/logo.png",
				title: translate("extExtension") + " " + translate("isSeeding"),
				message: "",
				items: fetching.map(torrent => {
					return { title: torrent.tracker, message: torrent.name }
				})
			})
	}
	if (settings.active) {
		setTimeout(freeLeech, Time.MINUTE)
	}
}

/*
	context menu browser action

	firefox : Ok
	vivaldi : not working
	opera : ?
	chrome : ?

	Unchecked runtime.lastError while running contextMenus.create: Cannot create item with duplicate id browserAction

 */

// chrome.contextMenus.removeAll()

/*
chrome.contextMenus.create({
	id: "browserAction",
	title: msg("right_click_menu"),
	type:"checkbox",
	checked:settings.active,
	contexts: ["browser_action"]
},error);
*/

/*if (settings.debug) {
	chrome.contextMenus.onClicked.addListener(info => {

		// info.modified = Array<keys>


		switch (info.menuItemId) {
			case "browserAction":
				settings.active = info.checked
				updateBA()
				break

			default:
				console.error(info)
		}
	})
}*/

/**
 * update icon & enable/disable download monitoring & set tooltip
 *
 * ajout/suppression de torrent
 */
function updateBA() {
	console.debug("updateBA", settings)

	try {
		updateDownloadsMonitoring() // settings.active
		updateRewriteHeaders() // settings.active && settings.torrents.length
		freeLeech()

		let title = translate("extExtension") + " " + settings.active ? translate("enabled") : translate("disabled")
		let badge: string = ""

		if (settings.active) {
			setBAIcon("on.png")
			title += "\n\n"
			title += settings.torrents.map(torrent => `${torrent.name} ${translate("uploaded")} ${showUnit(torrent.totalUploaded)}`).join("\n")
			badge = settings.torrents.length.toString()
		}
		else {
			setBAIcon("off.png")
		}

		chrome.browserAction.setTitle(
			{
				title: title
			})

		chrome.browserAction.setBadgeText(
			{
				text: badge
			})
	}
	catch (e) {
		console.error("UpdateBA", e)
	}
}

function sendMessage(obj) {
	chrome.runtime.sendMessage(obj)
}

chrome.runtime.onMessage.addListener((msg: any, sender, res) => {
	// sender.id
	// sender.url
	//
	// res ???
	//

	//@safety
	//
	console.debug("onMessage", msg, sender)

	if (msg) {
		// "getSettings"
		if ("getSettings" in msg) {
			sendMessage({ settings: settings })
		}

		// "active" enable/disable extension
		if ("active" in msg) {
			settings.active = msg.active
			updateBA()
		}
		// "setSpeed" change speed
		if ("setSpeed" in msg) {
			settings.currentKBytesPerSeconds = msg.setSpeed
		}
		// "setClient" change current client
		if ("setClient" in msg) {
			settings.currentClient = msg.setClient
			settings.peerId = generatePeerId(settings.currentClient)
		}

		if ("updateNotif" in msg) {
			settings.showNotification = msg.updateNotif
		}

		// "updateTorrent":torrent -> enable/disable torrent

		if ("updateTorrent" in msg) {
			let t = msg.updateTorrent
			//@ugly
			let id = settings.torrents.findIndex((torrent, idx) => {
				return torrent.hash == t.hash
			})
			if (id >= 0) {
				settings.torrents[id].enabled = t.enabled
				updateBA()
			}
		}

		// "deleteTorrent":hash -> delete a torrent
		if ("deleteTorrent" in msg) {
			let hash = msg.deleteTorrent

			let id = settings.torrents.findIndex((torrent, idx) => {
				return torrent.hash == hash
			})

			console.debug("deleteTorrent", id, hash)

			if (id >= 0) {
				settings.torrents.splice(id, 1)
				sendMessage({ settings: settings })
				updateBA()
			}
		}

		//@hack @firefox

		if ("openTab" in msg) {
			let url = chrome.runtime.getURL("popup.html")

			console.debug("openTab", url)
			chrome.tabs.create(
				{
					url: url
				})
		}

		if ("upload" in msg) {

			let data = msg.upload

			//@hack:dataURL to ArrayBuffer

			fetch(data)
				.then(res => {
					return res.arrayBuffer()
				})
				.then(buffer => {
					addTorrent(buffer, "")
				})
				.catch(console.error)
		}


	}
})

/*

*/

if (settings.peerId == "") {
	settings.peerId = generatePeerId(settings.currentClient)
}

updateBA()
