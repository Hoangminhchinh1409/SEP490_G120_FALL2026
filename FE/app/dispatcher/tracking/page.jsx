"use client";
import dynamic from 'next/dynamic';

const TrackingMap = dynamic(() => import('../../../src/views/dispatcher/TrackingMap'), { ssr: false });

export default function Page() { return <TrackingMap />; }