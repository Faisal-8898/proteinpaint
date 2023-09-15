import { getCompInit, copyMerge } from '#rx'
import { select } from 'd3-selection'
import { controlsInit } from './controls'

const root_ID = 'root'

class SampleView {
	constructor(opts) {
		this.opts = opts
		this.type = 'sampleView'
		this.setDom(opts)
		setInteractivity(this)
		setRenderers(this)
	}

	setDom(opts) {
		const div = opts.holder.append('div')
		const controlsDiv = div.insert('div').style('display', 'inline-block')
		const mainDiv = div.insert('div').style('display', 'inline-block')
		const rightDiv = div.append('div').style('display', 'inline-block')
		const sampleDiv = mainDiv.insert('div').style('display', 'inline-block').style('padding', '20px')
		const sampleLabel = sampleDiv.insert('label').style('vertical-align', 'top').html('Sample:')

		const tableDiv = mainDiv.insert('div').style('padding', '10px')
		const table = tableDiv.append('table').style('border-collapse', 'collapse')
		const thead = table.append('thead')
		this.dom = {
			header: opts.header,
			holder: opts.holder,
			controlsDiv,
			mainDiv,
			sampleDiv,
			tableDiv,
			table,
			thead,
			theadrow: thead.append('tr'),
			tbody: table.append('tbody'),
			contentDiv: mainDiv.insert('div'),
			rightDiv,
			sampleLabel,
			select: sampleDiv.insert('select').style('margin', '0px 5px')
		}
		sampleDiv
			.insert('button')
			.style('vertical-align', 'top')
			.text('Download data')
			.on('click', e => {
				this.downloadData()
			})
		this.dom.messageDiv = sampleDiv
			.insert('div')
			.style('display', 'inline-block')
			.style('display', 'none')
			.style('vertical-align', 'top')
			.html('&nbsp;&nbsp;Downloading data ...')
	}

	async init(appState) {
		const state = this.getState(appState)
		const config = appState.plots.find(p => p.id === this.id)
		this.termsByCohort = {}

		const div = this.dom.sampleDiv
		if (config.samples) this.dom.sampleLabel.html('Samples:')
		await this.setSampleSelect(config, div)
	}

	async setSampleSelect(config, div) {
		if (config.samples) {
			const select = this.dom.select.property('multiple', true).attr('id', 'select')
			select
				.selectAll('option')
				.data(config.samples)
				.enter()
				.append('option')
				.attr('value', d => d.sampleId)
				.html((d, i) => d.sampleName)
			select.on('change', e => {
				const options = select.node().options
				const samples = []
				for (const option of options)
					if (option.selected) {
						const sampleId = Number(option.value)
						const sampleName = config.samples.find(s => s.sampleId == sampleId).sampleName
						const sample = { sampleId, sampleName }
						samples.push(sample)
					}
				this.app.dispatch({ type: 'plot_edit', id: this.id, config: { samples } })
			})
		} else {
			this.sampleId2Name = await this.app.vocabApi.getAllSamples()
			const samples = Object.entries(this.sampleId2Name)
			this.sample = config.sample || { sampleId: samples[0][0], sampleName: samples[0][1] }
			this.dom.select
				.selectAll('option')
				.data(samples)
				.enter()
				.append('option')
				.attr('value', d => d[0])
				.property('selected', d => d[0] == this.sample.sampleId)
				.html((d, i) => d[1])
			this.dom.select.on('change', e => {
				const sampleId = this.dom.select.node().value
				const sampleName = this.sampleId2Name[sampleId]
				this.sample = { sampleId, sampleName }
				this.app.dispatch({ type: 'plot_edit', id: this.id, config: { sample: this.sample } })
			})
		}
	}

