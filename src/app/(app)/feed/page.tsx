"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Cake, Heart, ImagePlus, Megaphone, MessageCircle, Pin, PinOff, Send, Trash2, X } from "lucide-react";
import { api, fetchObjectUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatRelative, fullName } from "@/lib/format";
import type { FeedComment, FeedPage, FeedPost, Person } from "@/lib/types";
import { Alert, Button, Card, EmptyState, Modal, PageHeader, Spinner, Textarea, cx } from "@/components/ui";
import { PersonAvatar } from "@/components/photo";

// Company feed: everyone can post (text + up to 4 pictures), like and
// comment. HR can post pinned announcements and remove anything. Birthday
// posts appear by themselves on the day.

const MAX_PICTURES = 4;
const MAX_PICTURE_BYTES = 5 * 1024 * 1024;

export default function FeedPageRoute() {
  const [page, setPage] = useState<FeedPage | null>(null);
  const [more, setMore] = useState<FeedPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    try {
      const first = await api<FeedPage>("GET", "/feed");
      setPage(first);
      setMore([]);
      setCursor(first.nextCursor);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the feed");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const next = await api<FeedPage>("GET", `/feed?cursor=${cursor}`);
      setMore((m) => [...m, ...next.items]);
      setCursor(next.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load more");
    } finally {
      setLoadingMore(false);
    }
  }

  // Keep a like / comment count change local instead of reloading the feed.
  const update = (id: string, patch: Partial<FeedPost>) => {
    const apply = (list: FeedPost[]) => list.map((p) => (p.id === id ? { ...p, ...patch } : p));
    setPage((p) => p && { ...p, pinned: apply(p.pinned), items: apply(p.items) });
    setMore(apply);
  };

  const posts = [...(page?.items ?? []), ...more];

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Feed" description="News, photos and celebrations from around the company" />
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}
      {!page ? (
        !error && <Spinner />
      ) : (
        <div className="space-y-4">
          <Composer canAnnounce={page.canAnnounce} onPosted={load} />
          {page.pinned.length > 0 && (
            <section aria-label="Pinned" className="space-y-4">
              {page.pinned.map((p) => (
                <PostCard key={p.id} post={p} onChange={update} onRemoved={load} onPinChanged={load} />
              ))}
            </section>
          )}
          {posts.length === 0 && page.pinned.length === 0 ? (
            <Card>
              <EmptyState title="Nothing here yet" description="Be the first to share something with the team." />
            </Card>
          ) : (
            posts.map((p) => <PostCard key={p.id} post={p} onChange={update} onRemoved={load} onPinChanged={load} />)
          )}
          {cursor && (
            <div className="flex justify-center">
              <Button variant="secondary" loading={loadingMore} onClick={loadMore}>
                Show older posts
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Writing a post -------------------------------------------------------------

function Composer({ canAnnounce, onPosted }: { canAnnounce: boolean; onPosted: () => void }) {
  const { me } = useAuth();
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [announcement, setAnnouncement] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  function pick(list: FileList | null) {
    if (!list) return;
    const chosen = [...files, ...Array.from(list)];
    setError(null);
    if (chosen.length > MAX_PICTURES) setError(`You can add up to ${MAX_PICTURES} pictures.`);
    if (chosen.some((f) => f.size > MAX_PICTURE_BYTES)) {
      setError("Each picture can be at most 5 MB.");
      return;
    }
    setFiles(chosen.slice(0, MAX_PICTURES));
    if (fileInput.current) fileInput.current.value = "";
  }

  async function post(e: React.FormEvent) {
    e.preventDefault();
    setPosting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("body", body);
      if (announcement) {
        form.append("kind", "ANNOUNCEMENT");
        form.append("pin", "true");
      }
      files.forEach((f) => form.append("images", f));
      await api("POST", "/feed/posts", form);
      setBody("");
      setFiles([]);
      setAnnouncement(false);
      onPosted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post");
    } finally {
      setPosting(false);
    }
  }

  return (
    <Card>
      <form onSubmit={post} className="space-y-3">
        <div className="flex gap-3">
          <Avatar person={mePerson(me)} />
          <Textarea
            aria-label="Write a post"
            placeholder={`What's new, ${me?.user.firstName ?? ""}?`}
            value={body}
            maxLength={5000}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        {previews.length > 0 && (
          <div className="grid grid-cols-4 gap-2 pl-12">
            {previews.map((src, i) => (
              <div key={src} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Picture ${i + 1}`} className="aspect-square w-full rounded-lg object-cover" />
                <button
                  type="button"
                  aria-label={`Remove picture ${i + 1}`}
                  onClick={() => setFiles(files.filter((_, j) => j !== i))}
                  className="absolute right-1 top-1 rounded-full bg-slate-900/60 p-0.5 text-white"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        {error && <Alert>{error}</Alert>}
        <div className="flex flex-wrap items-center justify-between gap-2 pl-12">
          <div className="flex items-center gap-4">
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              id="feed-pictures"
              onChange={(e) => pick(e.target.files)}
            />
            <label
              htmlFor="feed-pictures"
              className={cx(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100",
                files.length >= MAX_PICTURES && "pointer-events-none opacity-50",
              )}
            >
              <ImagePlus className="size-4" /> Add pictures
            </label>
            {canAnnounce && (
              <label className="flex items-center gap-1.5 text-sm text-slate-600">
                <input type="checkbox" checked={announcement} onChange={(e) => setAnnouncement(e.target.checked)} />
                Announcement (pinned)
              </label>
            )}
          </div>
          <Button type="submit" loading={posting} disabled={!body.trim() && files.length === 0}>
            Post
          </Button>
        </div>
      </form>
    </Card>
  );
}

// --- One post -------------------------------------------------------------------

function PostCard({
  post,
  onChange,
  onRemoved,
  onPinChanged,
}: {
  post: FeedPost;
  onChange: (id: string, patch: Partial<FeedPost>) => void;
  onRemoved: () => void;
  onPinChanged: () => void;
}) {
  const { me } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [likers, setLikers] = useState<Person[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [liking, setLiking] = useState(false);

  async function toggleLike() {
    setLiking(true);
    // Show it straight away; the server's count replaces it.
    onChange(post.id, { likedByMe: !post.likedByMe, likeCount: post.likeCount + (post.likedByMe ? -1 : 1) });
    try {
      const res = await api<{ likedByMe: boolean; likeCount: number }>(
        post.likedByMe ? "DELETE" : "POST",
        `/feed/posts/${post.id}/like`,
      );
      onChange(post.id, res);
    } catch (e) {
      onChange(post.id, { likedByMe: post.likedByMe, likeCount: post.likeCount });
      setError(e instanceof Error ? e.message : "Could not like");
    } finally {
      setLiking(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete this post?")) return;
    try {
      await api("DELETE", `/feed/posts/${post.id}`);
      onRemoved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete");
    }
  }

  async function togglePin() {
    try {
      await api("PATCH", `/feed/posts/${post.id}`, { isPinned: !post.isPinned });
      onPinChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change");
    }
  }

  const isBirthday = post.kind === "BIRTHDAY";
  const isAnnouncement = post.kind === "ANNOUNCEMENT";

  return (
    <article
      aria-label={isBirthday ? `Birthday of ${fullName(post.subjectEmployee)}` : `Post by ${fullName(post.author)}`}
      className={cx(
        "rounded-xl bg-white shadow-sm ring-1",
        isAnnouncement ? "ring-amber-300" : isBirthday ? "ring-pink-200" : "ring-slate-200",
      )}
    >
      <div className="p-5">
        <header className="flex items-start gap-3">
          {isBirthday ? (
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-pink-100 text-pink-600">
              <Cake className="size-5" aria-hidden />
            </div>
          ) : (
            <Avatar person={post.author} />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">
              {isBirthday ? `It's ${post.subjectEmployee?.firstName ?? "someone"}'s birthday!` : fullName(post.author)}
            </p>
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
              <span>{formatRelative(post.createdAt)}</span>
              {isAnnouncement && (
                <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                  <Megaphone className="size-3.5" aria-hidden /> Announcement
                </span>
              )}
              {post.isPinned && (
                <span className="inline-flex items-center gap-1 text-slate-500">
                  <Pin className="size-3.5" aria-hidden /> Pinned
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {post.canPin && (
              <button
                type="button"
                onClick={togglePin}
                aria-label={post.isPinned ? "Unpin" : "Pin to top"}
                title={post.isPinned ? "Unpin" : "Pin to top"}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                {post.isPinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
              </button>
            )}
            {post.canDelete && (
              <button
                type="button"
                onClick={remove}
                aria-label="Delete post"
                title="Delete post"
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        </header>

        {post.body && <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-800">{post.body}</p>}
        {post.imageIds.length > 0 && <Pictures ids={post.imageIds} />}
        {error && (
          <div className="mt-3">
            <Alert>{error}</Alert>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 border-t border-slate-100 px-3 py-1.5">
        <button
          type="button"
          onClick={toggleLike}
          disabled={liking}
          aria-pressed={post.likedByMe}
          className={cx(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-slate-50",
            post.likedByMe ? "text-pink-600" : "text-slate-600",
          )}
        >
          <Heart className={cx("size-4", post.likedByMe && "fill-current")} aria-hidden />
          {post.likedByMe ? "Liked" : "Like"}
        </button>
        <button
          type="button"
          onClick={() => setShowComments((s) => !s)}
          aria-expanded={showComments}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <MessageCircle className="size-4" aria-hidden /> Comment
        </button>
        <div className="ml-auto flex items-center gap-3 pr-2 text-xs text-slate-500">
          {post.likeCount > 0 && (
            <button
              type="button"
              className="hover:underline"
              onClick={async () => setLikers(await api<Person[]>("GET", `/feed/posts/${post.id}/likes`))}
            >
              {post.likeCount} {post.likeCount === 1 ? "like" : "likes"}
            </button>
          )}
          {post.commentCount > 0 && (
            <button type="button" className="hover:underline" onClick={() => setShowComments(true)}>
              {post.commentCount} {post.commentCount === 1 ? "comment" : "comments"}
            </button>
          )}
        </div>
      </div>

      {showComments && (
        <Comments postId={post.id} onCount={(commentCount) => onChange(post.id, { commentCount })} myName={mePerson(me)} />
      )}

      <Modal open={likers !== null} onClose={() => setLikers(null)} title="Liked by">
        <ul className="space-y-3">
          {likers?.map((p) => (
            <li key={p.id} className="flex items-center gap-3 text-sm">
              <Avatar person={p} /> {fullName(p)}
            </li>
          ))}
        </ul>
      </Modal>
    </article>
  );
}

// Pictures load through the API (they're private to the company), so each
// one is fetched with the login token and shown from a temporary URL.
function Pictures({ ids }: { ids: string[] }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  // A like re-renders the post with a new (equal) array — only refetch when
  // the pictures themselves change.
  const key = ids.join(",");

  useEffect(() => {
    let cancelled = false;
    const made: string[] = [];
    key.split(",").forEach(async (id) => {
      try {
        const url = await fetchObjectUrl(`/feed/images/${id}`);
        made.push(url);
        if (!cancelled) setUrls((u) => ({ ...u, [id]: url }));
      } catch {
        // leave the grey placeholder
      }
    });
    return () => {
      cancelled = true;
      made.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [key]);

  return (
    <>
      <div className={cx("mt-3 grid gap-1.5 overflow-hidden rounded-lg", ids.length > 1 && "grid-cols-2")}>
        {ids.map((id, i) => (
          <button
            key={id}
            type="button"
            onClick={() => setOpen(id)}
            className={cx("block bg-slate-100", ids.length === 3 && i === 0 && "col-span-2")}
            aria-label={`Open picture ${i + 1}`}
          >
            {urls[id] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={urls[id]}
                alt=""
                className={cx("w-full object-cover", ids.length === 1 ? "max-h-[28rem]" : "aspect-square")}
              />
            ) : (
              <div className={cx("w-full", ids.length === 1 ? "h-64" : "aspect-square")} />
            )}
          </button>
        ))}
      </div>
      <Modal open={open !== null} onClose={() => setOpen(null)} title="Picture" wide>
        {open && urls[open] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={urls[open]} alt="" className="mx-auto max-h-[70vh] rounded-lg" />
        )}
      </Modal>
    </>
  );
}

function Comments({
  postId,
  onCount,
  myName,
}: {
  postId: string;
  onCount: (n: number) => void;
  myName: Person | { firstName: string; lastName: string } | null;
}) {
  const [comments, setComments] = useState<FeedComment[] | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<FeedComment[]>("GET", `/feed/posts/${postId}/comments`)
      .then(setComments)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load comments"));
  }, [postId]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const c = await api<FeedComment>("POST", `/feed/posts/${postId}/comments`, { body: text });
      const next = [...(comments ?? []), c];
      setComments(next);
      onCount(next.length);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not comment");
    } finally {
      setSending(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this comment?")) return;
    try {
      await api("DELETE", `/feed/comments/${id}`);
      const next = (comments ?? []).filter((c) => c.id !== id);
      setComments(next);
      onCount(next.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete");
    }
  }

  return (
    <div className="space-y-3 border-t border-slate-100 bg-slate-50/60 px-5 py-4">
      {error && <Alert>{error}</Alert>}
      {comments === null ? (
        !error && <p className="text-xs text-slate-500">Loading comments…</p>
      ) : (
        comments.map((c) => (
          <div key={c.id} className="group flex gap-2">
            <Avatar person={c.author} small />
            <div className="min-w-0 flex-1 rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
              <p className="text-xs">
                <span className="font-semibold text-slate-900">{fullName(c.author)}</span>{" "}
                <span className="text-slate-500">· {formatRelative(c.createdAt)}</span>
              </p>
              <p className="whitespace-pre-wrap break-words text-sm text-slate-800">{c.body}</p>
            </div>
            {c.canDelete && (
              <button
                type="button"
                onClick={() => remove(c.id)}
                aria-label="Delete comment"
                className="self-center rounded-md p-1 text-slate-400 hover:text-red-600"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        ))
      )}
      <form onSubmit={send} className="flex items-center gap-2">
        <Avatar person={myName} small />
        <input
          aria-label="Write a comment"
          placeholder="Write a comment…"
          value={text}
          maxLength={2000}
          onChange={(e) => setText(e.target.value)}
          className="block w-full rounded-full border-0 bg-white px-4 py-2 text-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-600"
        />
        <Button type="submit" size="sm" loading={sending} disabled={!text.trim()} aria-label="Send comment">
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}

// The signed-in person, with their photo when they have one.
function mePerson(me: ReturnType<typeof useAuth>["me"]): Person | null {
  if (!me) return null;
  const e = me.employee;
  return {
    id: me.user.id,
    firstName: me.user.firstName,
    lastName: me.user.lastName,
    photo: e?.photoUpdatedAt ? { employeeId: e.id, photoUpdatedAt: e.photoUpdatedAt } : null,
  };
}

function Avatar({ person, small }: { person: Person | { firstName: string; lastName: string } | null; small?: boolean }) {
  if (!person) return <PersonAvatar person={{ firstName: "?", lastName: "" }} size={small ? 28 : 36} />;
  const photo = "photo" in person && person.photo ? { employeeId: person.photo.employeeId, updatedAt: person.photo.photoUpdatedAt } : null;
  return <PersonAvatar person={person} photo={photo} size={small ? 28 : 36} />;
}
