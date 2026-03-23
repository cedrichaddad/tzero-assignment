'use client'

import { Box, Typography } from '@mui/material'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCurrency } from '@/lib/investmentUtils'

interface PriceChartProps {
  data: Array<{
    date: string
    open: number
    high: number
    low: number
    close: number
    volume: number
  }>
}

export default function PriceChart({ data }: PriceChartProps) {
  const first = data[0]?.close ?? 0
  const last = data[data.length - 1]?.close ?? 0
  const isPositive = last >= first

  return (
    <Box sx={{ height: 320 }}>
      <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700, mb: 2 }}>
        30-Day Price Trend
      </Typography>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="price-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isPositive ? '#00FF88' : '#ff5b5b'} stopOpacity={0.45} />
              <stop offset="100%" stopColor={isPositive ? '#00FF88' : '#ff5b5b'} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="rgba(255,255,255,0.45)"
            tickFormatter={(value) =>
              new Date(value).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })
            }
          />
          <YAxis stroke="rgba(255,255,255,0.45)" tickFormatter={(value) => `$${Number(value).toFixed(2)}`} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0b1117',
              borderColor: 'rgba(255,255,255,0.12)',
              borderRadius: 12,
              color: '#ffffff',
            }}
            formatter={(value: number) => [formatCurrency(Number(value)), 'Close']}
            labelFormatter={(value) =>
              new Date(value).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            }
          />
          <Area
            type="monotone"
            dataKey="close"
            stroke={isPositive ? '#00FF88' : '#ff5b5b'}
            strokeWidth={2.5}
            fill="url(#price-fill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  )
}
