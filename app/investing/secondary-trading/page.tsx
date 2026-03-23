'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import {
  Alert,
  Box,
  Chip,
  Container,
  Grid,
  Paper,
  Skeleton,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/investmentUtils'
import type { TradingAssetSummary } from '@/lib/tradingTypes'

type AssetsResponse = {
  assets: TradingAssetSummary[]
  total: number
}

const fetcher = async (url: string) => {
  const response = await api.get<AssetsResponse>(url)
  return response.data
}

const categories = ['all', 'tech', 'healthcare', 'finance', 'energy', 'consumer']

export default function SecondaryTradingPage() {
  const router = useRouter()
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (category !== 'all') {
      params.set('category', category)
    }
    if (search.trim()) {
      params.set('search', search.trim())
    }
    const suffix = params.toString()
    return suffix ? `?${suffix}` : ''
  }, [category, search])

  const { data, error, isLoading } = useSWR(`/trading/assets${queryString}`, fetcher, {
    refreshInterval: 5000,
    dedupingInterval: 2000,
    keepPreviousData: true,
  })

  return (
    <Box sx={{ minHeight: '100vh', background: 'radial-gradient(circle at top, rgba(0,255,136,0.12), rgba(0,0,0,0) 40%), #02050a' }}>
      <Header />
      <Container maxWidth="xl" sx={{ pt: { xs: '104px', md: '128px' }, pb: 6 }}>
        <Paper
          sx={{
            p: { xs: 3, md: 5 },
            mb: 4,
            borderRadius: 4,
            background: 'linear-gradient(135deg, rgba(0,255,136,0.14), rgba(9,15,22,0.96) 58%, rgba(4,7,11,0.98))',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <Typography variant="h3" sx={{ color: '#ffffff', fontWeight: 800, maxWidth: 760 }}>
            Secondary Marketplace
          </Typography>
          <Typography sx={{ color: '#b7c0cd', maxWidth: 700, mt: 1.5, mb: 3 }}>
            Browse live executable liquidity, inspect the book, and trade digital securities with limit-order precision.
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} lg={7}>
              <TextField
                fullWidth
                placeholder="Search by company name, symbol, or description"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </Grid>
            <Grid item xs={12} lg={5}>
              <Tabs
                value={category}
                onChange={(_, next) => setCategory(next)}
                variant="scrollable"
                scrollButtons="auto"
              >
                {categories.map((value) => (
                  <Tab key={value} value={value} label={value === 'all' ? 'All' : value} />
                ))}
              </Tabs>
            </Grid>
          </Grid>
        </Paper>

        {error ? (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error.response?.data?.error ?? 'Failed to load trading assets.'}
          </Alert>
        ) : null}

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography sx={{ color: '#ffffff', fontWeight: 700 }}>
            {data?.total ?? 0} tradable assets
          </Typography>
          <Typography sx={{ color: '#7f8a99', fontSize: 14 }}>
            Quotes refresh automatically.
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {isLoading && !data
            ? Array.from({ length: 6 }).map((_, index) => (
                <Grid item xs={12} md={6} xl={4} key={index}>
                  <Paper sx={{ p: 3, borderRadius: 4 }}>
                    <Skeleton variant="text" height={40} />
                    <Skeleton variant="text" width="60%" />
                    <Skeleton variant="rectangular" height={140} sx={{ mt: 2, borderRadius: 3 }} />
                  </Paper>
                </Grid>
              ))
            : data?.assets.map((asset) => (
                <Grid item xs={12} md={6} xl={4} key={asset.id}>
                  <Paper
                    onClick={() => router.push(`/investing/secondary-trading/${asset.id}`)}
                    sx={{
                      p: 3,
                      borderRadius: 4,
                      cursor: 'pointer',
                      height: '100%',
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
                      border: '1px solid rgba(255,255,255,0.08)',
                      transition: 'transform 150ms ease, border-color 150ms ease',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        borderColor: 'rgba(0,255,136,0.35)',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                      <Box>
                        <Typography variant="h5" sx={{ color: '#ffffff', fontWeight: 700, mb: 0.5 }}>
                          {asset.title}
                        </Typography>
                        <Typography sx={{ color: '#7f8a99' }}>{asset.symbol}</Typography>
                      </Box>
                      <Chip
                        label={asset.category}
                        sx={{
                          backgroundColor: 'rgba(0,255,136,0.12)',
                          color: '#00FF88',
                          textTransform: 'capitalize',
                        }}
                      />
                    </Box>
                    <Typography variant="h4" sx={{ color: '#ffffff', fontWeight: 800, mb: 1 }}>
                      {formatCurrency(asset.lastTradePrice ?? asset.currentValue)}
                    </Typography>
                    <Typography sx={{ color: asset.performancePercent >= 0 ? '#00FF88' : '#ff6b6b', fontWeight: 700, mb: 3 }}>
                      {asset.performancePercent >= 0 ? '+' : ''}
                      {asset.performancePercent.toFixed(2)}%
                    </Typography>
                    <Grid container spacing={1.5}>
                      <Grid item xs={4}>
                        <Typography sx={{ color: '#7f8a99', fontSize: 12 }}>Best Bid</Typography>
                        <Typography sx={{ color: '#ffffff', fontWeight: 700 }}>
                          {asset.bestBid ? formatCurrency(asset.bestBid) : '—'}
                        </Typography>
                      </Grid>
                      <Grid item xs={4}>
                        <Typography sx={{ color: '#7f8a99', fontSize: 12 }}>Best Ask</Typography>
                        <Typography sx={{ color: '#ffffff', fontWeight: 700 }}>
                          {asset.bestAsk ? formatCurrency(asset.bestAsk) : '—'}
                        </Typography>
                      </Grid>
                      <Grid item xs={4}>
                        <Typography sx={{ color: '#7f8a99', fontSize: 12 }}>Spread</Typography>
                        <Typography sx={{ color: '#ffffff', fontWeight: 700 }}>
                          {asset.spread ? formatCurrency(asset.spread) : '—'}
                        </Typography>
                      </Grid>
                    </Grid>
                    <Typography sx={{ color: '#b7c0cd', mt: 3, lineHeight: 1.7 }}>
                      {asset.companyDescription}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, mt: 3, color: '#7f8a99', fontSize: 13 }}>
                      <span>Volume: {asset.avgVolume ?? asset.volume ?? '—'}</span>
                      <span>Market Cap: {asset.marketCap ?? '—'}</span>
                    </Box>
                  </Paper>
                </Grid>
              ))}
        </Grid>

        {!isLoading && data && data.assets.length === 0 ? (
          <Paper sx={{ mt: 4, p: 4, borderRadius: 4, textAlign: 'center' }}>
            <Typography sx={{ color: '#ffffff', fontWeight: 700, mb: 1 }}>No assets matched your filters.</Typography>
            <Typography sx={{ color: '#7f8a99' }}>
              Try a broader search or reset the category filters.
            </Typography>
          </Paper>
        ) : null}
      </Container>
    </Box>
  )
}
