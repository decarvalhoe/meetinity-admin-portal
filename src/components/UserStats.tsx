import React from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  LineElement,
  PointElement
} from 'chart.js'
import { Bar, Pie, Line } from 'react-chartjs-2'
import { Stats } from '../services/userService'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, LineElement, PointElement)

interface Props {
  stats: Stats
}

export function UserStats({ stats }: Props) {
  const signupData = {
    labels: Object.keys(stats.signups),
    datasets: [
      {
        label: 'Signups',
        data: Object.values(stats.signups),
        borderColor: 'rgba(75,192,192,1)'
      }
    ]
  }

  const industryData = {
    labels: Object.keys(stats.byIndustry),
    datasets: [
      {
        label: 'Industry',
        data: Object.values(stats.byIndustry),
        backgroundColor: ['#36a2eb', '#ff6384', '#ffcd56', '#4bc0c0']
      }
    ]
  }

  const statusData = {
    labels: Object.keys(stats.byStatus),
    datasets: [
      {
        label: 'Status',
        data: Object.values(stats.byStatus),
        backgroundColor: ['#4caf50', '#f44336']
      }
    ]
  }

  return (
    <div className="user-stats">
      <div className="chart">
        <Line data={signupData} />
      </div>
      <div className="chart">
        <Bar data={industryData} />
      </div>
      <div className="chart">
        <Pie data={statusData} />
      </div>
    </div>
  )
}
