import type { BoxPlotRequest, BoxPlotResponse, BoxPlotData, RouteApi } from '#types'
import { boxplotPayload } from '#types/checkers'
import { getData } from '../src/termdb.matrix.js'
import { boxplot_getvalue } from '../src/utils.js'
import { sortKey2values } from '../src/termdb.violin.js'
import { roundValue } from '#shared/roundValue.js'

export const api: RouteApi = {
	endpoint: 'termdb/boxplot',
	methods: {
		get: {
			...boxplotPayload,
			init
		},
		post: {
			...boxplotPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res) => {
		const q: BoxPlotRequest = req.query
		try {
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome name'
			const ds = genome.datasets?.[q.dslabel]
			if (!ds) throw 'invalid ds'
			const terms = [q.tw]
			if (q.overlayTw) terms.push(q.overlayTw)
			const data = await getData(
				{
					filter: q.filter,
					filter0: q.filter0,
					terms
				},
				ds,
				genome
			)
			if (data.error) throw data.error

			const sampleType = `All ${data.sampleType?.plural_name || 'samples'}`
			const key2values = new Map()
			const overlayTerm = q.overlayTw
			const uncomputableValues = {}
			for (const val of Object.values(data.samples as Record<string, { key: number; value: number }>)) {
				const value = val[q.tw.$id]
				if (!Number.isFinite(value?.value)) continue

				if (q.tw.term.values?.[value.value]?.uncomputable) {
					const label = q.tw.term.values[value.value].label
					uncomputableValues[label] = (uncomputableValues[label] || 0) + 1
					continue
				}

				if (overlayTerm) {
					if (!val[overlayTerm?.$id]) continue
					const value2 = val[overlayTerm.$id]

					if (overlayTerm.term?.values?.[value2.key]?.uncomputable) {
						const label = overlayTerm.term.values[value2?.key]?.label
						uncomputableValues[label] = (uncomputableValues[label] || 0) + 1
					}

					if (!key2values.has(value2.key)) key2values.set(value2.key, [])
					key2values.get(value2.key).push(value.value)
				} else {
					if (!key2values.has(sampleType)) key2values.set(sampleType, [])
					key2values.get(sampleType).push(value.value)
				}
			}

			const plots: any = []
			let absMin: number | null = null,
				absMax: number | null = null
			for (const [key, values] of sortKey2values(data, key2values, overlayTerm)) {
				const sortedValues = values.sort((a, b) => a - b)

				if (absMin === null || sortedValues[0] < absMin) absMin = sortedValues[0]
				if (absMax === null || sortedValues[sortedValues.length - 1] > absMax)
					absMax = sortedValues[sortedValues.length - 1]

				const vs = sortedValues.map((v: number) => {
					const value = { value: v }
					return value
				})

				const boxplot = boxplot_getvalue(vs)
				if (!boxplot) throw 'boxplot_getvalue failed [termdb.boxplot init()]'
				const descrStats = setDescrStats(boxplot as BoxPlotData, sortedValues, vs)
				const _plot = {
					boxplot,
					descrStats
				}

				//Set rendering properties for the plot
				if (overlayTerm) {
					const _key = overlayTerm?.term?.values?.[key]?.label || key
					const plotLabel = `${_key}, n=${values.length}`
					const overlayBins = numericBins(overlayTerm, data)
					const plot = Object.assign(_plot, {
						color: overlayTerm?.term?.values?.[key]?.color || null,
						key: _key,
						overlayBins: overlayBins.has(key) ? overlayBins.get(key) : null,
						seriesId: key
					})
					plot.boxplot.label = plotLabel
					plots.push(plot)
				} else {
					const plotLabel = `${sampleType}, n=${values.length}`
					const plot = Object.assign(_plot, {
						key: sampleType
					})
					plot.boxplot.label = plotLabel
					plots.push(plot)
				}
			}

			if (absMin == null || absMax == null) throw 'absMin or absMax is null [termdb.boxplot init()]'

			if (q.tw.term?.values) setHiddenPlots(q.tw, plots)
			if (overlayTerm && overlayTerm.term?.values) setHiddenPlots(overlayTerm, plots)

			const returnData: BoxPlotResponse = {
				absMin,
				absMax,
				plots,
				uncomputableValues: setUncomputableValues(uncomputableValues)
			}

			res.send(returnData)
		} catch (e: any) {
			res.send({ error: e?.message || e })
			if (e instanceof Error && e.stack) console.error(e)
		}
	}
}

function setHiddenPlots(term, plots) {
	for (const v of Object.values(term.term?.values as { label: string; uncomputable: boolean }[])) {
		const plot = plots.find(p => p.key === v.label)
		if (plot) plot.isHidden = v?.uncomputable
	}
	if (term.q?.hiddenValues) {
		for (const key of Object.keys(term.q.hiddenValues)) {
			const plot = plots.find(p => p.key === key)
			if (plot) plot.isHidden = true
		}
	}

	return plots
}

function setDescrStats(boxplot: BoxPlotData, sortedValues: number[], vs: { value: number }[]) {
	//boxplot_getvalue() already returns calculated stats
	//Format data rather than recalculate
	const mean = sortedValues.reduce((s, i) => s + i, 0) / sortedValues.length
	let s = 0
	for (const v of sortedValues) {
		s += Math.pow(v - mean, 2)
	}
	const sd = Math.sqrt(s / (sortedValues.length - 1))
	const squareDiffs = sortedValues.map(x => (x - mean) ** 2).reduce((a, b) => a + b, 0)
	const variance = squareDiffs / (sortedValues.length - 1)

	/** boxplot_getvalue won't return these values for small # of samples
	 * Calculate value subset for tooltips. */
	const p25 = boxplot.p25 ?? vs[Math.floor(vs.length / 4)].value
	const p50 = boxplot.p50 ?? vs[Math.floor(vs.length / 2)].value
	const p75 = boxplot.p75 ?? vs[Math.floor((vs.length * 3) / 4)].value
	const iqr = boxplot.iqr ?? p75 - p25

	return [
		{ id: 'total', label: 'Total', value: sortedValues.length },
		{ id: 'min', label: 'Minimum', value: roundValue(sortedValues[0], 2) },
		{ id: 'p25', label: '1st quartile', value: roundValue(p25, 2) },
		{ id: 'median', label: 'Median', value: roundValue(p50, 2) },
		{ id: 'mean', label: 'Mean', value: roundValue(mean, 2) },
		{ id: 'p75', label: '3rd quartile', value: roundValue(p75, 2) },
		{ id: 'max', label: 'Maximum', value: roundValue(sortedValues[sortedValues.length - 1], 2) },
		{ id: 'sd', label: 'Standard deviation', value: isNaN(sd) ? null : roundValue(sd, 2) },
		{ id: 'variance', label: 'Variance', value: roundValue(variance, 2) },
		{ id: 'iqr', label: 'Inter-quartile range', value: roundValue(iqr, 2) }
	]
}

function setUncomputableValues(values: Record<string, number>) {
	if (Object.entries(values)?.length) {
		return Object.entries(values).map(([label, v]) => ({ label, value: v as number }))
	} else return null
}

function numericBins(overlayTerm, data) {
	const overlayBins = data.refs.byTermId[overlayTerm?.term?.id]?.bins ?? []
	return new Map(overlayBins.map(bin => [bin.label, bin]))
}
