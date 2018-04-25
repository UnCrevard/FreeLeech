export function translate(msg: string) {
	let txt = chrome.i18n.getMessage(msg.toLowerCase())

	console.assert(txt, "i18n missing : " + msg)

	return txt || "?" + msg + "?";
}

console.log("i18n loaded")
