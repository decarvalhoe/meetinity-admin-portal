import React, { useEffect, useMemo, useRef } from 'react'
import * as d3 from 'd3'
import { CostMetrics } from '../../services/financialService'

interface CostInsightsProps {
  data: CostMetrics
  loading: boolean
}

export const CostInsights: React.FC<CostInsightsProps> = ({ data, loading }) => {
  const comparisonRef = useRef<SVGSVGElement | null>(null)
  const categoriesRef = useRef<SVGSVGElement | null>(null)

  const totals = useMemo(() => {
    if (loading) {
      return { totalCost: 0, margin: 0 }
    }

    const totalCost = data.categories.reduce((sum, category) => sum + category.amount, 0)
    const lastComparison = data.comparison[data.comparison.length - 1]
    const margin = lastComparison ? lastComparison.revenue - lastComparison.cost : 0
    return {
      totalCost,
      margin
    }
  }, [data, loading])

  useEffect(() => {
    if (!comparisonRef.current) {
      return
    }

    const svg = d3.select(comparisonRef.current)
    const width = 500
    const height = 280
    const margin = { top: 24, right: 16, bottom: 48, left: 56 }

    svg.attr('viewBox', `0 0 ${width} ${height}`)
    svg.selectAll('*').remove()

    if (loading) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#6b7280')
        .text('Chargement des coûts...')
      return
    }

    if (data.comparison.length === 0) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#6b7280')
        .text('Aucune donnée de coûts disponible.')
      return
    }

    const chartWidth = width - margin.left - margin.right
    const chartHeight = height - margin.top - margin.bottom
    const container = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    const xScale = d3
      .scaleBand()
      .domain(data.comparison.map((point) => point.period))
      .range([0, chartWidth])
      .padding(0.35)

    const maxValue = d3.max(data.comparison, (point) => Math.max(point.cost, point.revenue)) ?? 0
    const yScale = d3.scaleLinear().domain([0, maxValue * 1.1]).range([chartHeight, 0]).nice()

    container
      .append('g')
      .attr('transform', `translate(0,${chartHeight})`)
      .call(d3.axisBottom(xScale))

    container.append('g').call(d3.axisLeft(yScale).ticks(6))

    container
      .selectAll('.bar-cost')
      .data(data.comparison)
      .enter()
      .append('rect')
      .attr('class', 'bar-cost')
      .attr('x', (d) => xScale(d.period) ?? 0)
      .attr('y', (d) => yScale(d.cost))
      .attr('width', xScale.bandwidth() / 2)
      .attr('height', (d) => chartHeight - yScale(d.cost))
      .attr('fill', '#dc2626')
      .attr('rx', 6)

    container
      .selectAll('.bar-revenue')
      .data(data.comparison)
      .enter()
      .append('rect')
      .attr('class', 'bar-revenue')
      .attr('x', (d) => (xScale(d.period) ?? 0) + xScale.bandwidth() / 2)
      .attr('y', (d) => yScale(d.revenue))
      .attr('width', xScale.bandwidth() / 2)
      .attr('height', (d) => chartHeight - yScale(d.revenue))
      .attr('fill', '#2563eb')
      .attr('rx', 6)

    const legend = svg.append('g').attr('transform', `translate(${width - 160}, 16)`)

    legend
      .append('rect')
      .attr('width', 12)
      .attr('height', 12)
      .attr('fill', '#dc2626')

    legend
      .append('text')
      .attr('x', 20)
      .attr('y', 10)
      .attr('fill', '#374151')
      .attr('font-size', 12)
      .text('Coûts')

    legend
      .append('rect')
      .attr('x', 0)
      .attr('y', 24)
      .attr('width', 12)
      .attr('height', 12)
      .attr('fill', '#2563eb')

    legend
      .append('text')
      .attr('x', 20)
      .attr('y', 34)
      .attr('fill', '#374151')
      .attr('font-size', 12)
      .text('Revenus')
  }, [data.comparison, loading])

  useEffect(() => {
    if (!categoriesRef.current) {
      return
    }

    const svg = d3.select(categoriesRef.current)
    const width = 500
    const height = 240
    const margin = { top: 24, right: 16, bottom: 36, left: 160 }

    svg.attr('viewBox', `0 0 ${width} ${height}`)
    svg.selectAll('*').remove()

    if (loading) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#6b7280')
        .text('Chargement des catégories...')
      return
    }

    if (data.categories.length === 0) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#6b7280')
        .text('Pas de catégories de coût disponibles.')
      return
    }

    const chartWidth = width - margin.left - margin.right
    const chartHeight = height - margin.top - margin.bottom

    const yScale = d3
      .scaleBand()
      .domain(data.categories.map((category) => category.category))
      .range([0, chartHeight])
      .padding(0.2)

    const xScale = d3
      .scaleLinear()
      .domain([0, d3.max(data.categories, (category) => category.amount) ?? 0])
      .range([0, chartWidth])
      .nice()

    const container = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    container.append('g').call(d3.axisLeft(yScale))

    container
      .append('g')
      .attr('transform', `translate(0,${chartHeight})`)
      .call(d3.axisBottom(xScale).ticks(5))

    container
      .selectAll('rect')
      .data(data.categories)
      .enter()
      .append('rect')
      .attr('x', 0)
      .attr('y', (d) => yScale(d.category) ?? 0)
      .attr('width', (d) => xScale(d.amount))
      .attr('height', yScale.bandwidth())
      .attr('fill', '#9333ea')
      .attr('rx', 6)

    container
      .selectAll('text.value')
      .data(data.categories)
      .enter()
      .append('text')
      .attr('class', 'value')
      .attr('x', (d) => xScale(d.amount) + 8)
      .attr('y', (d) => (yScale(d.category) ?? 0) + yScale.bandwidth() / 2 + 4)
      .attr('fill', '#4b5563')
      .attr('font-size', 12)
      .text((d) => `€${d.amount.toFixed(0)}`)
  }, [data.categories, loading])

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Coûts et bénéfices</h2>
          <p className="text-sm text-slate-500">
            Comparez les coûts par période et identifiez les gains de marge sur les segments actifs.
          </p>
        </div>
        <div className="text-right text-sm text-slate-600">
          {loading ? (
            <span className="text-slate-400">Chargement…</span>
          ) : (
            <>
              <div>
                Coûts totaux:{' '}
                <span className="font-semibold text-slate-900">€{totals.totalCost.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}</span>
              </div>
              <div>
                Marge dernière période:{' '}
                <span className={totals.margin >= 0 ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'}>
                  €{totals.margin.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="grid gap-6">
        <div>
          <h3 className="text-sm font-medium text-slate-700">Comparaison coûts vs revenus</h3>
          <svg ref={comparisonRef} className="mt-2 w-full" role="img" aria-label="Comparaison coûts vs revenus" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-slate-700">Répartition des coûts</h3>
          <svg ref={categoriesRef} className="mt-2 w-full" role="img" aria-label="Répartition des coûts" />
        </div>
      </div>
    </div>
  )
}
