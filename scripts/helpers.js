const fs = require("fs")
const minify = require("minify")
const path = require("path")

function isCached(src, dst, cb) {

	console.log(src,dst)

	cb(false)

	if (cb) return

	fs.stat(src, (err, srcStats) => {
		if (err) throw src, err

		fs.stat(dst, (err, dstStats) => {

			if (err && err.errno != -4058) throw src, err;

			cb(err == null && (srcStats.mtime < dstStats.mtime))
		})
	})
}

function minifyDir(srcDir, dstDir) {
	let files = fs.readdirSync(srcDir)

	files.map(file => {
		let src = path.join(srcDir, file)
		let dst = path.join(dstDir, file)

		isCached(src, dst, async cached => {

			if (cached==false) {

				let data=await minify(src)

				fs.writeFile(dst, data, err => {

					if (err) throw "minifiying", src, err;

						console.log("minified", dst)
					})
			}
		})
	})
}


module.exports =
	{
		isCached: isCached,
		minifyDir: minifyDir
	}
