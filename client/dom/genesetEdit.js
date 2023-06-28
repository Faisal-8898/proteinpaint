import { addGeneSearchbox } from '#dom/genesearch'
import { Menu } from '#dom/menu'
import { select } from 'd3-selection'

export function showGenesetEdit({ x, y, menu, genome, callback, geneList = [], vocabApi, name = null }) {
	const api = {
		dom: {
			tdbBtns: {}
		},
		params: [],
		destroy(_obj) {
			const obj = _obj || api.dom
			for (const key in obj) {
				if (key == 'holder') continue
				else if (key == 'tdbBtns') {
					api.destroy(obj[key])
				} else {
					obj[key].remove()
				}
				delete obj[key]
			}
			if (obj.holder) obj.holder.remove()
		}
	}
	const tip2 = new Menu({ padding: '0px' })

	const div = menu.d.append('div').style('width', '850px').style('padding', '5px')
	if (name) div.append('div').style('padding', '5px').append('span').style('color', '#aaa').text(name)

	api.dom.holder = div

	const headerDiv = div.append('div')

	const inputSearch = addGeneSearchbox({
		tip: tip2,
		genome,
		row: headerDiv,
		geneOnly: true,
		callback: addGene,
		hideHelp: true
	})

	const rightDiv = headerDiv
		.append('div')
		.style('display', 'inline-flex')
		.style('align-items', 'center')
		.style('float', 'right')
		.style('gap', '5px')
	if (vocabApi.termdbConfig?.queries?.topMutatedGenes) {
		for (const param of vocabApi.termdbConfig.queries.topMutatedGenes.arguments) addParameter(param)
		api.dom.loadBt = rightDiv
			.append('button')
			.html(`Load top mutated genes`)
			.on('click', async event => {
				let args = {
					genome: genome.name,
					filter0: vocabApi.state.termfilter.filter0
				}
				for (const input of api.params) {
					const id = input.attr('id')
					args[id] = getInputValue(input)
				}
				const result = await vocabApi.getTopMutatedGenes(args)
				geneList = []
				for (const gene of result.genes) geneList.push({ name: gene })
				renderGenes()
			})
	} else if (vocabApi.termdbConfig?.queries?.topVariablyExpressedGenes) {
		for (const param of vocabApi.termdbConfig.topVariablyExpressedGenes.arguments) addParameter(param)
		rightDiv
			.append('button')
			.html(`Load top expressed genes`)
			.on('click', async event => {})
	}
	if (genome?.termdbs?.msigdb) {
		for (const key in genome.termdbs) {
			const tdb = genome.termdbs[key]
			api.dom.tdbBtns[key] = rightDiv
				.append('button')
				.attr('name', 'msigdbBt')
				.html(`Load ${tdb.label} gene set &#9660;`)
				.on('click', async event => {
					tip2.clear()
					const termdb = await import('../termdb/app')
					termdb.appInit({
						holder: tip2.d,
						state: {
							dslabel: key,
							genome: genome.name,
							nav: {
								header_mode: 'search_only'
							}
						},
						tree: {
							click_term: term => {
								geneList = []
								const geneset = term._geneset
								if (geneset) {
									for (const gene of geneset) geneList.push({ name: gene.symbol })
									renderGenes()
								}
								//menu.hide()
								tip2.hide()
							}
						}
					})
					tip2.showunder(api.dom.tdbBtns[key].node())
				})
		}
	}

	api.dom.clearBtn = rightDiv
		.append('button')
		.property('disabled', !geneList.length)
		.text('Clear')
		.on('click', () => {
			geneList = []
			renderGenes()
		})

	const genesDiv = div
		.append('div')
		.style('display', 'flex')
		.style('flex-wrap', 'wrap')
		.style('gap', '5px')
		.style('min-height', '20px')
		.style('border-style', 'solid')
		.style('border-width', '2px')
		.style('border-color', '#eee')
		.style('margin', '10px 0px')
		.style('padding', '2px 0px')
		.style('min-height', '30px')

	api.dom.genesDiv = genesDiv

	const submitBtn = div
		.append('div')
		.append('button')
		.property('disabled', !geneList.length)
		.text('Submit')
		.on('click', () => {
			menu.hide()
			callback(geneList)
		})

	api.dom.submitBtn = submitBtn

	menu.show(x, y, false, true)

	function renderGenes() {
		genesDiv.selectAll('*').remove()

		const spans = genesDiv.selectAll('span').data(geneList)
		spans
			.enter()
			.append('div')
			.attr('title', 'click to delete')
			.attr('class', 'sja_menuoption')
			.style('position', 'relative')
			.style('display', 'inline-block')
			.style('padding', '5px 16px 5px 9px')
			.style('margin-left', '5px')
			.text(gene => gene.name)
			.on('click', deleteGene)
			.on('mouseover', function (event) {
				const div = select(this)
				div
					.append('div')
					.style('margin-left', '4px')
					.classed('sjpp_deletebt', true)
					.style('vertical-align', 'middle')
					.style('display', 'inline-block')
					.style('position', 'absolute')
					.style('right', '0px')
					.style('transform', 'scale(0.6)')
					.style('pointer-events', 'none')
					.html(
						`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#000" class="bi bi-x-lg" viewBox="0 0 16 16">
				<path stroke='#f00' d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
				</svg>`
					)
			})
			.on('mouseout', function (event) {
				select(this).select('.sjpp_deletebt').remove()
			})

		api.dom.submitBtn.property('disabled', !geneList.length)
		api.dom.clearBtn.property('disabled', !geneList.length)
	}

	function addGene() {
		const name = inputSearch.geneSymbol
		geneList.push({ name })
		renderGenes()
	}

	function deleteGene(event, d) {
		const i = geneList.findIndex(g => g.name === d.name)
		if (i != -1) {
			geneList.splice(i, 1)
			renderGenes()
		}
	}

	function addParameter(param) {
		let input
		if (param.type == 'boolean') {
			input = rightDiv.append('input').attr('type', 'checkbox').attr('id', param.id)
			if (param.value) input.property('checked', param.value)
			rightDiv.append('label').html(param.label).attr('for', param.id)
		} else if (param.type == 'number') {
			input = rightDiv.append('input').attr('type', 'number').style('width', '40px').attr('id', param.id)
			if (param.value) input.attr('value', param.value)
			rightDiv.append('span').html(param.label)
		}
		api.params.push(input)
	}

	function getInputValue(input) {
		const value = input.node().value
		if (input.attr('type') == 'number') return Number(value)
		if (input.attr('type') == 'checkbox') return input.node().checked ? 1 : 0
	}

	renderGenes()
	return api
}
