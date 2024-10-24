/*
adapted from block.mds.geneboxplot.js, but can be hard to reuse over there

arguments:

bp: {}
	generated by server side boxplot_getvalue()
	bp.label:str
	------- Options not returned in server response ------- 
	optional; if present, prints the label to the left of the row
	optional: if present, set the radius of the outlier circles
g:
	svg <g> in which a horizontal boxplot is rendered from left to right
color:
	line/text color
scale:
	callback, v=>{return fxn(v)}
rowheight:
	int
labpad:
	int, horizontal space between label <text> and boxplot <g>
labColor: 
	str, label text color. Default is color arg
*/
export function drawBoxplot({ bp, g, color, scale, rowheight, labpad, labColor = color }) {
	if (bp.label) {
		g.append('text')
			.attr('font-family', 'Arial')
			.attr('text-anchor', 'end')
			.attr('dominant-baseline', 'central')
			.attr('fill', labColor)
			.attr('x', -labpad)
			.attr('y', rowheight / 2)
			.attr('font-size', Math.min(15, rowheight))
			.text(bp.label)
	}

	if (bp.w1 != undefined) {
		// has valid values for boxplot, could be missing
		const w1 = scale(bp.w1)
		const w2 = scale(bp.w2)
		const p25 = scale(bp.p25)
		const p50 = scale(bp.p50)
		const p75 = scale(bp.p75)
		bp.hline = g
			.append('line')
			.attr('stroke', color)
			.attr('shape-rendering', 'crispEdges')
			.attr('x1', w1)
			.attr('x2', w2)
			.attr('y1', rowheight / 2)
			.attr('y2', rowheight / 2)
		bp.linew1 = g
			.append('line')
			.attr('stroke', color)
			.attr('shape-rendering', 'crispEdges')
			.attr('x1', w1)
			.attr('x2', w1)
			.attr('y1', 0)
			.attr('y2', rowheight)
		bp.linew2 = g
			.append('line')
			.attr('stroke', color)
			.attr('shape-rendering', 'crispEdges')
			.attr('x1', w2)
			.attr('x2', w2)
			.attr('y1', 0)
			.attr('y2', rowheight)
		bp.box = g
			.append('rect')
			.attr('fill', 'white')
			.attr('stroke', color)
			.attr('shape-rendering', 'crispEdges')
			.attr('x', p25)
			.attr('y', 0)
			.attr('width', p75 - p25)
			.attr('height', rowheight)
		bp.linep50 = g
			.append('line')
			.attr('stroke', color)
			.attr('shape-rendering', 'crispEdges')
			.attr('x1', p50)
			.attr('x2', p50)
			.attr('y1', 0)
			.attr('y2', rowheight)
	}
	// outliers
	for (const d of bp.out) {
		g.append('circle')
			.attr('stroke', color)
			.attr('fill', 'white')
			.attr('fill-opacity', 0)
			.attr('cx', scale(d.value))
			.attr('cy', rowheight / 2)
			.attr('r', bp?.radius || rowheight / 3)
		/*
			.on('mouseover', () => {
			})
			.on('mouseout', () => {
			})
			*/

		/*
		if (plot.clicksample) {
			d.circle.on('click', () => {
			})
		}
		*/
	}
}
