"use client";

import { useEffect, useState } from "react";
import { api, fetchObjectUrl } from "@/lib/api";
import { initials } from "@/lib/format";

// Profile photos come from the API behind the login, so each one is fetched
// with the token once and kept as an object URL for the rest of the visit.
// The key includes photoUpdatedAt, so a changed photo is fetched again.
const cache = new Map<string, Promise<string | null>>();

function photoUrl(employeeId: string, updatedAt: string) {
  const key = `${employeeId}:${updatedAt}`;
  if (!cache.has(key)) {
    cache.set(
      key,
      fetchObjectUrl(`/employees/${employeeId}/photo`).catch(() => null),
    );
  }
  return cache.get(key)!;
}

export function usePhoto(employeeId: string | null | undefined, updatedAt: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setUrl(null);
    if (employeeId && updatedAt) photoUrl(employeeId, updatedAt).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [employeeId, updatedAt]);
  return url;
}

const TONES = ["#00b4a6", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#10b981", "#6366f1"];

// Round photo, or coloured initials when there's no photo.
export function PersonAvatar({
  person,
  photo,
  size = 32,
  className = "",
}: {
  person: { id?: string; firstName: string; lastName: string };
  photo?: { employeeId: string; updatedAt: string | null | undefined } | null;
  size?: number;
  className?: string;
}) {
  const url = usePhoto(photo?.employeeId, photo?.updatedAt);
  const key = person.id ?? `${person.firstName}${person.lastName}`;
  const tone = TONES[[...key].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length];
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={`flex-shrink-0 rounded-full object-cover ${className}`} style={{ width: size, height: size }} />;
  }
  return (
    <span
      aria-hidden
      className={`grid flex-shrink-0 place-items-center rounded-full font-semibold text-white ${className}`}
      style={{ width: size, height: size, backgroundColor: tone, fontSize: size * 0.34 }}
    >
      {initials(person)}
    </span>
  );
}

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

// Big photo with Change / Remove, for My Profile and HR's employee page.
export function PhotoEditor({
  employeeId,
  person,
  updatedAt,
  canEdit,
  onChange,
}: {
  employeeId: string;
  person: { firstName: string; lastName: string };
  updatedAt: string | null;
  canEdit: boolean;
  onChange: (updatedAt: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = `photo-${employeeId}`;

  async function upload(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > MAX_PHOTO_BYTES) {
      setError("That photo is bigger than 2 MB. Please pick a smaller one.");
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.append("photo", file);
      const res = await api<{ photoUpdatedAt: string }>("PUT", `/employees/${employeeId}/photo`, body);
      onChange(res.photoUpdatedAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not upload");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("Remove this photo?")) return;
    setBusy(true);
    setError(null);
    try {
      await api("DELETE", `/employees/${employeeId}/photo`);
      onChange(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <PersonAvatar person={{ id: employeeId, ...person }} photo={{ employeeId, updatedAt }} size={88} />
      {canEdit && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <input
              id={inputId}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                upload(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <label
              htmlFor={inputId}
              className="inline-flex cursor-pointer items-center rounded-xl bg-[#00857a] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#006e65]"
            >
              {busy ? "Saving…" : updatedAt ? "Change photo" : "Upload photo"}
            </label>
            {updatedAt && (
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="rounded-xl px-3 py-1.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-200 hover:bg-gray-50"
              >
                Remove
              </button>
            )}
          </div>
          <p className="text-[11px] text-gray-500">JPG, PNG or WebP, up to 2 MB.</p>
          {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
