import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Cert } from '../content'

/** Full-screen certificate viewer. */
export default function Lightbox({ cert, onClose }: { cert: Cert; onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', key)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', key)
      document.body.style.overflow = ''
    }
  }, [onClose])
  const src = `/certs/${cert.file}.webp`
  return createPortal(
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={cert.title} onClick={onClose}>
      <figure onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={cert.title} />
        <figcaption>
          <span>{cert.title}</span>
          <a href={src} target="_blank" rel="noreferrer">Full size ↗</a>
        </figcaption>
      </figure>
      <button className="sheet-close lightbox-close" onClick={onClose} aria-label="Close">✕</button>
    </div>,
    document.body,
  )
}

export function CertThumbs({ certs, onOpen }: { certs?: Cert[]; onOpen: (c: Cert) => void }) {
  if (!certs?.length) return null
  return (
    <div className="certs">
      {certs.map((c) => (
        <button key={c.file} className="cert" onClick={() => onOpen(c)} aria-label={`View ${c.title}`}>
          <img src={`/certs/${c.file}-thumb.webp`} alt="" loading="lazy" />
          <span>{c.title}</span>
        </button>
      ))}
    </div>
  )
}
