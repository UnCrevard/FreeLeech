import { translate } from "./module_i18n"

export enum Bytes {
	KILO = 1024,
	KBITS = 8192,
	MEGA = 1048576,
	MBITS = 8388608,
	GIGA = 1073741824,
	GBITS = 8589934592
}

export enum Time {
	MILLI = 1,
	SECOND = 1000,
	MINUTE = 60000,
	HOUR = 3600000
}

// @todo:translation

export function showUnit(val: number) {
	if (val < Bytes.KILO)
		return val + translate("bytes")
	else if (val < Bytes.MEGA)
		return (val / Bytes.KILO | 0) + " KB";
	else if (val < Bytes.GIGA)
		return (val / Bytes.MEGA | 0) + " MB";
	else
		return (val / Bytes.GIGA | 0) + " GB";
}

export function isChrome(): boolean {
	// moz-extension
	// chrome-extension
	return chrome.runtime.getURL("").split("-")[0] == "chrome"
}
console.log("utils loaded")
