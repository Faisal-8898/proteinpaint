import type { BoxPlotRequest, BoxPlotResponse, BoxPlotEntry, BoxPlotData } from '#types'
import { getData } from '../src/termdb.matrix.js'
import { boxplot_getvalue } from '../src/utils.js'

export const api: any = {
	endpoint: 'termdb/boxplot',
	methods: {
		all: {
			init,
			request: {
				typeId: 'BoxplotRequest'
			},
			response: {
				typeId: 'BoxplotResponse'
			},
			examples: []
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any) => {
		const q = req.query satisfies BoxPlotRequest
		try {
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome name'
			const ds = genome.datasets?.[q.dslabel]
			if (!ds) throw 'invalid ds'
			const terms = [q.tw]
			if (q.divideTw) terms.push(q.divideTw)
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
			const overlayTerm = q.divideTw
			for (const [key, val] of Object.entries(data.samples as Record<string, { key: number; value: number }>)) {
				const value = val[q.tw.$id]
				if (!Number.isFinite(value?.value)) continue

				if (overlayTerm) {
					if (!val[overlayTerm?.$id]) continue
					const value2 = val[overlayTerm.$id]

					if (!key2values.has(value2.key)) key2values.set(value2.key, [])
					key2values.get(value2.key).push(value.value)
				} else {
					if (!key2values.has(sampleType)) key2values.set(sampleType, [])
					key2values.get(sampleType).push(value.value)
				}
			}

			const plots: any = []
			let absMin, absMax, maxLabelLgth
			for (const [key, values] of sortKey2values(data, key2values, overlayTerm)) {
				const sortedValues = values.sort((a, b) => a - b)

				if (!absMin || sortedValues[0] < absMin) absMin = sortedValues[0]
				if (!absMax || sortedValues[sortedValues.length - 1] > absMax) absMax = sortedValues[sortedValues.length - 1]

				const vs = sortedValues.map((v: number) => {
					const value = { value: v }
					return value
				})

				if (overlayTerm) {
					const label = overlayTerm?.term?.values?.[key]?.label || key
					if (!maxLabelLgth || label.length > maxLabelLgth.length) maxLabelLgth = label.length
					plots.push({
						label,
						values,
						seriesId: key,
						color: overlayTerm?.term?.values?.[key]?.color || null,
						boxplot: boxplot_getvalue(vs), //Need sd and mean?
						min: sortedValues[0],
						max: sortedValues[sortedValues.length - 1]
					})
				} else {
					const label = overlayTerm?.term?.values?.[key]?.label || key
					if (!maxLabelLgth || label.length > maxLabelLgth.length) maxLabelLgth = label.length
					const plot = {
						label,
						values,
						plotValueCount: values.length,
						boxplot: boxplot_getvalue(vs) as BoxPlotData,
						min: sortedValues[0],
						max: sortedValues[sortedValues.length - 1]
					} satisfies BoxPlotEntry
					plots.push(plot)
				}
			}

			data.plots = plots
			data.absMin = absMin
			data.absMax = absMax
			data.maxLabelLgth = maxLabelLgth
			res.send(data)
		} catch (e: any) {
			res.send({ error: e?.message || e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}

function sortKey2values(data, key2values, overlayTerm) {
	const orderedLabels = data.refs.byTermId[overlayTerm?.$id]?.keyOrder

	key2values = new Map(
		[...key2values].sort(
			orderedLabels
				? (a, b) => orderedLabels.indexOf(a[0]) - orderedLabels.indexOf(b[0])
				: overlayTerm?.term?.type === 'categorical'
				? (a, b) => b[1].length - a[1].length
				: overlayTerm?.term?.type === 'condition'
				? (a, b) => a[0] - b[0]
				: (a, b) =>
						a
							.toString()
							.replace(/[^a-zA-Z0-9<]/g, '')
							.localeCompare(b.toString().replace(/[^a-zA-Z0-9<]/g, ''), undefined, { numeric: true })
		)
	)
	return key2values
}
