'use client';

import React, { useEffect, useRef, useState } from 'react';

const ELEMENT_ID = 'qr-camera-region';

interface QrCameraProps {
  onToken: (token: string) => void;
}

/**
 * Mengambil token presensi dari hasil pembacaan QR. Admin menampilkan QR berisi
 * URL lengkap (/presensi?token=...), tapi kolom manual juga menerima token
 * telanjang -- keduanya dipetakan ke bentuk yang sama di sini.
 *
 * Extracts the attendance token from a QR read. The admin monitor renders a
 * full URL (/presensi?token=...), while the manual field also accepts a bare
 * token -- both are normalised to the same shape here.
 */
export function extractToken(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;

  if (text.includes('token=')) {
    try {
      return new URL(text).searchParams.get('token');
    } catch {
      // Bukan URL absolut; ambil potongan setelah token= / Not an absolute URL; take the part after token=
      return new URLSearchParams(text.slice(text.indexOf('?') + 1)).get('token');
    }
  }

  return text;
}

/**
 * Pemindai QR berbasis kamera perangkat.
 *
 * html5-qrcode diimpor dinamis di dalam effect: paketnya menyentuh `document`
 * saat modul dievaluasi, sehingga impor statis akan menggagalkan render server
 * Next.js. Kamera hanya tersedia pada origin HTTPS (atau localhost) -- di luar
 * itu browser menolak getUserMedia dan pengguna harus memakai kolom manual.
 *
 * Device-camera QR scanner.
 *
 * html5-qrcode is imported dynamically inside the effect: the package touches
 * `document` at module evaluation time, so a static import would break Next.js
 * server rendering. The camera is only available on HTTPS origins (or
 * localhost) -- elsewhere the browser refuses getUserMedia and the user must
 * fall back to the manual field.
 */
interface ZoomRange {
  min: number;
  max: number;
  step: number;
}

export default function QrCamera({ onToken }: QrCameraProps) {
  const [error, setError] = useState<string | null>(null);
  // Tanpa zoom, QR yang ditayangkan di layar proyektor terlalu kecil di frame
  // untuk terbaca dari tempat duduk peserta; mereka harus maju ke depan.
  //
  // Without zoom a QR shown on a projector is too small in frame to decode
  // from where participants sit; they have to walk up to it.
  const [zoomRange, setZoomRange] = useState<ZoomRange | null>(null);
  const [zoom, setZoom] = useState(1);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const handledRef = useRef(false);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  function applyZoom(value: number) {
    setZoom(value);
    const track = trackRef.current;
    if (!track) return;
    // Zoom bukan bagian dari tipe baku MediaTrackConstraintSet; hanya sebagian
    // perangkat mendukungnya dan penolakannya tidak boleh menghentikan
    // pemindaian.
    //
    // Zoom is not part of the standard MediaTrackConstraintSet; only some
    // devices support it and a rejection must not stop scanning.
    track
      .applyConstraints({ advanced: [{ zoom: value }] } as unknown as MediaTrackConstraints)
      .catch(() => {});
  }

  useEffect(() => {
    let scanner: { stop: () => Promise<void>; clear: () => void } | null = null;
    let cancelled = false;

    async function start() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;

        const instance = new Html5Qrcode(ELEMENT_ID);
        scanner = instance;

        await instance.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            // Token berotasi tiap 30 detik dan satu scan sudah cukup; abaikan
            // pembacaan berikutnya supaya tidak mengirim permintaan berulang.
            //
            // Tokens rotate every 30s and one scan is enough; ignore later
            // reads so we do not fire repeated requests.
            if (handledRef.current) return;
            const token = extractToken(decoded);
            if (!token) return;
            handledRef.current = true;
            onTokenRef.current(token);
          },
          () => {
            // Frame tanpa QR terbaca -- normal, bukan kesalahan.
            // Frame with no readable QR -- normal, not an error.
          }
        );

        if (cancelled) return;

        // Kemampuan zoom baru terbaca setelah stream berjalan; sebelum itu
        // track-nya belum ada.
        //
        // Zoom capability is only readable once the stream runs; before that
        // there is no track to ask.
        const track = document
          .querySelector<HTMLVideoElement>(`#${ELEMENT_ID} video`)
          ?.srcObject instanceof MediaStream
          ? (document.querySelector<HTMLVideoElement>(`#${ELEMENT_ID} video`)!
              .srcObject as MediaStream).getVideoTracks()[0]
          : null;

        if (track) {
          trackRef.current = track;
          const caps = track.getCapabilities?.() as { zoom?: ZoomRange } | undefined;
          if (caps?.zoom && caps.zoom.max > caps.zoom.min) {
            setZoomRange({
              min: caps.zoom.min,
              max: caps.zoom.max,
              step: caps.zoom.step || 0.1,
            });
            setZoom(caps.zoom.min);
          }
        }
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error && err.name === 'NotAllowedError'
            ? 'Izin kamera ditolak. Aktifkan izin kamera di pengaturan browser, atau tempelkan kode token di bawah.'
            : 'Kamera tidak dapat dibuka pada perangkat ini. Gunakan kolom kode token di bawah.'
        );
      }
    }

    start();

    // Lepaskan stream kamera saat keluar halaman; tanpa ini lampu kamera tetap
    // menyala dan perangkat menahan resource.
    //
    // Release the camera stream on unmount; without this the camera light stays
    // on and the device keeps holding the resource.
    return () => {
      cancelled = true;
      trackRef.current = null;
      scanner?.stop().then(() => scanner?.clear()).catch(() => {});
    };
  }, []);

  return (
    <>
      <div
        id={ELEMENT_ID}
        style={{
          width: '280px',
          height: '280px',
          maxWidth: '70vw',
          maxHeight: '70vw',
          borderRadius: '24px',
          overflow: 'hidden',
          backgroundColor: '#1a1a22',
        }}
      />
      {zoomRange && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '280px', maxWidth: '70vw' }}>
          <span style={{ fontSize: '11px', color: '#d4d4d8', flexShrink: 0 }}>Zoom</span>
          <input
            type="range"
            min={zoomRange.min}
            max={zoomRange.max}
            step={zoomRange.step}
            value={zoom}
            onChange={(e) => applyZoom(Number(e.target.value))}
            aria-label="Perbesar kamera"
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: '11px', color: '#d4d4d8', flexShrink: 0, minWidth: '34px', textAlign: 'right' }}>
            {zoom.toFixed(1)}x
          </span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            padding: '8px 12px',
            backgroundColor: 'rgba(212, 13, 21, 0.2)',
            color: '#ff6b6b',
            borderRadius: '6px',
            fontSize: '11px',
            maxWidth: '280px',
            textAlign: 'center',
          }}
        >
          {error}
        </div>
      )}
    </>
  );
}
