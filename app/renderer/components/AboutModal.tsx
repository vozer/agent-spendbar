import { useState, type MouseEvent, type ReactNode } from 'react'

import { displayVersion } from '../lib/platform'
import { FlameMark } from './FlameMark'
import { Icon } from './icons'
import { BUILD_STAMP } from '../lib/build'
import { useEscape } from '../hooks/useEscape'
import { t } from '../i18n'
import { useUpdateStatus } from '../hooks/useUpdateStatus'
import { UpdateAction } from './UpdateBanner'
import { codeburn } from '../lib/ipc'
import { DUR, useExitAnimation } from '../lib/motion'

export type SocialLink = {
  label: string
  url: string
  icon: ReactNode
}

/** Agent Spendbar's maintained repository. */
export const SOCIALS: SocialLink[] = [
  { label: 'GitHub', url: 'https://github.com/vozer/agent-spendbar', icon: null },
]

function openExternal(event: MouseEvent<HTMLAnchorElement>, url: string): void {
  event.preventDefault()
  void codeburn.openExternal(url)
}

export function AboutModal({ socials = SOCIALS, openKey, onClose }: { socials?: SocialLink[]; openKey: string; onClose: () => void }) {
  const status = useUpdateStatus()
  const [checked, setChecked] = useState(false)
  const { closing, beginExit } = useExitAnimation(onClose, DUR.base, openKey)

  useEscape(true, beginExit)

  return (
    <div className={closing ? 'about-modal-backdrop closing' : 'about-modal-backdrop'} onClick={beginExit}>
      <div
        className="about-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-modal-title"
        onClick={event => event.stopPropagation()}
      >
        <button className="about-modal-close" type="button" aria-label={t('shared.aboutModal.closeAria')} onClick={beginExit}><Icon name="x" /></button>
        <div className="about-modal-grid">
          <div className="about-modal-hero">
            <span className="about-modal-logo" aria-hidden="true"><FlameMark size={52} /></span>
            <div className="about-modal-name" id="about-modal-title">Agent Spendbar</div>
            <div className="about-modal-version">v{displayVersion()}</div>
            <div className="about-modal-build">{BUILD_STAMP}</div>
            <div className="about-modal-tagline">{t('shared.aboutModal.tagline')}</div>
          </div>
          <div className="about-modal-side">
            <div className="about-modal-section">
              <div className="about-modal-section-title">{t('shared.aboutModal.linksTitle')}</div>
              {socials.map(social => (
                <a
                  className="about-modal-link"
                  href={social.url}
                  key={social.label}
                  onClick={event => openExternal(event, social.url)}
                >
                  {social.icon}
                  <span>{social.label}</span>
                  <Icon name="arrow-up-right" className="about-modal-external" />
                </a>
              ))}
            </div>
            {!status?.storeManaged && <div className="about-modal-section about-modal-updates">
              <div className="about-modal-section-title">{t('shared.aboutModal.updatesTitle')}</div>
              <button
                className="about-modal-update-button"
                type="button"
                onClick={() => setChecked(true)}
              >
                {t('shared.aboutModal.checkForUpdates')}
              </button>
              {checked && (
                <p className="about-modal-update-note" role="status">
                  {status?.updateAvailable && status.tag ? (
                    <>
                      {t('shared.aboutModal.updateAvailable', { version: status.latestVersion ?? '' })}{' '}
                      <UpdateAction status={status} downloadLabel={t('shared.aboutModal.download')} />
                    </>
                  ) : status?.latestVersion ? (
                    t('shared.aboutModal.upToDate')
                  ) : (
                    t('shared.aboutModal.unableToCheck')
                  )}
                </p>
              )}
            </div>}
          </div>
        </div>
        <div className="about-modal-credit">{t('shared.aboutModal.developedBy')}</div>
      </div>
    </div>
  )
}
