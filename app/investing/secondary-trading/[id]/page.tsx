'use client'

import useSWR from 'swr'
import { useParams, useRouter } from 'next/navigation'
import Header from '@/components/Header'
import PriceChart from '@/components/trading/PriceChart'
import OrderBook from '@/components/trading/OrderBook'
import OrderEntryCard from '@/components/trading/OrderEntryCard'
import TradingOrdersTable from '@/components/trading/TradingOrdersTable'
import { useAuth } from '@/contexts/AuthContext'
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Grid,
  Paper,
  Skeleton,
  Typography,
} from '@mui/material'
import { ArrowBack } from '@mui/icons-material'
import api from '@/lib/api'
import { formatCurrency, formatNumber } from '@/lib/investmentUtils'
import type { TradingAssetDetailResponse } from '@/lib/tradingTypes'

const fetcher = async (url: string) => {
  const response = await api.get<TradingAssetDetailResponse>(url)
  return response.data
}

export default function SecondaryTradingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { isAuthenticated } = useAuth()
  const assetId = Array.isArray(params.id) ? params.id[0] : params.id

  const { data, error, isLoading, mutate } = useSWR(assetId ? `/trading/assets/${assetId}` : null, fetcher, {
    refreshInterval: 3000,
    dedupingInterval: 2000,
    focusThrottleInterval: 3000,
    keepPreviousData: true,
  })

  const handleCancelOrder = async (orderId: string) => {
    await api.delete(`/trading/orders/${orderId}`)
    void mutate()
  }

  return (
    <Box sx={{ minHeight: '100vh', background: 'radial-gradient(circle at top, rgba(0,255,136,0.12), rgba(0,0,0,0) 40%), #02050a' }}>
      <Header />
      <Container maxWidth="xl" sx={{ pt: { xs: '104px', md: '124px' }, pb: 6 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => router.push('/investing/secondary-trading')}
          sx={{ color: '#ffffff', mb: 2 }}
        >
          Back to Marketplace
        </Button>

        {error ? (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error.response?.data?.error ?? 'Failed to load trading asset.'}
          </Alert>
        ) : null}

        {isLoading && !data ? (
          <Paper sx={{ p: 4, borderRadius: 4 }}>
            <Skeleton variant="text" height={64} />
            <Skeleton variant="text" width="40%" />
            <Skeleton variant="rectangular" height={320} sx={{ mt: 3, borderRadius: 3 }} />
          </Paper>
        ) : null}

        {data ? (
          <>
            <Paper
              sx={{
                p: { xs: 3, md: 4 },
                mb: 4,
                borderRadius: 4,
                background: 'linear-gradient(135deg, rgba(0,255,136,0.14), rgba(9,15,22,0.96) 58%, rgba(4,7,11,0.98))',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                <Box>
                  <Typography variant="h3" sx={{ color: '#ffffff', fontWeight: 800 }}>
                    {data.asset.title}
                  </Typography>
                  <Typography sx={{ color: '#b7c0cd', mt: 1 }}>
                    {data.asset.symbol} • {data.asset.category}
                  </Typography>
                </Box>
                <Chip
                  label={data.asset.category}
                  sx={{ backgroundColor: 'rgba(0,255,136,0.12)', color: '#00FF88', textTransform: 'capitalize' }}
                />
              </Box>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12} md={4}>
                  <Typography sx={{ color: '#7f8a99', fontSize: 13 }}>Last Trade</Typography>
                  <Typography variant="h4" sx={{ color: '#ffffff', fontWeight: 800 }}>
                    {formatCurrency(data.asset.lastTradePrice ?? data.asset.currentValue)}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography sx={{ color: '#7f8a99', fontSize: 13 }}>Best Bid / Ask</Typography>
                  <Typography sx={{ color: '#ffffff', fontWeight: 700 }}>
                    {data.asset.bestBid ? formatCurrency(data.asset.bestBid) : '—'} / {data.asset.bestAsk ? formatCurrency(data.asset.bestAsk) : '—'}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography sx={{ color: '#7f8a99', fontSize: 13 }}>Spread</Typography>
                  <Typography sx={{ color: '#ffffff', fontWeight: 700 }}>
                    {data.asset.spread ? formatCurrency(data.asset.spread) : '—'}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>

            <Grid container spacing={3}>
              <Grid item xs={12} lg={8}>
                <Paper sx={{ p: 3, borderRadius: 4, mb: 3 }}>
                  <PriceChart data={data.asset.dailyHistory} />
                </Paper>
                <Paper sx={{ p: 3, borderRadius: 4, mb: 3 }}>
                  <OrderBook bids={data.orderBook.bids} asks={data.orderBook.asks} />
                </Paper>
                <Paper sx={{ p: 3, borderRadius: 4, mb: 3 }}>
                  <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700, mb: 2 }}>
                    Company Snapshot
                  </Typography>
                  <Typography sx={{ color: '#b7c0cd', lineHeight: 1.8, mb: 3 }}>
                    {data.asset.companyDescription}
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <Typography sx={{ color: '#7f8a99', fontSize: 13 }}>Market Cap</Typography>
                      <Typography sx={{ color: '#ffffff', fontWeight: 700 }}>{data.asset.marketCap ?? '—'}</Typography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Typography sx={{ color: '#7f8a99', fontSize: 13 }}>Average Volume</Typography>
                      <Typography sx={{ color: '#ffffff', fontWeight: 700 }}>{data.asset.avgVolume ?? data.asset.volume ?? '—'}</Typography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Typography sx={{ color: '#7f8a99', fontSize: 13 }}>52-Week Range</Typography>
                      <Typography sx={{ color: '#ffffff', fontWeight: 700 }}>{data.asset.priceRange ?? '—'}</Typography>
                    </Grid>
                  </Grid>
                </Paper>
                <Paper sx={{ p: 3, borderRadius: 4 }}>
                  <TradingOrdersTable
                    openOrders={data.user?.openOrders ?? []}
                    trades={data.user?.recentTrades ?? []}
                    onCancelOrder={isAuthenticated ? handleCancelOrder : undefined}
                  />
                </Paper>
              </Grid>

              <Grid item xs={12} lg={4}>
                <Paper sx={{ p: 3, borderRadius: 4, mb: 3, position: { lg: 'sticky' }, top: { lg: 104 } }}>
                  <OrderEntryCard
                    symbol={data.asset.symbol}
                    title={data.asset.title}
                    bestBid={data.asset.bestBid}
                    bestAsk={data.asset.bestAsk}
                    balance={data.user?.balance ?? null}
                    position={data.user?.position ?? null}
                    isAuthenticated={isAuthenticated}
                    onSubmitted={() => void mutate()}
                  />
                </Paper>
                <Paper sx={{ p: 3, borderRadius: 4 }}>
                  <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700, mb: 2 }}>
                    Trading Snapshot
                  </Typography>
                  {isAuthenticated && data.user ? (
                    <>
                      <Typography sx={{ color: '#7f8a99', fontSize: 13 }}>Available Cash</Typography>
                      <Typography sx={{ color: '#ffffff', fontWeight: 700, mb: 2 }}>
                        {formatCurrency(data.user.balance.availableCash)}
                      </Typography>
                      <Typography sx={{ color: '#7f8a99', fontSize: 13 }}>Current Position</Typography>
                      <Typography sx={{ color: '#ffffff', fontWeight: 700, mb: 1 }}>
                        {data.user.position ? `${formatNumber(data.user.position.shares)} shares` : 'No position'}
                      </Typography>
                      {data.user.position ? (
                        <Typography sx={{ color: '#b7c0cd' }}>
                          Avg cost {formatCurrency(data.user.position.avgCost)} • Market value {formatCurrency(data.user.position.marketValue)}
                        </Typography>
                      ) : null}
                    </>
                  ) : (
                    <Typography sx={{ color: '#b7c0cd' }}>
                      Sign in to see your balances, positions, and order controls for this market.
                    </Typography>
                  )}
                </Paper>
              </Grid>
            </Grid>
          </>
        ) : null}
      </Container>
    </Box>
  )
}
