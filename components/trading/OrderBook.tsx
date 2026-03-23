'use client'

import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import type { OrderBookLevel } from '@/lib/tradingTypes'
import { formatCurrency, formatNumber } from '@/lib/investmentUtils'

interface OrderBookProps {
  bids: OrderBookLevel[]
  asks: OrderBookLevel[]
}

export default function OrderBook({ bids, asks }: OrderBookProps) {
  const rowCount = Math.max(bids.length, asks.length)

  return (
    <Box>
      <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700, mb: 2 }}>
        Live Order Book
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ color: '#00FF88', borderColor: 'rgba(255,255,255,0.08)' }}>Bid Price</TableCell>
            <TableCell sx={{ color: '#00FF88', borderColor: 'rgba(255,255,255,0.08)' }}>Bid Size</TableCell>
            <TableCell sx={{ color: '#ff6b6b', borderColor: 'rgba(255,255,255,0.08)' }}>Ask Price</TableCell>
            <TableCell sx={{ color: '#ff6b6b', borderColor: 'rgba(255,255,255,0.08)' }}>Ask Size</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {Array.from({ length: rowCount }).map((_, index) => {
            const bid = bids[index]
            const ask = asks[index]
            return (
              <TableRow key={`${bid?.price ?? 'bid'}-${ask?.price ?? 'ask'}-${index}`}>
                <TableCell sx={{ color: bid ? '#00FF88' : 'rgba(255,255,255,0.35)', borderColor: 'rgba(255,255,255,0.08)' }}>
                  {bid ? formatCurrency(bid.price) : '—'}
                </TableCell>
                <TableCell sx={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.08)' }}>
                  {bid ? formatNumber(bid.size) : '—'}
                </TableCell>
                <TableCell sx={{ color: ask ? '#ff6b6b' : 'rgba(255,255,255,0.35)', borderColor: 'rgba(255,255,255,0.08)' }}>
                  {ask ? formatCurrency(ask.price) : '—'}
                </TableCell>
                <TableCell sx={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.08)' }}>
                  {ask ? formatNumber(ask.size) : '—'}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Box>
  )
}
