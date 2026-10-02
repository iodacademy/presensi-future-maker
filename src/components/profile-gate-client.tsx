'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ProfileGate } from './profile-gate';

/**
 * Pembungkus gerbang profil untuk dipakai dari layout server.
 *
 * Memuat ulang rutenya setelah profil tersimpan, bukan menyimpan keadaannya
 * sendiri: kelengkapan profil diperiksa di server, dan satu-satunya cara layout
 * itu memeriksanya kembali adalah dengan memuat ulang.
 *
 * A client wrapper for the profile gate, used from the server layout.
 *
 * It refreshes the route once the profile saves rather than holding its own
 * state: completeness is checked on the server, and refreshing is the only way
 * that layout checks it again.
 */
export function ProfileGateClient() {
  const router = useRouter();
  return <ProfileGate onDone={() => router.refresh()} />;
}
