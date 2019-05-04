import { translate } from "../modules/module_i18n"
import { showUnit, isChrome } from "../modules/module_utils"
import { Clients } from "../modules/module_bittorent"
import Vue from "vue"
import ParseTorrentFile from "parse-torrent-file"

// <p v-i18n:keyword></p>

Vue.directive("i18n", function() {
	//(this.el as HTMLElement).textContent += translate(this.arg)
	this.el.insertBefore(document.createTextNode(translate(this.arg)), this.el.firstChild)
})

//@hack

function duplicateVueObject(obj) {
	return Object.assign({}, obj)
}

const data =
	{
		clients: Clients,
		currentClient: 0,
		active: false,
		showNotification: false,
		currentKBytesPerSeconds: 0,
		torrents: [] as Array<Torrent>
	}

const vm = new Vue(
	{
		el: "#app",
		data,
		methods:
			{
				i18n(msg) {
					return translate(msg)
				},
				updateSpeed() {
					chrome.runtime.sendMessage({ setSpeed: this.currentKBytesPerSeconds })
				},
				updateActive() {
					this.active = !this.active
					chrome.runtime.sendMessage({ active: this.active })
				},
				updateNotif() {
					this.showNotification = !this.showNotification
					chrome.runtime.sendMessage({ updateNotif: this.showNotification })
				},
				updateClient() {
					chrome.runtime.sendMessage({ setClient: this.currentClient })
				},
				updateTorrent(torrent: Torrent) {
					torrent.enabled = !torrent.enabled
					chrome.runtime.sendMessage({ updateTorrent: duplicateVueObject(torrent) })
				},
				deleteTorrent(torrent) {
					chrome.runtime.sendMessage({ deleteTorrent: torrent.hash })
				},
				showUnit(val: number) {
					return showUnit(val)
				},
				percentCompleted(torrent: Torrent) {
					return (torrent.totalUploaded / torrent.size * 100).toFixed(2)
				},
				clickUpload(...args) {
					document.getElementById("upload").click()
				},
				/* @firefox fix */

				openTab() {

					/* open extension in a tab. firefox can't import inside a popup @hack */

					chrome.tabs.create(
						{
							url: window.location.href
						}, tab => {
							window.close()
						})
				},
				isTabOpened() {
					return chrome.extension.getViews({ type: "tab" }).length != 0
				},
				isInsideTab() {
					let tabs = chrome.extension.getViews({ type: "tab" })

					return tabs.some(w => {
						console.log("isInsideTab", w === window, w)
						return w === window
					})
				},
				isChrome() {
					return isChrome()
				},
				uploadFile(event) {

					// .target.files
					// .target.value

					console.debug(event.target)

					const files = event.target.files as Array<File>

					for (let file of files) {

						if (file.type == "application/x-bittorrent") {

							let reader = new FileReader()

							reader.readAsDataURL(file)

							reader.onload = (e: any) => {

								chrome.runtime.sendMessage(
									{
										upload: e.target.result // string
									})
							}
						}
						else {
							//@todo:wrong file type
						}
					}
				}
			}
	})

chrome.runtime.onMessage.addListener((msg, sender, res) => {
	console.debug("recv", JSON.stringify(msg))

	if (msg.settings) {
		let settings: Settings = msg.settings
		data.active = settings.active
		data.currentKBytesPerSeconds = settings.currentKBytesPerSeconds
		data.currentClient = settings.currentClient
		data.torrents = settings.torrents
		data.showNotification = settings.showNotification
	}
})

chrome.runtime.sendMessage(
	{
		getSettings: true
	})
