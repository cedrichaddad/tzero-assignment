'use client'

import useSWR from 'swr'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import api from '@/lib/api'
import { formatCurrency, formatNumber } from '@/lib/investmentUtils'
import type { TradingPortfolioResponse } from '@/lib/tradingTypes'

const fetcher = async (url: string) => {
  const response = await api.get<TradingPortfolioResponse>(url)
  return response.data
}

export default function TradingAccountSection() {
  const { data, error, isLoading, mutate } = useSWR('/trading/portfolio', fetcher, {
    refreshInterval: 4000,
    dedupingInterval: 2000,
    focusThrottleInterval: 3000,
    keepPreviousData: true,
  })

  const handleCancelOrder = async (orderId: string) => {
    await api.delete(`/trading/orders/${orderId}`)
    void mutate()
  }

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h5" sx={{ color: '#ffffff', fontWeight: 700, mb: 2 }}>
        Trading Account
      </Typography>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error.response?.data?.error ?? 'Failed to load trading account.'}
        </Alert>
      ) : null}

      {isLoading && !data ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <CircularProgress />
        </Paper>
      ) : null}

      {data ? (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3, borderRadius: 3 }}>
                <Typography sx={{ color: '#888888', mb: 1 }}>Trading Cash</Typography>
                <Typography variant="h4" sx={{ color: '#ffffff', fontWeight: 700 }}>
                  {formatCurrency(data.balance.cashBalance)}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3, borderRadius: 3 }}>
                <Typography sx={{ color: '#888888', mb: 1 }}>Locked Cash</Typography>
                <Typography variant="h4" sx={{ color: '#ffffff', fontWeight: 700 }}>
                  {formatCurrency(data.balance.lockedCash)}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3, borderRadius: 3 }}>
                <Typography sx={{ color: '#888888', mb: 1 }}>Total Trading Equity</Typography>
                <Typography variant="h4" sx={{ color: '#ffffff', fontWeight: 700 }}>
                  {formatCurrency(data.summary.totalEquity)}
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          <Grid container spacing={3}>
            <Grid item xs={12} lg={7}>
              <Paper sx={{ p: 3, borderRadius: 3, mb: 3 }}>
                <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700, mb: 2 }}>
                  Holdings
                </Typography>
                {data.holdings.length ? (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ color: '#888888', borderColor: 'rgba(255,255,255,0.08)' }}>Asset</TableCell>
                        <TableCell sx={{ color: '#888888', borderColor: 'rgba(255,255,255,0.08)' }}>Shares</TableCell>
                        <TableCell sx={{ color: '#888888', borderColor: 'rgba(255,255,255,0.08)' }}>Avg Cost</TableCell>
                        <TableCell sx={{ color: '#888888', borderColor: 'rgba(255,255,255,0.08)' }}>Market Value</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.holdings.map((holding) => (
                        <TableRow key={holding.symbol}>
                          <TableCell sx={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.08)' }}>
                            {holding.title}
                          </TableCell>
                          <TableCell sx={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.08)' }}>
                            {formatNumber(holding.shares)}
                          </TableCell>
                          <TableCell sx={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.08)' }}>
                            {formatCurrency(holding.avgCost)}
                          </TableCell>
                          <TableCell sx={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.08)' }}>
                            {formatCurrency(holding.marketValue)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Typography sx={{ color: '#888888' }}>No trading holdings yet.</Typography>
                )}
              </Paper>

              <Paper sx={{ p: 3, borderRadius: 3 }}>
                <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700, mb: 2 }}>
                  Recent Trades
                </Typography>
                {data.recentTrades.length ? (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ color: '#888888', borderColor: 'rgba(255,255,255,0.08)' }}>Asset</TableCell>
                        <TableCell sx={{ color: '#888888', borderColor: 'rgba(255,255,255,0.08)' }}>Side</TableCell>
                        <TableCell sx={{ color: '#888888', borderColor: 'rgba(255,255,255,0.08)' }}>Price</TableCell>
                        <TableCell sx={{ color: '#888888', borderColor: 'rgba(255,255,255,0.08)' }}>Quantity</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.recentTrades.map((trade) => (
                        <TableRow key={trade.id}>
                          <TableCell sx={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.08)' }}>{trade.title}</TableCell>
                          <TableCell sx={{ color: trade.side === 'buy' ? '#00FF88' : '#ff6b6b', borderColor: 'rgba(255,255,255,0.08)' }}>
                            {trade.side.toUpperCase()}
                          </TableCell>
                          <TableCell sx={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.08)' }}>{formatCurrency(trade.price)}</TableCell>
                          <TableCell sx={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.08)' }}>{formatNumber(trade.quantity)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Typography sx={{ color: '#888888' }}>No recent trading activity.</Typography>
                )}
              </Paper>
            </Grid>

            <Grid item xs={12} lg={5}>
              <Paper sx={{ p: 3, borderRadius: 3 }}>
                <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700, mb: 2 }}>
                  Open Orders
                </Typography>
                {data.openOrders.length ? (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ color: '#888888', borderColor: 'rgba(255,255,255,0.08)' }}>Asset</TableCell>
                        <TableCell sx={{ color: '#888888', borderColor: 'rgba(255,255,255,0.08)' }}>Side</TableCell>
                        <TableCell sx={{ color: '#888888', borderColor: 'rgba(255,255,255,0.08)' }}>Remaining</TableCell>
                        <TableCell sx={{ color: '#888888', borderColor: 'rgba(255,255,255,0.08)' }}>Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.openOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell sx={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.08)' }}>{order.title}</TableCell>
                          <TableCell sx={{ color: order.side === 'buy' ? '#00FF88' : '#ff6b6b', borderColor: 'rgba(255,255,255,0.08)' }}>
                            {order.side.toUpperCase()}
                          </TableCell>
                          <TableCell sx={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.08)' }}>{formatNumber(order.remainingQuantity)}</TableCell>
                          <TableCell sx={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                            <Button size="small" color="inherit" onClick={() => void handleCancelOrder(order.id)}>
                              Cancel
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Typography sx={{ color: '#888888' }}>No active orders.</Typography>
                )}
              </Paper>
            </Grid>
          </Grid>
        </>
      ) : null}
    </Box>
  )
}