	getState(appState) {
		const config = appState.plots?.find(p => p.id === this.id)
		const q = appState.termdbConfig.queries
		const hasPlots = q ? q.singleSampleGenomeQuantification || q.singleSampleMutation : false
		const state = {
			config,
			// TODO: use state.config drectly, instead of having to extract
			// selected config.key-values into the component state
			activeCohort: config.activeCohort,
			sample: config?.sample || this.sample,
			terms: config.terms,
			expandedTermIds: config.expandedTermIds,
			samples: config.samples || [this.sample],
			singleSampleGenomeQuantification: q?.singleSampleGenomeQuantification,
			singleSampleMutation: q?.singleSampleMutation,
			hasVerifiedToken: this.app.vocabApi.hasVerifiedToken(),
			tokenVerificationPayload: this.app.vocabApi.tokenVerificationPayload,
			hasPlots,
			termdbConfig: appState.termdbConfig,
			vocab: appState.vocab
		}
		if (appState.termdbConfig.selectCohort) {
			state.toSelectCohort = true
			const choice = appState.termdbConfig.selectCohort.values[state.activeCohort]
			if (choice) {
				// a selection has been made
				state.cohortValuelst = choice.keys
			}
		}

		return state
	}

	async main() {
		if (this.mayRequireToken()) return
		this.config = structuredClone(this.state.config)
		this.settings = this.state.config.settings.sampleView
		if (this.state.hasPlots) await this.setControls()
		if (this.dom.header) this.dom.header.html(`Sample View`)
		this.termsById = this.getTermsById(this.state)
		this.sampleDataByTermId = {}
		const root = this.termsById[root_ID]
		root.terms = await this.requestTermRecursive(root)
		this.orderedVisibleTerms = this.getOrderedVisibleTerms(root)
		this.dom.table.style('display', this.settings.showDictionary ? 'block' : 'none')

		if (this.settings.showDictionary) this.renderSampleDictionary()

		this.renderPlots()
	}

	async setControls() {
		this.dom.controlsDiv.selectAll('*').remove()

		this.components = {
			controls: await controlsInit({
				app: this.app,
				id: this.id,
				holder: this.dom.controlsDiv,
				inputs: [
					{
						boxLabel: 'Visible',
						label: 'Samples dictionary',
						type: 'checkbox',
						chartType: 'sampleView',
						settingsKey: 'showDictionary',
						title: `Option to show/hide dictionary table with sample values`
					},
					{
						boxLabel: 'Visible',
						label: 'Disco plot',
						type: 'checkbox',
						chartType: 'sampleView',
						settingsKey: 'showDisco',
						title: `Option to show/hide disco plots`
					},
					{
						boxLabel: 'Visible',
						label: 'Single sample plots',
						type: 'checkbox',
						chartType: 'sampleView',
						settingsKey: 'showSingleSample',
						title: `Option to show/hide single sample plots`
					}
				]
			})
		}
	}

	getTermsById(state) {
		if (!(state.activeCohort in this.termsByCohort)) {
			this.termsByCohort[state.activeCohort] = {
				[root_ID]: {
					id: root_ID,
					__tree_isroot: true // must not delete this flag
				}
			}
		}
		return this.termsByCohort[state.activeCohort]
	}

	async requestTermRecursive(term, _ancestry = [root_ID]) {
		/* will request child terms for this entire branch recursively

		must synthesize request string (dataName) for every call
		and get cached result for the same dataName which has been requested before
		this is to support future features
		e.g. to show number of samples for each term that can change based on filters
		where the same child terms already loaded must be re-requested with the updated filter parameters to update

		CAUTION
		will be great if tree_collapse will not trigger this function
		but hard to do given that main() has no way of telling what action was dispatched
		to prevent previously loaded .terms[] for the collapsing term from been wiped out of termsById,
		need to add it back TERMS_ADD_BACK
 
		NOTE: !!!! sortVisibleTerms() assumes that the child terms in the response.lst[]
					are returned in order. If not, a term.order can be used to sort the child terms array
		*/
		const data = await this.app.vocabApi.getTermChildren(
			term,
			this.state.toSelectCohort ? this.state.cohortValuelst : null
		)
		if (data.error) throw data.error
		if (!data.lst || data.lst.length == 0) {
			// do not throw exception; its children terms may have been filtered out
			return []
		}
		const terms = []
		const parent_id = _ancestry.slice(-1)[0]
		for (const t of data.lst) {
			t.parent_id = parent_id
			const ancestry = [..._ancestry]
			const copy = structuredClone(t)
			copy.ancestry = ancestry
			terms.push(copy)
			// rehydrate expanded terms as needed
			// fills in termsById, for recovering tree

			if (!copy.isleaf && this.config.expandedTermIds.includes(copy.id)) {
				copy.terms = await this.requestTermRecursive(copy, [...ancestry, t.id])
				if (this.state.samples) await this.fillSampleData(copy.terms)
			} else {
				const t0 = this.termsById[copy.id]
				if (this.state.samples) await this.fillSampleData([copy])

				if (t0 && t0.terms) {
					copy.terms = t0.terms
				}
			}

			this.termsById[copy.id] = copy
		}
		return terms
	}

