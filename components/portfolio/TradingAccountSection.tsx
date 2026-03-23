'use client'

import {
  Box,
  Button,
  CircularProgress,
  Grid,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { formatCurrency, formatNumber } from '@/lib/investmentUtils'
import type { TradingHoldingView, TradingOrderView, TradingTradeView } from '@/lib/tradingTypes'

type TradingAccountSectionProps = {
  holdings: TradingHoldingView[]
  openOrders: TradingOrderView[]
  recentTrades: TradingTradeView[]
  isLoading: boolean
  isCancellingOrderId: string | null
  onCancelOrder: (orderId: string) => Promise<void>
}

function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Box>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton
          key={index}
          variant="rounded"
          height={40}
          sx={{ mb: index === rows - 1 ? 0 : 1, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.08)' }}
        />
      ))}
    </Box>
  )
}

const tableCellSx = {
  color: '#ffffff',
  borderColor: 'rgba(255,255,255,0.08)',
}

const tableHeadSx = {
  color: '#8a96a8',
  borderColor: 'rgba(255,255,255,0.08)',
  fontWeight: 600,
}

export default function TradingAccountSection({
  holdings,
  openOrders,
  recentTrades,
  isLoading,
  isCancellingOrderId,
  onCancelOrder,
}: TradingAccountSectionProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Paper
        sx={{
          p: { xs: 2.5, md: 3 },
          borderRadius: 4,
          backgroundColor: '#121a24',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700, mb: 0.5 }}>
          Secondary Marketplace Holdings
        </Typography>
        <Typography sx={{ color: '#8a96a8', mb: 2.5 }}>
          Live positions marked to the latest executable market data.
        </Typography>

        {isLoading && !holdings.length ? (
          <TableSkeleton rows={5} />
        ) : holdings.length ? (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={tableHeadSx}>Asset</TableCell>
                <TableCell sx={tableHeadSx}>Shares</TableCell>
                <TableCell sx={tableHeadSx}>Avg Cost</TableCell>
                <TableCell sx={tableHeadSx}>Market Value</TableCell>
                <TableCell sx={tableHeadSx}>Unrealized P&amp;L</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {holdings.map((holding) => (
                <TableRow key={holding.symbol}>
                  <TableCell sx={tableCellSx}>
                    <Typography sx={{ fontWeight: 600 }}>{holding.title}</Typography>
                    <Typography variant="body2" sx={{ color: '#8a96a8' }}>
                      {holding.symbol}
                    </Typography>
                  </TableCell>
                  <TableCell sx={tableCellSx}>{formatNumber(holding.shares)}</TableCell>
                  <TableCell sx={tableCellSx}>{formatCurrency(holding.avgCost)}</TableCell>
                  <TableCell sx={tableCellSx}>{formatCurrency(holding.marketValue)}</TableCell>
                  <TableCell
                    sx={{
                      ...tableCellSx,
                      color: holding.unrealizedPnL >= 0 ? '#00d68f' : '#ff7a7a',
                      fontWeight: 600,
                    }}
                  >
                    {formatCurrency(holding.unrealizedPnL)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Typography sx={{ color: '#8a96a8' }}>
            No secondary-market holdings yet. Filled trades will appear here automatically.
          </Typography>
        )}
      </Paper>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={5}>
          <Paper
            sx={{
              p: { xs: 2.5, md: 3 },
              height: '100%',
              borderRadius: 4,
              backgroundColor: '#121a24',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700, mb: 0.5 }}>
              Open Orders
            </Typography>
            <Typography sx={{ color: '#8a96a8', mb: 2.5 }}>
              Active orders continue to lock cash or shares until they fill or are cancelled.
            </Typography>

            {isLoading && !openOrders.length ? (
              <TableSkeleton rows={4} />
            ) : openOrders.length ? (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={tableHeadSx}>Asset</TableCell>
                    <TableCell sx={tableHeadSx}>Side</TableCell>
                    <TableCell sx={tableHeadSx}>Remaining</TableCell>
                    <TableCell sx={tableHeadSx}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {openOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell sx={tableCellSx}>
                        <Typography sx={{ fontWeight: 600 }}>{order.title}</Typography>
                        <Typography variant="body2" sx={{ color: '#8a96a8' }}>
                          {formatCurrency(order.price)}
                        </Typography>
                      </TableCell>
                      <TableCell
                        sx={{
                          ...tableCellSx,
                          color: order.side === 'buy' ? '#00d68f' : '#ff7a7a',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                        }}
                      >
                        {order.side}
                      </TableCell>
                      <TableCell sx={tableCellSx}>{formatNumber(order.remainingQuantity)}</TableCell>
                      <TableCell sx={tableCellSx}>
                        <Button
                          size="small"
                          color="inherit"
                          disabled={isCancellingOrderId === order.id}
                          onClick={() => void onCancelOrder(order.id)}
                          sx={{
                            minWidth: 92,
                            color: '#d7dbe2',
                            borderColor: 'rgba(255,255,255,0.18)',
                          }}
                          variant="outlined"
                        >
                          {isCancellingOrderId === order.id ? <CircularProgress size={18} color="inherit" /> : 'Cancel'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Typography sx={{ color: '#8a96a8' }}>No active orders.</Typography>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} lg={7}>
          <Paper
            sx={{
              p: { xs: 2.5, md: 3 },
              height: '100%',
              borderRadius: 4,
              backgroundColor: '#121a24',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700, mb: 0.5 }}>
              Recent Trades
            </Typography>
            <Typography sx={{ color: '#8a96a8', mb: 2.5 }}>
              Executions update automatically as the trading book moves.
            </Typography>

            {isLoading && !recentTrades.length ? (
              <TableSkeleton rows={4} />
            ) : recentTrades.length ? (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={tableHeadSx}>Asset</TableCell>
                    <TableCell sx={tableHeadSx}>Side</TableCell>
                    <TableCell sx={tableHeadSx}>Price</TableCell>
                    <TableCell sx={tableHeadSx}>Quantity</TableCell>
                    <TableCell sx={tableHeadSx}>Time</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentTrades.map((trade) => (
                    <TableRow key={trade.id}>
                      <TableCell sx={tableCellSx}>
                        <Typography sx={{ fontWeight: 600 }}>{trade.title}</Typography>
                        <Typography variant="body2" sx={{ color: '#8a96a8' }}>
                          {trade.symbol}
                        </Typography>
                      </TableCell>
                      <TableCell
                        sx={{
                          ...tableCellSx,
                          color: trade.side === 'buy' ? '#00d68f' : '#ff7a7a',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                        }}
                      >
                        {trade.side}
                      </TableCell>
                      <TableCell sx={tableCellSx}>{formatCurrency(trade.price)}</TableCell>
                      <TableCell sx={tableCellSx}>{formatNumber(trade.quantity)}</TableCell>
                      <TableCell sx={tableCellSx}>
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
              <Typography sx={{ color: '#8a96a8' }}>No recent trading activity.</Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}
