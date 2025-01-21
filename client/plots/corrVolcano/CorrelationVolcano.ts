import { getCompInit, copyMerge } from '#rx'
import { RxComponentInner } from '../../types/rx.d'
import { fillTermWrapper } from '#termsetting'
import type { BasePlotConfig, MassAppApi, MassState } from '#mass/types/mass'
import type { Elem, SvgG, SvgSvg, SvgText } from '../../types/d3'
import { controlsInit } from '../controls'
import { Menu, addGeneSearchbox } from '#dom'
import { Model } from './model/Model'
import { ViewModel } from './viewModel/ViewModel'
import { View } from './view/View'
import { CorrVolcanoInteractions } from './interactions/CorrVolcanoInteractions'

/**
 * TODOs:
 * - WILL DO ALL TYPING AFTER INITIAL PROTOTYPE
 */

export type CorrVolcanoSettings = {
	height: number
	isAdjustedPValue: boolean
	method: 'pearson' | 'spearman'
	width: number
}

export type CorrVolcanoPlotConfig = BasePlotConfig & {
	featureTw: any
}

export type CorrVolcanoDom = {
	controls: Elem
	div: Elem
	error: Elem
	legend: SvgG
	plot: SvgG
	svg: SvgSvg
	title: SvgText
	tip: Menu
	yAxisLabel: SvgText
}

class CorrelationVolcano extends RxComponentInner {
	readonly type = 'correlationVolcano'
	components: { controls: any }
	dom: CorrVolcanoDom
	dsCorrVolcano: any
	constructor(opts: any) {
		super()
		this.opts = opts
		this.components = {
			controls: {}
		}
		const holder = opts.holder.classed('sjpp-corrVolcano-main', true)
		const controls = opts.controls ? holder : holder.append('div')
		const div = holder.append('div').style('padding', '5px').style('display', 'block')
		const errorDiv = div.append('div').attr('id', 'sjpp-corrVolcano-error').style('opacity', 0.75)
		const svg = div.append('svg').style('display', 'inline-block').attr('id', 'sjpp-corrVolcano-svg')
		this.dom = {
			controls: controls.style('display', 'block') as Elem,
			div,
			error: errorDiv,
			svg,
			plot: svg.append('g'),
			title: svg.append('text'),
			yAxisLabel: svg.append('text'),
			legend: div.append('svg'),
			tip: new Menu({ padding: '' })
		}
		this.dsCorrVolcano = {}
	}

	getState(appState: MassState) {
		const config = appState.plots.find((p: BasePlotConfig) => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			termfilter: appState.termfilter,
			correlationVolcano: appState.termdbConfig.correlationVolcano,
			config: Object.assign({}, config, {
				settings: {
					correlationVolcano: config.settings.correlationVolcano
				}
			})
		}
	}

	async setControls() {
		const inputs = [
			{
				type: 'term',
				configKey: 'featureTw',
				chartType: 'correlationVolcano',
				usecase: { target: 'correlationVolcano', detail: 'featureTw' },
				label: 'Gene',
				vocabApi: this.app.vocabApi,
				geneVariantEditMenuOnlyGrp: true,
				menuOptions: 'replace'
			},
			{
				label: 'Correlation method',
				title: 'Correlation method',
				type: 'radio',
				chartType: 'correlationVolcano',
				settingsKey: 'method',
				options: [
					{ label: 'Pearson', value: 'pearson' },
					{ label: 'Spearman', value: 'spearman' }
				]
			},
			{
				label: 'P value',
				title: 'Change the p value',
				type: 'radio',
				chartType: 'correlationVolcano',
				settingsKey: 'isAdjustedPValue',
				options: [
					{ label: 'Adjusted', value: true },
					{ label: 'Original', value: false }
				]
			},
			{
				label: 'Height',
				title: 'Set the height of the plot',
				type: 'number',
				chartType: 'correlationVolcano',
				settingsKey: 'height',
				debounceInterval: 500
			},
			{
				label: 'Width',
				title: 'Set the width of the plot',
				type: 'number',
				chartType: 'correlationVolcano',
				settingsKey: 'width',
				debounceInterval: 500
			}
		]

		this.components.controls = await controlsInit({
			app: this.app,
			id: this.id,
			holder: this.dom.controls.attr('class', 'pp-termdb-plot-controls').style('display', 'inline-block'),
			inputs
		})
	}

	async init(appState) {
		await this.setControls()
		//Hack because obj not returning in getState(). Will fix later.
		this.dsCorrVolcano = appState.termdbConfig.correlationVolcano
	}

	async main() {
		const config = structuredClone(this.state.config)
		if (config.childType != this.type && config.chartType != this.type) return

		const interactions = new CorrVolcanoInteractions(this.app, this.dom)

		const settings = config.settings.correlationVolcano
		const variableTwLst = this.dsCorrVolcano.variables.termIds.map((id: string) => {
			return { id }
		})
		for (const t of variableTwLst) await fillTermWrapper(t, this.app.vocabApi)
		/** Request data from the server*/
		const model = new Model(config, this.state, this.app, settings, variableTwLst)
		const data = await model.getData()
		if (!data || data['error']) {
			interactions.clearDom()
			this.dom.error.text(data['error'] || 'No data returned from server')
		}

		/** Format returned data for rendering */
		const viewModel = new ViewModel(config, data, settings, variableTwLst)

		/** Render correlation volcano plot */
		new View(this.dom, viewModel.viewData, interactions, settings)
	}
}

export const corrVolcanoInit = getCompInit(CorrelationVolcano)
export const componentInit = corrVolcanoInit

export function makeChartBtnMenu(holder, chartsInstance) {
	const genomeObj = chartsInstance.app.opts.genome
	if (typeof genomeObj != 'object') throw 'chartsInstance.app.opts.genome not an object and needed for gene search box'
	const arg = {
		tip: new Menu({ padding: '' }),
		genome: genomeObj,
		row: holder.append('div').style('margin', '10px'),
		searchOnly: 'gene',
		callback: async () => {
			try {
				//Hardcoded type b/c fillTW unable to detect. Will fix later.
				const featureTw = {
					featureTw: {
						term: { gene: result.geneSymbol, name: result.geneSymbol, type: 'geneExpression' }
					}
				}
				const config = await getPlotConfig(featureTw, chartsInstance.app)
				chartsInstance.prepPlot({ config })
			} catch (e: any) {
				// upon err, create div in chart button menu to display err
				holder.append('div').text(`Error: ${e.message || e}`)
				console.log(e)
			}
		}
	}
	const result = addGeneSearchbox(arg as any) //Hack to get around TS error. Will fix later.
}

export function getDefaultCorrVolcanoSettings(overrides = {}) {
	const defaults: CorrVolcanoSettings = {
		height: 400,
		isAdjustedPValue: false,
		method: 'pearson',
		width: 400
	}
	return Object.assign(defaults, overrides)
}

export async function getPlotConfig(opts: any, app: MassAppApi) {
	if (!opts.featureTw) throw 'opts.featureTw{} missing [correlationVolcano getPlotConfig()]'
	try {
		await fillTermWrapper(opts.featureTw, app.vocabApi)
	} catch (e) {
		console.error(new Error(`${e} [correlationVolcano getPlotConfig()]`))
		throw `correlationVolcano getPlotConfig() failed`
	}

	const config = {
		chartType: 'correlationVolcano',
		featureTw: opts.featureTw,
		settings: {
			controls: {
				term2: null,
				term0: null
			},
			correlationVolcano: getDefaultCorrVolcanoSettings(opts.overrides || {})
		}
	}
	return copyMerge(config, opts)
}