	getOrderedVisibleTerms(root) {
		const visibleTerms = Object.values(this.termsById).filter(this.isVisibleTermId.bind(this))
		const orderedVisibleTerms = []
		this.sortVisibleTerms(this.termsById[root_ID], visibleTerms, orderedVisibleTerms)
		return orderedVisibleTerms
	}

	isVisibleTermId(term) {
		if (term.parent_id == root_ID) return true
		if (!term.ancestry) return false
		for (const pid of term.ancestry) {
			if (pid === root_ID) continue
			if (!this.config.expandedTermIds.includes(pid)) return false
		}
		return true
	}

	sortVisibleTerms(currParent, remainingTerms, currOrder = []) {
		const unorderedTerms = []
		const orderedTerms = []
		for (const term of remainingTerms) {
			if (term.parent_id == currParent.id) {
				orderedTerms.push(term)
			} else unorderedTerms.push(term)
		}
		// remove ordered terms from the remainingTerms array
		remainingTerms.splice(0, remainingTerms.length, ...unorderedTerms)
		if (remainingTerms.length) {
			for (const term of orderedTerms) {
				currOrder.push(term)
				if (!term.isleaf && remainingTerms.length) {
					this.sortVisibleTerms(term, remainingTerms, currOrder)
				}
			}
		} else {
			currOrder.push(...orderedTerms)
		}
	}

	async fillSampleData(terms) {
		const term_ids = []
		for (const term of terms) term_ids.push(term.id)
		for (const sample of this.state.samples) {
			const data = await this.app.vocabApi.getSingleSampleData({ sampleId: sample.sampleId, term_ids })
			if ('error' in data) throw data.error
			if (!this.sampleDataByTermId[sample.sampleId]) this.sampleDataByTermId[sample.sampleId] = {}
			for (const id in data) this.sampleDataByTermId[sample.sampleId][id] = data[id]
		}
	}

	async downloadData() {
		this.dom.messageDiv.style('display', 'inline-block')
		const filename = `samples.tsv`
		const sampleData = {}
		let lines = 'Sample'
		for (const sample of this.state.samples) {
			sampleData[sample.sampleId] = await this.app.vocabApi.getSingleSampleData({ sampleId: sample.sampleId })
			lines += `\t${sample.sampleName}`
		}
		lines += '\n'

		const sampleId = this.state.samples[0].sampleId
		for (const termId in sampleData[sampleId]) {
			const term = sampleData[sampleId][termId].term
			lines += `${term.name}`
			for (const sampleId in sampleData) {
				const data = sampleData[sampleId]
				let value = getTermValue(term, data)
				if (value == null) value = 'Missing'
				lines += `\t${value}`
			}
			lines += '\n'
		}
		const dataStr = 'data:text/tsv;charset=utf-8,' + encodeURIComponent(lines)

		const link = document.createElement('a')
		link.setAttribute('href', dataStr)
		// If you don't know the name or want to use
		// the webserver default set name = ''
		link.setAttribute('download', filename)
		document.body.appendChild(link)
		link.click()
		link.remove()
		this.dom.messageDiv.style('display', 'none')
	}

