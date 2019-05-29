const fs = require("fs")
const {isCached}=require("./helpers.js")

const log = console.log

const source_filename = "./translations.txt"
const dstDir = "dist/_locales/"

isCached(source_filename,"dist/_locales/en/messages.json",cached=>
{
	if (cached)
	{
		return
	}

	let lines = fs.readFileSync(source_filename).toString().split(/\r?\n/)
	let languages = lines.splice(0, 1)[0].split(",")

	let locales = []

	languages.forEach(language => locales.push({}))

	for (let line of lines) {
		if (line.length && line[0] != "#") {
			let m = line.split(/(.+)\:(.+)/)

			if (m) {
				let traductions = m[2].split("|")

				if (traductions.length > languages.length) {
					throw "too many translations " + line
				}
				else if (traductions.length<languages.length)
				{
					// @hack
					traductions[1]=traductions[0]
					log(traductions)
				}

				let language = 0

				for (let traduction of traductions) {
					locales[language][m[1]] = { message: traduction }
					language++
				}
			}
		}
	}

	for (let i = 0; i < languages.length; i++) {
		let path = `${dstDir}${languages[i]}/`

		fs.mkdir(path, err => {
			let data = JSON.stringify(locales[i], null, "\t")
			fs.writeFile(path + "messages.json", data, err => {
				if (err) {
					throw err;
				}
				else {
					log(path, "created")
				}

			})
		})
	}
})
