import type SnvLegendElement from '#plots/disco/snv/SnvLegendElement.ts'
import type CnvLegend from '#plots/disco/cnv/CnvLegend.ts'
import type LohLegend from '#plots/disco/loh/LohLegend.ts'
import type { CnvType } from '#plots/disco/cnv/CnvType.ts'
import type { DiscoInteractions } from '../interactions/DiscoInteractions'

export default class Legend {
	snvTitle: string
	snvClassMap: Map<string, SnvLegendElement>

	cnvTitle: string
	cnvClassMap: Map<CnvType, CnvLegend>
	cnvPercentile: number
	cnvCutoffMode: string

	lohTitle: string
	lohLegend?: LohLegend

	fusionTitle: string
	fusionLegend: boolean
	cnvRenderingType: string

	discoInteractions: DiscoInteractions

	constructor(
		snvTitle: string,
		cnvTitle: string,
		lohTitle: string,
		fusionTitle: string,
		cnvPercentile: number,
		cnvCutoffmode: string,
		snvClassMap: Map<string, SnvLegendElement>,
		cnvClassMap: Map<CnvType, CnvLegend>,
		cnvRenderingType: string,
		fusionLegend: boolean,
		discoInteractions: DiscoInteractions,
		lohLegend?: LohLegend
	) {
		this.snvTitle = snvTitle
		this.cnvTitle = cnvTitle
		this.lohTitle = lohTitle
		this.fusionTitle = fusionTitle
		this.cnvPercentile = cnvPercentile
		this.cnvCutoffMode = cnvCutoffmode
		this.snvClassMap = snvClassMap
		this.cnvClassMap = cnvClassMap
		this.cnvRenderingType = cnvRenderingType
		this.lohLegend = lohLegend
		this.fusionLegend = fusionLegend
		this.discoInteractions = discoInteractions
	}

	legendCount(): number {
		return (
			(this.snvClassMap.size > 0 ? 1 : 0) +
			(this.cnvClassMap.size > 0 ? 1 : 0) +
			(this.lohLegend ? 1 : 0) +
			(this.fusionLegend ? 1 : 0)
		)
	}
}
