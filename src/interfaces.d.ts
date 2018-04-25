
declare interface Message {
	from: string
	message: any
}

declare interface Client {
	userAgent: string
	clientName: string
	clientId: number
	prefix: string
}

declare interface Settings {
	debug: boolean

	active: boolean
	torrents: Array<Torrent>
	currentClient: number
	peerId: string
	currentKBytesPerSeconds: number
	showNotification: boolean
}

interface Torrent {
	pageURL: string | null
	announceURL: string
	hash: string
	name: string
	totalUploaded: number
	started: Date
	enabled: boolean
	seeders: number
	leechers: number
	lastAnnounce: number
	interval: number
	size: number
	tracker: string

	lastError: string
}

declare namespace chrome {
	namespace downloads {
		interface DownloadItem {
			finalUrl?: string
		}
	}
}