	mayRequireToken() {
		if (this.state.hasVerifiedToken) {
			this.dom.holder.style('display', 'block')
			return false
		} else {
			const e = this.state.tokenVerificationPayload
			const missingAccess = e?.error == 'Missing access' && this.state.termdbConfig.dataDownloadCatch?.missingAccess
			const message = missingAccess?.message?.replace('MISSING-ACCESS-LINK', missingAccess?.links[e?.linkKey])
			const helpLink = this.state.termdbConfig.dataDownloadCatch?.helpLink
			this.dom.mainDiv
				.style('color', '#e44')
				.html(
					message ||
						(this.state.tokenVerificationMessage || 'Requires sign-in') +
							(helpLink ? ` <a href='${helpLink}' target=_blank>Tutorial</a>` : '')
				)

			return true
		}
	}

	async renderPlots() {
		this.dom.contentDiv.selectAll('*').remove()
		this.dom.rightDiv.selectAll('*').remove()
		if (this.state.hasPlots) {
			const table = this.dom.contentDiv.style('display', 'table')
			if (this.settings.showDisco && this.state.termdbConfig?.queries?.singleSampleMutation) {
				const div = this.dom.contentDiv.append('div').style('display', 'table-row')

				for (const sample of this.state.samples) {
					let cellDiv
					if (this.state.samples.length == 1)
						cellDiv = this.dom.rightDiv.append('div').style('display', 'inline-block').style('vertical-align', 'top')
					else cellDiv = div.append('div').style('display', 'table-cell')

					cellDiv
						.insert('div')
						.style('font-weight', 'bold')
						.style('padding-left', '20px')
						.text(`${sample.sampleName} Disco plot`)
					const discoPlotImport = await import('./plot.disco.js')
					discoPlotImport.default(
						this.state.termdbConfig,
						this.state.vocab.dslabel,
						{ sample_id: sample.sampleName },
						cellDiv,
						this.app.opts.genome
					)
				}
			}
			if (this.settings.showSingleSample && this.state.termdbConfig.queries.singleSampleGenomeQuantification) {
				for (const k in this.state.termdbConfig.queries.singleSampleGenomeQuantification) {
					let div = this.dom.contentDiv.append('div').style('padding', '20px').style('display', 'table-row')
					for (const sample of this.state.samples) {
						const label = k.match(/[A-Z][a-z]+|[0-9]+/g).join(' ')
						let plotDiv
						if (this.state.samples.length == 1)
							plotDiv = this.dom.rightDiv.append('div').style('display', 'inline-block').style('vertical-align', 'top')
						else plotDiv = div.insert('div').style('display', 'table-cell')
						plotDiv.insert('div').style('font-weight', 'bold').text(`${sample.sampleName} ${label}`)
						const ssgqImport = await import('./plot.ssgq.js')
						await ssgqImport.plotSingleSampleGenomeQuantification(
							this.state.termdbConfig,
							this.state.vocab.dslabel,
							k,
							{ sample_id: sample.sampleName },
							plotDiv.insert('div'),
							this.app.opts.genome
						)
					}
				}
			}
		}
	}
}

export function getTermValue(term, data) {
	let value = data[term.id]?.value
	if (value == null) return null
	if (term.type == 'float' || term.type == 'integer') {
		value = term.values?.[value]?.label || term.values?.[value]?.key || value
		if (isNaN(value)) return value
		return value % 1 == 0 ? value.toString() : value.toFixed(2).toString()
	}

	if (term.type == 'categorical') return term.values[value]?.label || term.values[value]?.key
	if (term.type == 'condition') {
		const values = value.toString().split(' ')
		let [years, status] = values
		status = term.values[status].label || term.values[status].key
		return `Max grade: ${status}, Time to event: ${Number(years).toFixed(1)} years`
	}
	if (term.type == 'survival') {
		const values = value.split(' ')
		let [years, status] = values
		status = term.values?.[status]?.label || term.values?.[status]?.key || status
		return `${status} after ${Number(years).toFixed(1)} years`
	}
	return null
}

