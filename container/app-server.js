const fs = require('fs')

/*if (!fs.existsSync('./serverconfig.json')) {
	throw `missing serverconfig.json`
}*/

const serverconfig = require('./serverconfig.json')

if (!serverconfig.genomes) {
	serverconfig.genomes = [
		{
			name: 'hg19',
			species: 'human',
			file: './genome/hg19.js',
			datasets: [
				{
					name: 'ClinVar',
					jsfile: './dataset/clinvar.hg19.js'
				}
			]
		},
		{
			name: 'hg38',
			species: 'human',
			file: './genome/hg38.js',
			datasets: [
				{
					name: 'ClinVar',
					jsfile: './dataset/clinvar.hg38.js'
				}
			]
		}
	]
}

serverconfig.backend_only = true
fs.writeFileSync('./serverconfig.json', JSON.stringify(serverconfig, null, '   '), { charset: 'utf8' })

if (serverconfig.releaseTag) {
	console.log('Updating proteinpaint packages ...')
	spawnSync('npm', ['update', `@stjude/proteinpaint-server@${releaseTag}`], { encoding: 'utf-8' })
}

require('@stjude/proteinpaint-server')
