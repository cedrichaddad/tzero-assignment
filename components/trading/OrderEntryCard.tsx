'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Snackbar,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/investmentUtils'
import type { TradingBalanceSnapshot, TradingHoldingView, TradingOrderSide, TradingTimeInForce } from '@/lib/tradingTypes'

interface OrderEntryCardProps {
  symbol: string
  title: string
  bestBid: number | null
  bestAsk: number | null
  balance: TradingBalanceSnapshot | null
  position: TradingHoldingView | null
  isAuthenticated: boolean
  onSubmitted: () => void
}

export default function OrderEntryCard({
  symbol,
  title,
  bestBid,
  bestAsk,
  balance,
  position,
  isAuthenticated,
  onSubmitted,
}: OrderEntryCardProps) {
  const [side, setSide] = useState<TradingOrderSide>('buy')
  const [quantity, setQuantity] = useState('10')
  const [price, setPrice] = useState(String(bestAsk ?? bestBid ?? ''))
  const [timeInForce, setTimeInForce] = useState<TradingTimeInForce>('day')
  const [goodTilDate, setGoodTilDate] = useState('')
  const [reviewOpen, setReviewOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [snackbar, setSnackbar] = useState<{ severity: 'success' | 'error'; message: string } | null>(null)
  const pendingClientOrderId = useRef<string | null>(null)

  useEffect(() => {
    setPrice(String(side === 'buy' ? bestAsk ?? bestBid ?? '' : bestBid ?? bestAsk ?? ''))
  }, [bestAsk, bestBid, side])

  useEffect(() => {
    pendingClientOrderId.current = null
  }, [side, quantity, price, timeInForce, goodTilDate])

  const numericPrice = Number(price)
  const numericQuantity = Number(quantity)
  const estimatedTotal = useMemo(() => numericPrice * numericQuantity, [numericPrice, numericQuantity])
  const availableCash = balance?.availableCash ?? 0
  const availableShares = position?.availableShares ?? 0

  const validationError = useMemo(() => {
    if (!isAuthenticated) {
      return 'Sign in to submit an order.'
    }

    if (!Number.isInteger(numericQuantity) || numericQuantity <= 0) {
      return 'Quantity must be a positive whole number.'
    }

    if (!numericPrice || numericPrice <= 0) {
      return 'Price must be greater than zero.'
    }

    if (side === 'buy' && estimatedTotal > availableCash) {
      return 'Order exceeds your available trading cash.'
    }

    if (side === 'sell' && numericQuantity > availableShares) {
      return 'Order exceeds your available shares.'
    }

    if (timeInForce === 'gtd' && !goodTilDate) {
      return 'Choose a good-til-date for GTD orders.'
    }

    return null
  }, [availableCash, availableShares, estimatedTotal, goodTilDate, isAuthenticated, numericPrice, numericQuantity, side, timeInForce])

  const handleConfirm = async () => {
    if (validationError || loading) {
      return
    }

    setLoading(true)

    try {
      pendingClientOrderId.current ??=
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `client-${Date.now()}`

      await api.post('/trading/orders', {
        symbol,
        side,
        quantity: numericQuantity,
        price: numericPrice,
        timeInForce,
        goodTilDate: timeInForce === 'gtd' ? new Date(goodTilDate).toISOString() : null,
        clientOrderId: pendingClientOrderId.current,
      })

      setReviewOpen(false)
      setSnackbar({
        severity: 'success',
        message: `${side === 'buy' ? 'Buy' : 'Sell'} order submitted for ${title}.`,
      })
      pendingClientOrderId.current = null
      onSubmitted()
    } catch (error: any) {
      setSnackbar({
        severity: 'error',
        message: error.response?.data?.error ?? 'Failed to submit order.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700, mb: 2 }}>
        Place Limit Order
      </Typography>
      <Tabs
        value={side}
        onChange={(_, next) => setSide(next)}
        sx={{ mb: 2 }}
      >
        <Tab value="buy" label="Buy" />
        <Tab value="sell" label="Sell" />
      </Tabs>

      <Box sx={{ display: 'grid', gap: 2 }}>
        <TextField
          label="Quantity"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          type="number"
          inputProps={{ min: 1, step: 1 }}
        />
        <TextField
          label="Limit Price"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          type="number"
          inputProps={{ min: 0, step: 0.00001 }}
        />
        <TextField
          select
          label="Time In Force"
          value={timeInForce}
          onChange={(event) => setTimeInForce(event.target.value as TradingTimeInForce)}
        >
          <MenuItem value="day">Day</MenuItem>
          <MenuItem value="gtc">GTC</MenuItem>
          <MenuItem value="gtd">GTD</MenuItem>
        </TextField>
        {timeInForce === 'gtd' ? (
          <TextField
            label="Good Til Date"
            type="datetime-local"
            InputLabelProps={{ shrink: true }}
            value={goodTilDate}
            onChange={(event) => setGoodTilDate(event.target.value)}
          />
        ) : null}
      </Box>

      <Box
        sx={{
          mt: 3,
          p: 2,
          borderRadius: 3,
          backgroundColor: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <Typography sx={{ color: '#888888', fontSize: 13 }}>Available Cash</Typography>
        <Typography sx={{ color: '#ffffff', fontWeight: 700, mb: 1 }}>{formatCurrency(availableCash)}</Typography>
        <Typography sx={{ color: '#888888', fontSize: 13 }}>Available Shares</Typography>
        <Typography sx={{ color: '#ffffff', fontWeight: 700, mb: 1 }}>{availableShares.toLocaleString('en-US')}</Typography>
        <Typography sx={{ color: '#888888', fontSize: 13 }}>Estimated Notional</Typography>
        <Typography sx={{ color: '#ffffff', fontWeight: 700 }}>{formatCurrency(estimatedTotal || 0)}</Typography>
      </Box>

      {validationError ? (
        <Alert severity="warning" sx={{ mt: 2 }}>
          {validationError}
        </Alert>
      ) : null}

      <Button
        variant="contained"
        fullWidth
        sx={{ mt: 3 }}
        disabled={Boolean(validationError)}
        onClick={() => setReviewOpen(true)}
      >
        Review Order
      </Button>

      <Dialog open={reviewOpen} onClose={() => !loading && setReviewOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Review Order</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1 }}>
            {side.toUpperCase()} {numericQuantity || 0} shares of {title} ({symbol})
          </Typography>
          <Typography sx={{ color: '#888888', mb: 1 }}>Limit Price: {formatCurrency(numericPrice || 0)}</Typography>
          <Typography sx={{ color: '#888888', mb: 1 }}>Time In Force: {timeInForce.toUpperCase()}</Typography>
          <Typography sx={{ fontWeight: 700 }}>Estimated Total: {formatCurrency(estimatedTotal || 0)}</Typography>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setReviewOpen(false)} disabled={loading}>
            Back
          </Button>
          <Button variant="contained" onClick={() => void handleConfirm()} disabled={loading}>
            {loading ? 'Submitting...' : 'Submit Order'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {snackbar ? (
          <Alert severity={snackbar.severity} onClose={() => setSnackbar(null)} variant="filled">
            {snackbar.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  )
}
