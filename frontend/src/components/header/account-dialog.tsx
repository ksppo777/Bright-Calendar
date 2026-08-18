import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLanguage } from '@/components/language-provider'
import {
  GetGoogleClientConfig,
  GoogleAuthURL,
  GoogleExchangeCode,
  GoogleLogout,
  GoogleTokenInfo,
  SaveGoogleClientConfig,
} from '../../../wailsjs/go/main/App'
import type { main } from '../../../wailsjs/go/models'
import { BrowserOpenURL } from '../../../wailsjs/runtime/runtime'
import GoogleStatusBadge from './google-status-badge'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function AccountDialog({ open, onOpenChange }: Props) {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<main.GoogleTokenInfo | null>(null)
  const [code, setCode] = useState('')
  const [authRequested, setAuthRequested] = useState(false)
  const [clientIdInput, setClientIdInput] = useState('')
  const [clientSecretInput, setClientSecretInput] = useState('')
  const [showConfigEdit, setShowConfigEdit] = useState(false)

  useEffect(() => {
    if (!open) return
    void refreshInfo()
  }, [open])

  async function refreshInfo() {
    setLoading(true)
    setError(null)
    try {
      const [data, existingClientId] = await Promise.all([
        GoogleTokenInfo(),
        GetGoogleClientConfig().catch(() => ''),
      ])
      setInfo(data)
      if (existingClientId) {
        setClientIdInput(existingClientId)
      }
      if (data.connected) {
        window.dispatchEvent(new Event('google-connected'))
      }
    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }

  async function saveClientConfig() {
    const id = clientIdInput.trim()
    const secret = clientSecretInput.trim()
    if (!id || !secret) {
      setError(t('accountClientConfigRequired'))
      return
    }
    setLoading(true)
    setError(null)
    try {
      await SaveGoogleClientConfig(id, secret)
      setClientSecretInput('')
      setShowConfigEdit(false)
      await refreshInfo()
    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }

  async function startAuth() {
    setError(null)
    setAuthRequested(true)
    try {
      const url = await GoogleAuthURL(Date.now().toString())
      BrowserOpenURL(url)
    } catch (err: any) {
      setError(err?.message ?? String(err))
    }
  }

  async function submitCode() {
    const trimmed = code.trim()
    if (!trimmed) {
      setError(t('accountEnterCodePlaceholder'))
      return
    }
    setLoading(true)
    setError(null)
    try {
      await GoogleExchangeCode(trimmed)
      setCode('')
      setAuthRequested(false)
      await refreshInfo()
    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }

  async function logout() {
    setLoading(true)
    setError(null)
    try {
      await GoogleLogout()
      await refreshInfo()
      // Notify UI to drop locally cached events immediately after logout.
      window.dispatchEvent(new Event('local-data-cleared'))
    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }

  const notConfigured = !!(info && !info.clientConfigured)
  const connected = info?.connected

  useEffect(() => {
    if (!open || !authRequested) return
    const id = setInterval(async () => {
      try {
        const data = await GoogleTokenInfo()
        setInfo(data)
        if (data.connected) {
          setAuthRequested(false)
          window.dispatchEvent(new Event('google-connected'))
        }
      } catch (err: any) {
        setError(err?.message ?? String(err))
      }
    }, 3000)
    return () => clearInterval(id)
  }, [open, authRequested])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div>
              <DialogTitle>{t('menuAccount')}</DialogTitle>
            </div>
            <GoogleStatusBadge />
          </div>
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {(notConfigured || showConfigEdit) && (
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm space-y-3">
            <div>
              <div className="font-semibold text-sm">{t('accountClientConfig')}</div>
              {notConfigured && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {t('accountNotConfiguredDesc')}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="space-y-1">
                <Label htmlFor="google-client-id" className="text-xs font-medium">Client ID</Label>
                <Input
                  id="google-client-id"
                  placeholder="xxxx.apps.googleusercontent.com"
                  value={clientIdInput}
                  onChange={(e) => setClientIdInput(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="google-client-secret" className="text-xs font-medium">Client Secret</Label>
                <Input
                  id="google-client-secret"
                  type="password"
                  placeholder={notConfigured ? 'GOCSPX-xxxx' : '새 Secret 입력 시 변경'}
                  value={clientSecretInput}
                  onChange={(e) => setClientSecretInput(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                {showConfigEdit && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setShowConfigEdit(false)}
                  >
                    {t('accountClientConfigCancel')}
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={loading || !clientIdInput.trim() || !clientSecretInput.trim()}
                  onClick={saveClientConfig}
                >
                  {t('accountClientConfigSave')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {connected && info && (
          <div className="flex flex-col gap-2 rounded-md border bg-muted/40 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
              {info.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={info.picture}
                  alt="avatar"
                  className="h-10 w-10 rounded-full border object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full border bg-muted text-sm font-semibold uppercase">
                  {(info.userName || info.userEmail || '?').slice(0, 2)}
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-sm font-semibold leading-tight">
                  {info.userName || t('accountUnknownUser')}
                </span>
                <span className="text-xs text-muted-foreground">
                  {info.userEmail || t('accountUnknownEmail')}
                </span>
              </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={logout}
                disabled={loading}
              >
                {t('accountLogoutButton')}
              </Button>
            </div>
          </div>
        )}

        {!connected && (
          <div className="flex flex-col gap-3">
            <Button onClick={startAuth} disabled={loading || notConfigured}>
              {t('accountStartSync')}
            </Button>
          </div>
        )}

        {!notConfigured && !showConfigEdit && (
          <div className="flex justify-between items-center text-xs text-muted-foreground px-1">
            <span>{t('accountClientConfig')}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowConfigEdit(true)}
            >
              {t('accountClientConfigEdit')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