export const sampleViewInit = getCompInit(SampleView)
export const componentInit = sampleViewInit

function setRenderers(self) {
	self.renderSampleDictionary = function () {
		// use an array to support multiple visible samples,
		// but prototyping with just one sample for now
		const visibleSamples = Object.values(self.sampleDataByTermId)
		// for the column names, just need the first column name + sample data
		self.renderTHead(['', ...self.state.samples.map(s => s.sampleName)])
		const tBodyData = self.orderedVisibleTerms.map((term, trIndex) => [
			{ term }, // first column, no sample data
			// create data to bind for each sample column
			...visibleSamples.map(sample => ({ term, sample }))
		])
		self.renderTBody(tBodyData)
	}

	self.renderTHead = function (data) {
		const trs = self.dom.theadrow.selectAll('th').data(data)
		trs.exit().remove()
		trs.html(self.getThHtml)
		trs.enter().append('th').style('padding', '5px 10px').style('text-align', 'end').html(self.getThHtml)
	}

	self.getThHtml = d => d

	self.renderTBody = function (data) {
		const trs = self.dom.tbody.selectAll('tr').data(data)
		trs.exit().remove()
		trs.each(self.renderTr)
		trs.enter().append('tr').each(self.renderTr)
	}

	self.renderTr = function (trData, trIndex) {
		const tds = select(this)
			.selectAll('td')
			.data(trData, d => d)
		tds.exit().remove()
		tds.each(self.renderTd)
		tds
			.enter()
			.append('td')
			.style('border-bottom', 'solid 1px rgb(245,245,245)')
			.style('text-align', (d, i) => (i === 0 ? 'left' : 'center'))
			.style('padding', '2px 10px')
			.each(self.renderTd)
	}

	self.renderTd = function (d, i) {
		if (!d.sample) {
			// first column for tree dict variables
			self.renderTerm(select(this))
			return
		}
		//const sampleId = Number(d.sample.sampleId)
		const data = d.sample
		const term = d.term
		select(this)
			.datum(d)
			.style('text-align', 'end')
			.style('padding', '5px 10px')

			// !!! TODO: use getTermValue only for actual data !!!
			.html(d.sample[d.term.id]?.label || getTermValue(d.term, d.sample))
	}

	self.renderTerm = function (td) {
		// must get the current data, since each row's data gets replaced
		// as child terms get inserted between each row
		const d = td.datum() // current data
		if (!td.select('span').size()) {
			const span = td.append('span')

			span
				.append('button')
				.style('border-width', 0)
				.style('border-radius', '5px')
				.style('width', '28px')
				.style('height', '28px')
				.style('cursor', 'pointer')
			span.append('span').style('margin-left', `3px`).style('cursor', 'pointer')
			td.on('click', self.toggleTerm)
		}
		const leftIndent = (d.term.ancestry.length - 1) * 24
		const span = td.select(':scope>span').style('margin-left', `${leftIndent}px`)
		const btn = span
			.select('button')
			.style('display', d.term.isleaf ? 'none' : '')
			.html(self.config.expandedTermIds.includes(d.term.id) ? '-' : '+')
		span.select('span').html(d.term.name)
		return
	}
}

function setInteractivity(self) {
	self.toggleTerm = function () {
		const d = select(this).datum()
		if (d.term.isleaf) return
		const expandedTermIds = self.config.expandedTermIds.slice() // create a copy
		const i = expandedTermIds.indexOf(d.term.id)
		if (i == -1) expandedTermIds.push(d.term.id)
		else expandedTermIds.splice(i, 1)
		self.app.dispatch({
			type: 'plot_edit',
			id: self.id,
			config: { expandedTermIds }
		})
	}
}

export async function getPlotConfig(opts) {
	const settings = {
		controls: { isOpen: false },
		sampleView: { showDictionary: true, showDisco: true, showSingleSample: true }
	}
	const config = { activeCohort: 0, sample: null, expandedTermIds: [root_ID], settings }
	return copyMerge(config, opts)
}
