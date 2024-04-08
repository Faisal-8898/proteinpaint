import { mclasscolor2table } from '#src/client'
import { dofetch3 } from '#common/dofetch'
import * as common from '#shared/common'
import * as coord from '#src/coord'

/*
ui only works for gm mode

TODO
- allow it to for genomic mode too, so can input custom data for 
- unit test
- reuse ui on appdrawer card
*/

export default function (block) {
	if (!block.usegm) {
		return
	}
	const div = block.tip.d.append('div').style('margin', '20px')

	div.append('p').text(`Add mutation and/or fusion to show over ${block.usegm.name} ${block.usegm.isoform}`)

	const ta = div.append('textarea').attr('cols', '50').attr('rows', '5').property('placeholder', 'Enter data')

	const nameinput = div
		.append('div')
		.append('input')
		.attr('type', 'text')
		.style('width', '130px')
		.property('placeholder', 'Dataset name')

	const row = div.append('div').style('margin-top', '5px')
	const select = row.append('select')
	select.append('option').text('Codon position')
	select.append('option').text('RNA position')
	select.append('option').text('Genomic position')
	row
		.append('button')
		.style('margin-left', '5px')
		.text('Submit')
		.on('click', async () => {
			const v = ta.property('value')
			if (v == '') return
			says.style('display', 'none')
			const selecti = select.node().selectedIndex,
				mlst = [],
				bad = []

			for (const line0 of v.trim().split('\n')) {
				const line = line0.trim()
				if (!line) continue // skip empty line
				const l = line.split(line.includes('\t') ? '\t' : ',')

				// guess type of data for each line by the number of fields

				try {
					let m
					if (l.length == 6 || l.length == 7) {
						// sv or fusion
						m = {
							class: common.mclassfusionrna,
							dt: common.dtfusionrna
							// compute and assign gene1/2, chr1/2, pos1/2
						}
						if (l[6]) m.sample = l[6] // line has optional sample

						const [gene1, isoform1, pos1, gene2, isoform2, pos2] = l
						if (!gene1) throw 'gene1 is missing'
						if (!gene2) throw 'gene2 is missing'
						if (!isoform1) throw 'isoform1 is missing'
						if (!isoform2) throw 'isoform2 is missing'
						if (!pos1) throw 'pos1 is missing'
						if (!pos2) throw 'pos2 is missing'

						// chr and coordinate of each breakpoint are not given. to compute, require one of gene1/2 to be block.usegm and query server to fetch gmlst for the other one
						{
							const d = await dofetch3('genelookup', { body: { deep: 1, genome: block.genome.name, input: gene1 } })
							if (d.error) throw 'invalid gene1'
							const gm = d.gmlst.find(i => i.isoform == isoform1)
							if (!gm) throw 'invalid isoform1'
							m.gene1 = gene1
							m.chr1 = gm.chr
							const o = parsePositionFromGm(selecti, pos1, gm)
							m.pos1 = o[1]
							m.strand1 = gm.strand
						}
						{
							const d = await dofetch3('genelookup', { body: { deep: 1, genome: block.genome.name, input: gene2 } })
							if (d.error) throw 'invalid gene2'
							const gm = d.gmlst.find(i => i.isoform == isoform2)
							if (!gm) throw 'invalid isoform2'
							m.gene2 = gene2
							m.chr2 = gm.chr
							const o = parsePositionFromGm(selecti, pos2, gm)
							m.pos2 = o[1]
							m.strand2 = gm.strand
						}
					} else if (l.length == 3 || l.length == 4) {
						// mutation
						const _class = l[2].trim()
						if (!common.mclass[_class]) throw 'invalid mutation class'
						m = {
							class: _class,
							dt: common.dtsnvindel,
							isoform: block.usegm.isoform,
							mname: l[0].trim()
						}
						if (!m.mname) throw 'missing mutation name'
						const o = parsePositionFromGm(selecti, l[1].trim(), block.usegm)
						m.chr = o[0]
						m.pos = o[1]
						if (l[3]) m.sample = l[3] // line has optional sample
					} else {
						throw 'is not either mutation or fusion'
					}
					mlst.push(m)
				} catch (e) {
					bad.push(line + ': ' + (e.message || e))
				}
			}
			if (bad.length) {
				says.style('display', 'block').text('Rejected: ' + bad.join('\n'))
			}
			if (mlst.length == 0) return
			const tk = block.block_addtk_template({
				type: 'mds3',
				name: nameinput.property('value') || 'Custom data',
				iscustom: true,
				custom_variants: mlst
			})
			block.tk_load(tk)
		})
	row
		.append('button')
		.text('Clear')
		.style('margin-left', '5px')
		.on('click', () => {
			ta.property('value', '')
			nameinput.property('value', '')
		})

	// div to show bad lines after parsing
	const says = div.append('div').style('display', 'none', 'margin-top', '20px')

	showSnvindelHelp(div)
	showSvfusionHelp(div)
}

