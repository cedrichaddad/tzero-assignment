'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  Button,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Skeleton,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material'
import { ArrowForward, NorthEast } from '@mui/icons-material'
import TradingAccountSection from './TradingAccountSection'
import { useAggregatedPortfolio } from '@/hooks/useAggregatedPortfolio'
import { formatCurrency, formatNumber } from '@/lib/investmentUtils'
import styles from './Portfolio.module.css'

type ToastState = {
  open: boolean
  message: string
  severity: 'success' | 'error'
}

function getActionErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error && 'response' in error) {
    const message = (error as { response?: { data?: { error?: string } } }).response?.data?.error
    if (message) {
      return message
    }
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Unable to complete that action right now.'
}

function MetricCard({
  eyebrow,
  title,
  value,
  description,
  loading,
}: {
  eyebrow: string
  title: string
  value: number
  description: string
  loading: boolean
}) {
  return (
    <Paper
      sx={{
        p: { xs: 2.5, md: 3 },
        borderRadius: 4,
        minHeight: 172,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: 'linear-gradient(180deg, rgba(13,18,28,0.96) 0%, rgba(13,18,28,0.82) 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <Box>
        <Typography sx={{ color: '#8a96a8', fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          {eyebrow}
        </Typography>
        <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700, mt: 0.75 }}>
          {title}
        </Typography>
      </Box>

      <Box>
        {loading ? (
          <Skeleton variant="rounded" width="70%" height={42} sx={{ borderRadius: 2, bgcolor: 'rgba(255,255,255,0.1)' }} />
        ) : (
          <Typography variant="h3" sx={{ color: '#ffffff', fontWeight: 700, lineHeight: 1.05 }}>
            {formatCurrency(value)}
          </Typography>
        )}
        <Typography sx={{ color: '#8a96a8', mt: 1.5 }}>{description}</Typography>
      </Box>
    </Paper>
  )
}

function WalletCard({
  title,
  subtitle,
  primaryValue,
  secondaryValue,
  secondaryLabel,
  tertiaryValue,
  tertiaryLabel,
  primaryAction,
  secondaryAction,
  loading,
}: {
  title: string
  subtitle: string
  primaryValue: number
  secondaryValue?: number
  secondaryLabel?: string
  tertiaryValue?: number
  tertiaryLabel?: string
  primaryAction: {
    label: string
    onClick: () => void
    disabled?: boolean
  }
  secondaryAction?: {
    label: string
    disabled?: boolean
  }
  loading: boolean
}) {
  return (
    <Paper
      sx={{
        p: { xs: 2.5, md: 3 },
        borderRadius: 4,
        backgroundColor: '#121a24',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
        <Box>
          <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700 }}>
            {title}
          </Typography>
          <Typography sx={{ color: '#8a96a8', mt: 0.5 }}>{subtitle}</Typography>
        </Box>
        <NorthEast sx={{ color: '#00d68f' }} />
      </Stack>

      <Box sx={{ mt: 3 }}>
        {loading ? (
          <Skeleton variant="rounded" width="52%" height={38} sx={{ borderRadius: 2, bgcolor: 'rgba(255,255,255,0.1)' }} />
        ) : (
          <Typography variant="h4" sx={{ color: '#ffffff', fontWeight: 700 }}>
            {formatCurrency(primaryValue)}
          </Typography>
        )}
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2.5 }}>
        {secondaryLabel ? (
          <Paper
            elevation={0}
            sx={{
              p: 2,
              flex: 1,
              backgroundColor: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 3,
            }}
          >
            <Typography sx={{ color: '#8a96a8', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {secondaryLabel}
            </Typography>
            <Typography sx={{ color: '#ffffff', fontWeight: 700, mt: 0.75 }}>
              {loading ? '...' : formatCurrency(secondaryValue ?? 0)}
            </Typography>
          </Paper>
        ) : null}
        {tertiaryLabel ? (
          <Paper
            elevation={0}
            sx={{
              p: 2,
              flex: 1,
              backgroundColor: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 3,
            }}
          >
            <Typography sx={{ color: '#8a96a8', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {tertiaryLabel}
            </Typography>
            <Typography sx={{ color: '#ffffff', fontWeight: 700, mt: 0.75 }}>
              {loading ? '...' : formatCurrency(tertiaryValue ?? 0)}
            </Typography>
          </Paper>
        ) : null}
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 3 }}>
        <Button
          variant="contained"
          onClick={primaryAction.onClick}
          disabled={primaryAction.disabled}
          sx={{
            flex: 1,
            minHeight: 44,
            borderRadius: 2.5,
            textTransform: 'none',
            fontWeight: 700,
            backgroundColor: '#00d68f',
            color: '#07130f',
            '&:hover': {
              backgroundColor: '#00b879',
            },
          }}
        >
          {primaryAction.label}
        </Button>
        {secondaryAction ? (
          <Button
            variant="outlined"
            disabled={secondaryAction.disabled}
            sx={{
              flex: 1,
              minHeight: 44,
              borderRadius: 2.5,
              textTransform: 'none',
              fontWeight: 700,
              borderColor: 'rgba(255,255,255,0.14)',
              color: '#d7dbe2',
            }}
          >
            {secondaryAction.label}
          </Button>
        ) : null}
      </Stack>
    </Paper>
  )
}

export default function Portfolio() {
  const router = useRouter()
  const {
    globalNetWorth,
    totalCash,
    totalInvested,
    wallets,
    holdings,
    openOrders,
    recentTrades,
    isLoading,
    isError,
    errors,
    hasUsableData,
    cancelOrder,
    isCancellingOrderId,
  } = useAggregatedPortfolio()
  const [toast, setToast] = useState<ToastState>({
    open: false,
    message: '',
    severity: 'success',
  })

  const errorMessages = Object.values(errors).filter(Boolean)

  const handleCancelOrder = async (orderId: string) => {
    try {
      await cancelOrder(orderId)
      setToast({
        open: true,
        message: 'Order successfully cancelled.',
        severity: 'success',
      })
    } catch (error) {
      setToast({
        open: true,
        message: getActionErrorMessage(error),
        severity: 'error',
      })
    }
  }

  if (isError && !hasUsableData) {
    return (
      <Box className={styles.portfolioContainer}>
        <Paper
          sx={{
            p: { xs: 3, md: 4 },
            borderRadius: 4,
            backgroundColor: '#121a24',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <Alert severity="error" sx={{ borderRadius: 3 }}>
            {errorMessages.join(' ') || 'Unable to load the portfolio right now.'}
          </Alert>
        </Paper>
      </Box>
    )
  }

  return (
    <Box className={styles.portfolioContainer}>
      <Box className={styles.sectionStack}>
        {isError ? (
          <Alert severity="warning" sx={{ borderRadius: 3 }}>
            {errorMessages.join(' ') || 'Some portfolio data is temporarily unavailable.'}
          </Alert>
        ) : null}

        <Box className={styles.heroGrid}>
          <MetricCard
            eyebrow="Global Overview"
            title="Global Net Worth"
            value={globalNetWorth}
            description="Combined cash plus marked-to-market value of active positions."
            loading={isLoading}
          />
          <MetricCard
            eyebrow="Liquidity"
            title="Total Cash"
            value={totalCash}
            description="Combined purchasing power across banking and trading wallets."
            loading={isLoading}
          />
          <MetricCard
            eyebrow="Positions"
            title="Total Invested"
            value={totalInvested}
            description="Current market value of all active secondary-market positions."
            loading={isLoading}
          />
        </Box>

        <Box className={styles.walletGrid}>
          <WalletCard
            title="Banking Wallet"
            subtitle="Primary cash ledger used for deposits and transfers."
            primaryValue={wallets.banking}
            primaryAction={{
              label: 'Deposit Funds',
              onClick: () => router.push('/account/banking/deposit'),
            }}
            loading={isLoading}
          />
          <WalletCard
            title="Trading Wallet"
            subtitle="Broker-dealer ledger isolated from the banking wallet."
            primaryValue={wallets.tradingCash}
            secondaryValue={wallets.lockedTrading}
            secondaryLabel="Locked in Open Orders"
            tertiaryValue={wallets.availableTrading}
            tertiaryLabel="Available Buying Power"
            primaryAction={{
              label: 'View Marketplace',
              onClick: () => router.push('/investing/secondary-trading'),
            }}
            secondaryAction={{
              label: 'Transfer from Banking (T+1)',
              disabled: true,
            }}
            loading={isLoading}
          />
        </Box>

        <TradingAccountSection
          holdings={holdings}
          openOrders={openOrders}
          recentTrades={recentTrades}
          isLoading={isLoading}
          isCancellingOrderId={isCancellingOrderId}
          onCancelOrder={handleCancelOrder}
        />

        <Paper
          sx={{
            p: { xs: 2.5, md: 3 },
            borderRadius: 4,
            backgroundColor: '#121a24',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700, mb: 0.5 }}>
            Portfolio Notes
          </Typography>
          <Typography sx={{ color: '#8a96a8', mb: 2.5 }}>
            Banking cash and trading buying power are intentionally segregated. Trading accounts rely on seeded funds until a T+1 sweep workflow exists.
          </Typography>

          <List disablePadding>
            <ListItemButton
              onClick={() => router.push('/account/banking')}
              sx={{
                px: 0,
                py: 1.5,
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <ListItemText
                primary="Transfers & banking activity"
                secondary={`Current banking balance: ${formatCurrency(wallets.banking)}`}
                primaryTypographyProps={{ color: '#ffffff', fontWeight: 600 }}
                secondaryTypographyProps={{ color: '#8a96a8' }}
              />
              <ArrowForward sx={{ color: '#8a96a8' }} />
            </ListItemButton>
            <ListItemButton
              onClick={() => router.push('/investing/secondary-trading')}
              sx={{ px: 0, py: 1.5 }}
            >
              <ListItemText
                primary="Secondary marketplace"
                secondary={
                  isLoading
                    ? 'Refreshing wallet data...'
                    : `${formatNumber(openOrders.length)} open orders · ${formatNumber(recentTrades.length)} recent trades`
                }
                primaryTypographyProps={{ color: '#ffffff', fontWeight: 600 }}
                secondaryTypographyProps={{ color: '#8a96a8' }}
              />
              <ArrowForward sx={{ color: '#8a96a8' }} />
            </ListItemButton>
          </List>
        </Paper>
      </Box>

      <Snackbar
        open={toast.open}
        autoHideDuration={6000}
        onClose={() => setToast((current) => ({ ...current, open: false }))}
      >
        <Alert
          severity={toast.severity}
          onClose={() => setToast((current) => ({ ...current, open: false }))}
          sx={{ width: '100%' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
