import type { MassAppApi, MassState } from '#mass/types/mass'
import type { CorrVolcanoPlotConfig, CorrVolcanoSettings } from '../CorrelationVolcano'
import { fillTermWrapper } from '#termsetting'

export class Model {
	config: CorrVolcanoPlotConfig
	state: MassState
	app: MassAppApi
	settings: CorrVolcanoSettings
	variableTwLst: any
	constructor(
		config: CorrVolcanoPlotConfig,
		state: MassState,
		app: MassAppApi,
		settings: CorrVolcanoSettings,
		variableTwLst: any
	) {
		this.config = config
		this.state = state
		this.app = app
		this.settings = settings
		this.variableTwLst = variableTwLst
	}

	async getData() {
		const opts = await this.setRequestOpts()
		const data = await this.app.vocabApi.getCorrelationVolcanoData(opts)
		return data
	}

	async setRequestOpts() {
		return {
			featureTw: this.config.featureTw,
			variableTwLst: this.variableTwLst,
			filter: this.state.termfilter.filter,
			filter0: this.state.termfilter.filter0,
			correlationMethod: this.settings.method
		}
	}
}
