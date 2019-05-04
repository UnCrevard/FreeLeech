const URICHARS = [
	"%00", "%01", "%02", "%03", "%04", "%05", "%06", "%07", "%08", "%09", "%0a", "%0b", "%0c", "%0d", "%0e", "%0f",
	"%10", "%11", "%12", "%13", "%14", "%15", "%16", "%17", "%18", "%19", "%1a", "%1b", "%1c", "%1d", "%1e", "%1f",

	"%20", "!", "%22", "%23", "%24", "%25", "%26", "%27", // '
	"(", ")", "*", "%2b", "%2c", "-", ".", "%2f",
	"0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
	"%3a", "%3b", "%3c", "%3d", "%3e", "%3f", "%40",
	"a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
	"%5b", "%5c", "%5d", "%5e", "_", "%60",
	"A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
	"%7b", "%7c", "%7d", "~", "%7f",

	"%80", "%81", "%82", "%83", "%84", "%85", "%86", "%87", "%88", "%89", "%8a", "%8b", "%8c", "%8d", "%8e", "%8f",
	"%90", "%91", "%92", "%93", "%94", "%95", "%96", "%97", "%98", "%99", "%9a", "%9b", "%9c", "%9d", "%9e", "%9f",
	"%a0", "%a1", "%a2", "%a3", "%a4", "%a5", "%a6", "%a7", "%a8", "%a9", "%aa", "%ab", "%ac", "%ad", "%ae", "%af",
	"%b0", "%b1", "%b2", "%b3", "%b4", "%b5", "%b6", "%b7", "%b8", "%b9", "%ba", "%bb", "%bc", "%bd", "%be", "%bf",
	"%c0", "%c1", "%c2", "%c3", "%c4", "%c5", "%c6", "%c7", "%c8", "%c9", "%ca", "%cb", "%cc", "%cd", "%ce", "%cf",
	"%d0", "%d1", "%d2", "%d3", "%d4", "%d5", "%d6", "%d7", "%d8", "%d9", "%da", "%db", "%dc", "%dd", "%de", "%df",
	"%e0", "%e1", "%e2", "%e3", "%e4", "%e5", "%e6", "%e7", "%e8", "%e9", "%ea", "%eb", "%ec", "%ed", "%ee", "%ef",
	"%f0", "%f1", "%f2", "%f3", "%f4", "%f5", "%f6", "%f7", "%f8", "%f9", "%fa", "%fb", "%fc", "%fd", "%fe", "%ff"]

const VALIDCHARS = "!0123456789abcdefghijklmnopqrstuvwxyz_ABCDEFGHIJKLMNOPQRSTUVWXYZ~"

//@todo
export const Clients: Array<Client> =
	[
		{
			clientName: "qBittorrent",
			clientId: 0,
			userAgent: "qBittorrent/4.0.2",
			prefix: "-qB4020-"
		},
		{
			//# convention: -TR MAJOR MINOR MAINT STATUS - (each a single char)
			//# STATUS: "X" for prerelease beta builds,
			//#         "Z" for unsupported trunk builds,
			//#         "0" for stable, supported releases
			//# these should be the only two lines you need to change

			//Transmission/1.32 (6455) — Official 1.32 release
			//Transmission/1.32+ (6499) — Nightly build between 1.32 and 1.33
			//set(TR_USER_AGENT_PREFIX "2.93+")
			//set(TR_PEER_ID_PREFIX "-TR293Z-")

			clientName: "Transmission",
			clientId: 1,
			userAgent: "Transmission/2.93+",
			//-TR1330- — Official 1.33 release
			//-TR133Z- — Nightly build between 1.33 and 1.34
			//-TR133X- — Beta release of 1.34

			prefix: "-TR293Z-"
		}
		// uTorrent
		// bitcomet
		// ...
	]

/*

encode buffer to URIChar

*/

export function encodeBufferToURIChar(buffer: Buffer): string {
	let result = ""

	for (let byte of buffer) {
		result += URICHARS[byte]
	}

	return result
}
/*

encode hash to lowercased string

hack to fix bug

*/

export function encode_hash(hash: string): string {

	console.assert(hash.length == 40, "hash too long")

	return hash.match(/.{1,2}/g).map(x=>"%"+x).join("")
/*
	//@node
	let buffer = Buffer.from(hash, "hex")

	return encodeBufferToURIChar(buffer).toLowerCase()
*/
}

/*

	32 bits hex string

*/
export function generateKey() {
	return Math.trunc((Math.random() * 2 ** 32)).toString(16).toUpperCase()
}

export function generatePeerId(client: number) {
	let peerId = Clients[client].prefix

	for (let i = 0; i < 12; i++) {
		peerId += VALIDCHARS[Math.trunc(VALIDCHARS.length * Math.random())]
	}

	return peerId
}
