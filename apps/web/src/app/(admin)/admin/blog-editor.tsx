"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { saveBlogPost, uploadBlogImage, setBlogCover, clearBlogCover, type AdminResult } from "@/app/actions";
import { BLOCK_LABEL, BLOG_CATEGORY_MAX, BLOG_EXCERPT_MAX, BLOG_TITLE_MAX, type Block, type BlockKind } from "@/lib/blog-blocks";
import { BlogBody } from "@/components/blog-body";
import { ImagePicker } from "@/components/image-picker";

const FIELD =
  "w-full rounded-xl border border-line bg-paper px-3 text-[13.5px] text-ink outline-none focus:border-clay";
const SOLID = { background: "var(--color-clay)", color: "var(--color-on-brand)" } as const;

/** الكتلُ التي تُضاف من شريط «أضف» — والصورةُ زرٌّ وحدها لأنّها ترفع ملفّاً. */
const ADDABLE: BlockKind[] = ["p", "h2", "h3", "ul", "ol", "quote", "tip", "hr"];
const TEXTUAL = new Set<BlockKind>(["p", "h2", "h3", "quote", "tip"]);

type Row = Block & { key: number };

function blank(t: BlockKind): Block {
  if (t === "ul" || t === "ol") return { t, items: [""] };
  if (t === "hr") return { t };
  if (t === "img") return { t, mediaId: "", caption: "" };
  return { t, text: "" } as Block;
}

/** يحوّل كتلةً إلى نوعٍ آخر ويحفظ نصّها حيث يمكن. */
function convert(block: Block, t: BlockKind): Block {
  const text =
    "text" in block ? block.text : "items" in block ? block.items.join("\n") : "";
  if (t === "ul" || t === "ol") return { t, items: text ? text.split("\n") : [""] };
  if (t === "hr" || t === "img") return blank(t);
  return { t, text } as Block;
}

/**
 * محرّرُ المقال (القاعدة ٤٩٠): كتلٌ تُضاف وتُرتَّب وتُحذف ويُبدَّل نوعُها، وشريطٌ للعريض والمائل
 * والرابط، وصورٌ تُرفع في مكانها، ومعاينةٌ بمكوّن الصفحة العامّة نفسه — فما يُرى هنا ما يُقرأ هناك.
 */
