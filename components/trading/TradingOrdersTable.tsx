'use client'

import { useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import type { TradingOrderView, TradingTradeView } from '@/lib/tradingTypes'
import { formatCurrency, formatNumber } from '@/lib/investmentUtils'

interface TradingOrdersTableProps {
  openOrders: TradingOrderView[]
  trades: TradingTradeView[]
  onCancelOrder?: (orderId: string) => Promise<void> | void
}

export default function TradingOrdersTable({ openOrders, trades, onCancelOrder }: TradingOrdersTableProps) {
  const [tab, setTab] = useState<'orders' | 'trades'>('orders')

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700 }}>
          Your Activity
        </Typography>
        <Tabs
          value={tab}
          onChange={(_, next) => setTab(next)}
          textColor="inherit"
          indicatorColor="primary"
          sx={{ minHeight: 40 }}
        >
          <Tab label={`Open Orders (${openOrders.length})`} value="orders" />
          <Tab label={`Trades (${trades.length})`} value="trades" />
        </Tabs>
      </Box>

      {tab === 'orders' ? (
        openOrders.length ? (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: '#888888', borderColor: 'rgba(255,255,255,0.08)' }}>Side</TableCell>
                <TableCell sx={{ color: '#888888', borderColor: 'rgba(255,255,255,0.08)' }}>Price</TableCell>
                <TableCell sx={{ color: '#888888', borderColor: 'rgba(255,255,255,0.08)' }}>Quantity</TableCell>
                <TableCell sx={{ color: '#888888', borderColor: 'rgba(255,255,255,0.08)' }}>Remaining</TableCell>
                <TableCell sx={{ color: '#888888', borderColor: 'rgba(255,255,255,0.08)' }}>Status</TableCell>
                <TableCell sx={{ color: '#888888', borderColor: 'rgba(255,255,255,0.08)' }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {openOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell sx={{ color: order.side === 'buy' ? '#00FF88' : '#ff6b6b', borderColor: 'rgba(255,255,255,0.08)' }}>
                    {order.side.toUpperCase()}
                  </TableCell>
                  <TableCell sx={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.08)' }}>{formatCurrency(order.price)}</TableCell>
                  <TableCell sx={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.08)' }}>{formatNumber(order.quantity)}</TableCell>
                  <TableCell sx={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.08)' }}>{formatNumber(order.remainingQuantity)}</TableCell>
                  <TableCell sx={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                    <Chip
                      label={order.status}
                      size="small"
                      sx={{
                        backgroundColor: 'rgba(255,255,255,0.08)',
                        color: '#ffffff',
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                    {onCancelOrder ? (
                      <Button size="small" color="inherit" onClick={() => void onCancelOrder(order.id)}>
                        Cancel
                      </Button>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Typography sx={{ color: '#888888' }}>No open orders for this asset.</Typography>
        )
      ) : trades.length ? (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: '#888888', borderColor: 'rgba(255,255,255,0.08)' }}>Side</TableCell>
              <TableCell sx={{ color: '#888888', borderColor: 'rgba(255,255,255,0.08)' }}>Price</TableCell>
              <TableCell sx={{ color: '#888888', borderColor: 'rgba(255,255,255,0.08)' }}>Quantity</TableCell>
              <TableCell sx={{ color: '#888888', borderColor: 'rgba(255,255,255,0.08)' }}>Executed</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {trades.map((trade) => (
              <TableRow key={trade.id}>
                <TableCell sx={{ color: trade.side === 'buy' ? '#00FF88' : '#ff6b6b', borderColor: 'rgba(255,255,255,0.08)' }}>
                  {trade.side.toUpperCase()}
                </TableCell>
                <TableCell sx={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.08)' }}>{formatCurrency(trade.price)}</TableCell>
                <TableCell sx={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.08)' }}>{formatNumber(trade.quantity)}</TableCell>
                <TableCell sx={{ color: '#cccccc', borderColor: 'rgba(255,255,255,0.08)' }}>
                  {new Date(trade.createdAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <Typography sx={{ color: '#888888' }}>No trades for this asset yet.</Typography>
      )}
    </Box>
  )
}