/*
args:
	selecti=int
		0= str value should be codon
		1= str value should be rna position
		2= str value should be chromosomal position
	str=string
		input string to be cast into a number and used above
	gm={}
		gene model for a specific isoform, to map the given position against it and return chr/pos
returns:
	[chr, pos]
throws on any err
*/
function parsePositionFromGm(selecti, str, gm) {
	const value = Number(str)
	if (!Number.isInteger(value)) throw 'position is not integer'
	if (selecti == 0) {
		const p = coord.aa2gmcoord(value, gm)
		if (p == null) throw 'cannot convert codon to genomic position'
		return [gm.chr, p]
	}
	if (selecti == 1) {
		const p = coord.rna2gmcoord(value, block.usegm)
		if (p == null) throw 'cannot convert RNA position to genomic position'
		return [gm.chr, p]
	}
	if (selecti == 2) {
		return [gm.chr, value - 1]
	}
	throw 'unknown selecti'
}
// instructions for mutation
function showSnvindelHelp(div) {
	const p = div.append('p')
	p.append('span').text('Mutation format: mutation name, position, class, sample').style('opacity', 0.6)
	p.append('span')
		.attr('class', 'sja_clbtext')
		.style('margin-left', '10px')
		.text('Show details')
		.on('click', event => {
			const show = infodiv1.style('display') == 'none'
			infodiv1.style('display', show ? '' : 'none')
			event.target.innerHTML = show ? 'Hide details' : 'Show details'
		})
	const infodiv1 = div
		.append('div')
		.style('display', 'none')
		.style('margin-left', '20px')
		.style('padding-left', '10px')
		.style('border-left', 'solid 1px black')
		.style('color', '#858585')
		.html(
			`One mutation per line. Fields are joined by tab or comma:
		<ol>
			<li>Mutation name, can be any string</li>
			<li>Mutation position</li>
			<li>Mutation class code</li>
			<li>Optional sample name</li>
		</ol>
		Position types:
		<ul><li>Codon position: integer, 1-based (do not use for noncoding gene)</li>
		<li>RNA position: integer, 1-based, beginning from transcription start site</li>
		<li>Genomic position: chromosome name and 1-based coordinate joined by colon, e.g. chr1:2345</li></ul>`
		)
	mclasscolor2table(infodiv1.append('table').style('margin-top', '3px'), true)
}

function showSvfusionHelp(div) {
	const p = div.append('p')
	p.append('span')
		.style('opacity', 0.6)
		.text('SV/fusion format: gene1, isoform1, position1, gene2, isoform2, position2, sample')
	p.append('span')
		.attr('class', 'sja_clbtext')
		.style('margin-left', '10px')
		.text('Show details')
		.on('click', event => {
			const show = infodiv2.style('display') == 'none'
			infodiv2.style('display', show ? '' : 'none')
			event.target.innerHTML = show ? 'Hide details' : 'Show details'
		})
	const infodiv2 = div
		.append('div')
		.style('display', 'none')
		.style('margin-left', '20px')
		.style('padding-left', '10px')
		.style('border-left', 'solid 1px black')
		.style('color', '#858585')
		.html(
			`Limited to two-gene fusion products.<br>
		One product per line.<br>
		Each line has six fields joined by tab or comma:
		<ol><li>N-term gene symbol</li>
		<li>N-term gene isoform</li>
		<li>N-term gene break-end position</li>
		<li>C-term gene symbol</li>
		<li>C-term gene isoform</li>
		<li>C-term gene break-end position</li>
		<li>Optional sample name</li>
		</ol>
		Break-end position types:
		<ul><li>Codon position: integer, 1-based</li>
		<li>RNA position: integer, 1-based, beginning from transcription start site</li>
		<li>Genomic position: chromosome name and 1-based coordinate joined by colon, e.g. chr1:2345</li></ul>
		Either one of the isoforms must be already displayed.`
		)
}