export function BlogEditor({
  post,
}: {
  post: {
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    category: string;
    published: boolean;
    coverMediaId: string | null;
    blocks: Block[];
  };
}) {
  const counter = useRef(0);
  const keyed = (block: Block): Row => ({ ...block, key: ++counter.current }) as Row;
  const [rows, setRows] = useState<Row[]>(() =>
    (post.blocks.length ? post.blocks : [blank("p")]).map(keyed),
  );
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const focused = useRef<{ el: HTMLTextAreaElement; key: number; item?: number } | null>(null);

  const [state, run, pending] = useActionState(
    (prev: AdminResult, form: FormData) => saveBlogPost(post.id, form),
    null,
  );
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!state?.ok) return;
    setToast(state.ok);
    const timer = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(timer);
  }, [state]);

  const blocks: Block[] = rows.map(({ key: _key, ...block }) => block as Block);

  const update = (key: number, next: Block) =>
    setRows((list) => list.map((row) => (row.key === key ? ({ ...next, key } as Row) : row)));
  const move = (key: number, by: number) =>
    setRows((list) => {
      const at = list.findIndex((row) => row.key === key);
      const to = at + by;
      if (at < 0 || to < 0 || to >= list.length) return list;
      const copy = [...list];
      [copy[at], copy[to]] = [copy[to], copy[at]];
      return copy;
    });
  const remove = (key: number) => setRows((list) => list.filter((row) => row.key !== key));
  const insertAfter = (key: number | null, block: Block) =>
    setRows((list) => {
      const row = keyed(block);
      if (key === null) return [...list, row];
      const at = list.findIndex((one) => one.key === key);
      return [...list.slice(0, at + 1), row, ...list.slice(at + 1)];
    });

  /** يلفّ المحدّدَ في آخر حقلٍ مُركَّز بعلامة: **عريض** و*مائل* و[رابط](…). */
  function wrap(kind: "b" | "i" | "a") {
    const target = focused.current;
    if (!target) return;
    const { el } = target;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const chosen = el.value.slice(start, end) || (kind === "a" ? "نصّ الرابط" : "نص");
    let piece = chosen;
    if (kind === "b") piece = `**${chosen}**`;
    if (kind === "i") piece = `*${chosen}*`;
    if (kind === "a") {
      const href = window.prompt?.("الرابط (https://… أو /صفحة)") ?? "";
      if (!href) return;
      piece = `[${chosen}](${href.trim()})`;
    }
    const value = el.value.slice(0, start) + piece + el.value.slice(end);
    const row = rows.find((one) => one.key === target.key);
    if (!row) return;
    if ("items" in row && target.item !== undefined) {
      const items = [...row.items];
      items[target.item] = value;
      update(row.key, { ...row, items } as Block);
    } else if ("text" in row) {
      update(row.key, { ...row, text: value } as Block);
    }
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + piece.length, start + piece.length);
    });
  }

  const remember = (key: number, item?: number) => (event: React.FocusEvent<HTMLTextAreaElement>) => {
    focused.current = { el: event.currentTarget, key, item };
  };

  return (
    <div className="flex flex-col gap-4">
      {/* الغلاف خارج النموذج: يُرفع ويُحفظ وحده في الحال. */}
      <div className="rounded-2xl border border-line bg-card p-3">
        <p className="mb-2 text-[12px] font-bold text-muted">صورة الغلاف — تظهر في البطاقة ورأس المقال</p>
        <div className="flex items-center gap-3">
          <div className="h-20 w-32 shrink-0 overflow-hidden rounded-xl bg-chip">
            {post.coverMediaId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/site-media/${post.coverMediaId}`} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="flex grow flex-col gap-2">
            <ImagePicker
              label="صورة الغلاف"
              maxSize={1600}
              onPicked={async (file, width, height) => {
                const data = new FormData();
                data.set("image", file);
                data.set("width", String(width));
                data.set("height", String(height));
                const result = await setBlogCover(post.id, data);
                return result?.error;
              }}
            >
              <span className="flex h-10 items-center justify-center rounded-xl border border-line text-[12.5px] font-semibold">
                {post.coverMediaId ? "غيّر الغلاف" : "ارفع الغلاف"}
              </span>
            </ImagePicker>
            {post.coverMediaId ? (
              <button
                type="button"
                onClick={() => void clearBlogCover(post.id)}
                className="h-9 rounded-xl text-[12px] font-semibold"
                style={{ color: "var(--color-live)" }}
              >
                أزل الغلاف
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <form action={run} className="flex flex-col gap-3">
        <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />
        <label className="text-[11.5px] text-muted">
          العنوان
          <input name="title" defaultValue={post.title} maxLength={BLOG_TITLE_MAX} required className={`mt-1 h-11 ${FIELD} text-[15px] font-bold`} />
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="text-[11.5px] text-muted">
            رابط المقال (atharmts.com/blog/…)
            <input name="slug" dir="auto" defaultValue={post.slug.startsWith("draft-") ? "" : post.slug} placeholder="يُشتقّ من العنوان" className={`mt-1 h-10 ${FIELD}`} />
          </label>
          <label className="text-[11.5px] text-muted">
            التصنيف — يجمع المقالات المشابهة
            <input name="category" defaultValue={post.category} maxLength={BLOG_CATEGORY_MAX} placeholder="مثلاً: البداية" className={`mt-1 h-10 ${FIELD}`} />
          </label>
        </div>
        <label className="text-[11.5px] text-muted">
          الملخّص — سطران في البطاقة ومعاينة الروابط
          <textarea name="excerpt" defaultValue={post.excerpt} maxLength={BLOG_EXCERPT_MAX} rows={2} className={`mt-1 py-2 ${FIELD}`} />
        </label>

        {/* شريطُ الأدوات: ثابتٌ في أعلى المتن وهو يُمرَّر. */}
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1.5 rounded-xl border border-line bg-card p-1.5">
          <ToolButton onClick={() => wrap("b")} label="عريض"><b>ع</b></ToolButton>
          <ToolButton onClick={() => wrap("i")} label="مائل"><i>م</i></ToolButton>
          <ToolButton onClick={() => wrap("a")} label="رابط">🔗</ToolButton>
          <span className="mx-1 h-6 w-px bg-line" />
          <button
            type="button"
            onClick={() => setPreview((one) => !one)}
            className="h-8 rounded-lg px-3 text-[12px] font-bold"
            style={preview ? SOLID : undefined}
          >
            {preview ? "عودة للتحرير" : "معاينة"}
          </button>
          <span className="grow" />
          <span className="text-[11px] text-faint">{rows.length} كتلة</span>
        </div>

        {preview ? (
          <div className="rounded-2xl border border-line bg-paper p-4">
            <BlogBody blocks={blocks} />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((row, index) => (
              <div key={row.key} className="group rounded-xl border border-line bg-card p-2">
                <div className="mb-1.5 flex items-center gap-1">
                  <select
                    value={row.t}
                    onChange={(event) => update(row.key, convert(row, event.target.value as BlockKind))}
                    disabled={row.t === "img"}
                    className="h-7 rounded-lg border border-line bg-paper px-1.5 text-[11.5px]"
                  >
                    {(row.t === "img" ? (["img"] as BlockKind[]) : ADDABLE).map((t) => (
                      <option key={t} value={t}>{BLOCK_LABEL[t]}</option>
                    ))}
                  </select>
                  <span className="grow" />
                  <IconButton label="أعلى" disabled={index === 0} onClick={() => move(row.key, -1)}>↑</IconButton>
                  <IconButton label="أسفل" disabled={index === rows.length - 1} onClick={() => move(row.key, 1)}>↓</IconButton>
                  <IconButton label="فقرة بعدها" onClick={() => insertAfter(row.key, blank("p"))}>＋</IconButton>
                  <IconButton label="احذف" danger onClick={() => remove(row.key)}>×</IconButton>
                </div>
                <BlockInput row={row} update={update} remember={remember} />
              </div>
            ))}
          </div>
        )}

        {!preview ? (
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-dashed border-line p-2">
            <span className="text-[11.5px] font-bold text-muted">أضف:</span>
            {ADDABLE.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => insertAfter(null, blank(t))}
                className="h-8 rounded-lg border border-line bg-card px-2.5 text-[12px]"
              >
                {BLOCK_LABEL[t]}
              </button>
            ))}
            <ImagePicker
              label="صورة في المقال"
              maxSize={1600}
              onError={setError}
              onPicked={async (file, width, height) => {
                const data = new FormData();
                data.set("image", file);
                data.set("width", String(width));
                data.set("height", String(height));
                const result = await uploadBlogImage(post.id, data);
                if (result.error || !result.mediaId) return result.error ?? "تعذّر رفع الصورة";
                insertAfter(null, { t: "img", mediaId: result.mediaId, caption: "" });
              }}
            >
              <span className="flex h-8 items-center rounded-lg border border-line bg-card px-2.5 text-[12px]">
                {BLOCK_LABEL.img}
              </span>
            </ImagePicker>
          </div>
        ) : null}
        {error ? <p className="text-[12px]" style={{ color: "var(--color-live)" }}>{error}</p> : null}

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-card p-3">
          <label className="flex items-center gap-2 text-[13px] font-semibold">
            <input type="checkbox" name="published" defaultChecked={post.published} className="h-4 w-4 accent-[var(--color-clay)]" />
            منشور في المدونة
          </label>
          <span className="grow" />
          {state?.error ? <span className="text-[12px]" style={{ color: "var(--color-live)" }}>{state.error}</span> : null}
          <button type="submit" disabled={pending} className="h-11 rounded-xl px-6 text-[13px] font-bold" style={SOLID}>
            {pending ? "يُحفظ…" : "احفظ"}
          </button>
        </div>
      </form>

      {toast ? (
        <p
          role="status"
          className="fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-full px-5 py-2.5 text-[13px] font-semibold shadow-lg"
          style={{ background: "var(--color-chrome, #0E1A24)", color: "#fff" }}
        >
          {toast} ✓
        </p>
      ) : null}
    </div>
  );
}

function BlockInput({
  row,
  update,
  remember,
}: {
  row: Row;
  update: (key: number, next: Block) => void;
  remember: (key: number, item?: number) => (event: React.FocusEvent<HTMLTextAreaElement>) => void;
}) {
  if (row.t === "hr") return <hr className="my-2 border-line" />;
  if (row.t === "img") {
    return (
      <div className="flex flex-col gap-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/site-media/${row.mediaId}`} alt="" className="max-h-56 w-full rounded-lg object-contain" />
        <input
          value={row.caption}
          onChange={(event) => update(row.key, { ...row, caption: event.target.value })}
          maxLength={300}
          placeholder="تعليقٌ تحت الصورة (اختياريّ)"
          className={`h-9 ${FIELD} text-[12.5px]`}
        />
      </div>
    );
  }
  if (row.t === "ul" || row.t === "ol") {
    const items = row.items;
    return (
      <div className="flex flex-col gap-1">
        {items.map((item, at) => (
          <div key={at} className="flex items-start gap-1.5">
            <span className="mt-2 w-5 shrink-0 text-center text-[12px] text-faint">{row.t === "ol" ? at + 1 : "•"}</span>
            <AutoArea
              value={item}
              onFocus={remember(row.key, at)}
              onChange={(value) => {
                const next = [...items];
                next[at] = value;
                update(row.key, { ...row, items: next });
              }}
              onEnter={() => {
                const next = [...items];
                next.splice(at + 1, 0, "");
                update(row.key, { ...row, items: next });
              }}
              className="text-[13.5px]"
            />
            <button
              type="button"
              aria-label="احذف البند"
              disabled={items.length === 1}
              onClick={() => update(row.key, { ...row, items: items.filter((_, i) => i !== at) })}
              className="mt-1.5 h-7 w-7 shrink-0 rounded-lg text-faint disabled:opacity-30"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => update(row.key, { ...row, items: [...items, ""] })}
          className="self-start px-6 text-[11.5px] font-semibold text-muted"
        >
          ＋ بند
        </button>
      </div>
    );
  }
  const big = row.t === "h2" ? "text-[17px] font-bold" : row.t === "h3" ? "text-[15px] font-bold" : "text-[13.5px]";
  return (
    <AutoArea
      value={row.text}
      onFocus={remember(row.key)}
      onChange={(value) => update(row.key, { ...row, text: row.t === "h2" || row.t === "h3" ? value.replace(/\n/g, " ") : value } as Block)}
      placeholder={TEXTUAL.has(row.t) ? `${BLOCK_LABEL[row.t]}…` : undefined}
      className={big}
    />
  );
}

/** حقلٌ يطول مع ما يُكتب فيه — المقالُ لا يُكتب في صندوقٍ بثلاثة أسطر. */
function AutoArea({
  value,
  onChange,
  onFocus,
  onEnter,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onFocus: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
  onEnter?: () => void;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      dir="auto"
      rows={1}
      value={value}
      placeholder={placeholder}
      onFocus={onFocus}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (onEnter && event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          onEnter();
        }
      }}
      className={`w-full resize-none rounded-lg border border-transparent bg-paper px-2.5 py-1.5 leading-[1.75] text-ink outline-none focus:border-clay ${className ?? ""}`}
    />
  );
}

function ToolButton({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      // لا يأخذ التركيزَ من الحقل: التحديدُ يبقى ليُلفّ.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-paper text-[13px]"
    >
      {children}
    </button>
  );
}

function IconButton({
  onClick,
  label,
  disabled,
  danger,
  children,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-lg text-[14px] text-muted disabled:opacity-30"
      style={danger ? { color: "var(--color-live)" } : undefined}
    >
      {children}
    </button>
  );
}
