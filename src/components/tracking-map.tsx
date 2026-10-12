"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";

// A map for field tracking: coloured dots (people, stops, visits) and an
// optional route line. OpenStreetMap tiles, no key needed. Leaflet needs the
// browser, so it's loaded on first render.

export interface MapDot {
  id: string;
  latitude: number;
  longitude: number;
  color: string;
  label?: string; // short text inside the dot, e.g. initials
  title: string; // shown on click
  size?: number;
  onClick?: () => void;
}

// Karachi, for an empty map.
const DEFAULT_CENTER: [number, number] = [24.8607, 67.0011];

export function TrackingMap({
  dots,
  line,
  height = 420,
  className,
}: {
  dots: MapDot[];
  line?: { latitude: number; longitude: number }[];
  height?: number;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const fitted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !box.current) return;
      if (!map.current) {
        map.current = L.map(box.current, { zoomControl: true, attributionControl: true }).setView(DEFAULT_CENTER, 11);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map.current);
        layer.current = L.layerGroup().addTo(map.current);
      }
      const group = layer.current!;
      group.clearLayers();

      const points: [number, number][] = [];
      if (line && line.length > 1) {
        const path = line.map((p) => [p.latitude, p.longitude] as [number, number]);
        L.polyline(path, { color: "#4f46e5", weight: 4, opacity: 0.75 }).addTo(group);
        points.push(...path);
      }
      for (const d of dots) {
        const size = d.size ?? 28;
        const icon = L.divIcon({
          className: "",
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
          html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${d.color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:#fff;font:600 ${Math.round(size / 2.6)}px/1 system-ui,sans-serif">${escapeHtml(d.label ?? "")}</div>`,
        });
        const marker = L.marker([d.latitude, d.longitude], { icon, title: d.title }).addTo(group);
        marker.bindTooltip(escapeHtml(d.title), { direction: "top", offset: [0, -size / 2] });
        if (d.onClick) marker.on("click", d.onClick);
        points.push([d.latitude, d.longitude]);
      }
      // Zoom to fit the first time there is something to show.
      if (!fitted.current && points.length) {
        if (points.length === 1) map.current.setView(points[0], 15);
        else map.current.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 16 });
        fitted.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dots, line]);

  useEffect(
    () => () => {
      map.current?.remove();
      map.current = null;
    },
    [],
  );

  return <div ref={box} className={className} style={{ height, width: "100%", borderRadius: 12, overflow: "hidden", zIndex: 0 }} />;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