// itd not enabled
function customdataui_itd(block, x, y) {
	block.tip.clear()
	const div = block.tip.d.append('div').style('margin', '25px')
	div.append('p').text('ITD events of ' + block.usegm.name + ' (' + block.genome.name + ')')
	div
		.append('p')
		.style('font-size', '.9em')
		.html('<span style="font-size:.8em;color:#aaa">FORMAT</span> position1 ; position2/span')
	const ta = div.append('textarea').attr('cols', '20').attr('rows', '5')

	const nameinput = div
		.append('div')
		.append('input')
		.attr('type', 'text')
		.style('width', '130px')
		.property('placeholder', 'Dataset name')

	const row = div.append('div').style('margin-top', '5px')
	const select = row.append('select')
	select.append('option').text('RNA position and basepair length of duplication')
	select.append('option').text('Genomic start and stop position')
	row
		.append('button')
		.style('margin-left', '5px')
		.text('Submit')
		.on('click', () => {
			const v = ta.property('value')
			if (v == '') return
			says.style('display', 'none')
			const mlst = []
			const bad = []
			for (const line of v.trim().split('\n')) {
				const l = line.split(';')
				if (l.length != 2) {
					bad.push(line + ': not two fields')
					continue
				}
				const selecti = select.node().selectedIndex
				const m = {
					class: common.mclassitd,
					dt: common.dtitd,
					isoform: block.usegm.isoform,
					mname: 'ITD'
				}
				if (selecti == 0) {
					m.rnaposition = Number.parseInt(l[0].trim())
					if (Number.isNaN(m.rnaposition)) {
						bad.push(line + ': RNA position is not integer')
						continue
					}
					m.rnaduplength = Number.parseInt(l[1].trim())
					if (Number.isNaN(m.rnaduplength)) {
						bad.push(line + ': duplication length is not integer')
						continue
					}
				} else if (selecti == 1) {
					const pos1 = Number.parseInt(l[0].trim())
					if (Number.isNaN(pos1)) {
						bad.push(line + ': genomic start position is not integer')
						continue
					}
					const pos2 = Number.parseInt(l[1].trim())
					if (Number.isNaN(pos2)) {
						bad.push(line + ': genomic stop position is not integer')
						continue
					}
					let t = coord.genomic2gm(pos1, block.usegm)
					const rnapos1 = Math.ceil(t.rnapos)
					t = coord.genomic2gm(pos2, block.usegm)
					const rnapos2 = Math.ceil(t.rnapos)
					m.rnaposition = Math.min(rnapos1, rnapos2)
					m.rnaduplength = Math.abs(rnapos1 - rnapos2)
				}
				mlst.push(m)
			}
			if (bad.length) {
				says.style('display', 'block').text('Rejected: ' + bad.join('\n'))
			}
			if (mlst.length == 0) return
			const ds = {
				bulkdata: {},
				iscustom: true
			}
			ds.bulkdata[block.usegm.name.toUpperCase()] = mlst
			const label = nameinput.property('value') || 'custom ITD'
			ds.label = label
			let i = 0
			while (block.ownds[ds.label]) {
				ds.label = label + ' ' + ++i
			}
			block.ownds[ds.label] = ds
			//block.dshandle_new(ds.label)
			const tk = block.block_addtk_template({ type: 'dataset', ds: ds })
			block.tk_load(tk)
		})
	row
		.append('button')
		.text('Clear')
		.style('margin-left', '5px')
		.on('click', () => {
			ta.property('value', '')
			nameinput.property('value', '')
		})
	const says = div.append('div').style('display', 'none', 'margin-top', '20px')
	div
		.append('div')
		.style('margin-top', '20px')
		.style('color', '#858585')
		.html(
			`One ITD per line.<br>
Each line has two integer values joined by <strong>semicolon</strong>.<br>
Position types:
<li>RNA position: integer, 1-based, beginning from transcription start site. Span of duplication is number of bases in the RNA.</li>
<li>Genomic position: start and stop position of the ITD</li>`
		)
}

// not enabled
function customdataui_del(block, x, y) {
	block.tip.clear()
	const div = block.tip.d.append('div').style('margin', '25px')
	div.append('p').text('Deletion events of ' + block.usegm.name + ' (' + block.genome.name + ')')
	div
		.append('p')
		.style('font-size', '.9em')
		.html('<span style="font-size:.8em;color:#aaa">FORMAT</span> position1 ; position2/span')
	const ta = div.append('textarea').attr('cols', '20').attr('rows', '5')

	const nameinput = div
		.append('div')
		.append('input')
		.attr('type', 'text')
		.style('width', '130px')
		.property('placeholder', 'Dataset name')

	const row = div.append('div').style('margin-top', '5px')
	const select = row.append('select')
	select.append('option').text('RNA position and basepair length of deletion')
	select.append('option').text('Genomic start and stop position')
	row
		.append('button')
		.style('margin-left', '5px')
		.text('Submit')
		.on('click', () => {
			const v = ta.property('value')
			if (v == '') return
			says.style('display', 'none')
			const mlst = []
			const bad = []
			for (const line of v.trim().split('\n')) {
				const l = line.split(';')
				if (l.length != 2) {
					bad.push(line + ': not two fields')
					continue
				}
				const selecti = select.node().selectedIndex
				const m = {
					class: common.mclassdel,
					dt: common.dtdel,
					isoform: block.usegm.isoform,
					mname: 'DEL'
				}
				if (selecti == 0) {
					m.rnaposition = Number.parseInt(l[0].trim())
					if (Number.isNaN(m.rnaposition)) {
						bad.push(line + ': RNA position is not integer')
						continue
					}
					m.rnadellength = Number.parseInt(l[1].trim())
					if (Number.isNaN(m.rnaduplength)) {
						bad.push(line + ': deletion length is not integer')
						continue
					}
				} else if (selecti == 1) {
					const pos1 = Number.parseInt(l[0].trim())
					if (Number.isNaN(pos1)) {
						bad.push(line + ': genomic start position is not integer')
						continue
					}
					const pos2 = Number.parseInt(l[1].trim())
					if (Number.isNaN(pos2)) {
						bad.push(line + ': genomic stop position is not integer')
						continue
					}
					let t = coord.genomic2gm(pos1, block.usegm)
					const rnapos1 = Math.ceil(t.rnapos)
					t = coord.genomic2gm(pos2, block.usegm)
					const rnapos2 = Math.ceil(t.rnapos)
					m.rnaposition = Math.min(rnapos1, rnapos2)
					m.rnadellength = Math.abs(rnapos1 - rnapos2)
				}
				mlst.push(m)
			}
			if (bad.length) {
				says.style('display', 'block').text('Rejected: ' + bad.join('\n'))
			}
			if (mlst.length == 0) return
			const ds = {
				bulkdata: {},
				iscustom: true
			}
			ds.bulkdata[block.usegm.name.toUpperCase()] = mlst
			const label = nameinput.property('value') || 'custom deletion'
			ds.label = label
			let i = 0
			while (block.ownds[ds.label]) {
				ds.label = label + ' ' + ++i
			}
			block.ownds[ds.label] = ds
			//block.dshandle_new(ds.label)
			const tk = block.block_addtk_template({ type: 'dataset', ds: ds })
			block.tk_load(tk)
		})
	row
		.append('button')
		.text('Clear')
		.style('margin-left', '5px')
		.on('click', () => {
			ta.property('value', '')
			nameinput.property('value', '')
		})
	const says = div.append('div').style('display', 'none', 'margin-top', '20px')
	div
		.append('div')
		.style('margin-top', '20px')
		.style('color', '#858585')
		.html(
			`One deletion per line.<br>
Each line has two integer values joined by <strong>semicolon</strong>.<br>
Position types:
<ul>
<li>RNA position: integer, 1-based, beginning from transcription start site. Span of deletion is number of bases in the RNA.</li>
<li>Genomic position: start and stop position of the deletion</li></ul>`
		)
}
