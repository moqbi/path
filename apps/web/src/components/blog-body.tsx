import { Fragment } from "react";
import { parseInline, type Block } from "@/lib/blog-blocks";

/**
 * يرسم متنَ المقال من كتله (القاعدة ٤٩٠) — في الصفحة العامّة وفي معاينة المحرّر سواء،
 * فما يراه الكاتبُ قبل النشر هو ما يقرؤه الناس.
 */
export function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((one, index) => {
        if (one.k === "b") return <strong key={index}>{one.v}</strong>;
        if (one.k === "i") return <em key={index}>{one.v}</em>;
        if (one.k === "a") {
          const outside = /^https?:/i.test(one.href);
          return (
            <a
              key={index}
              href={one.href}
              {...(outside ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}
            >
              {one.v}
            </a>
          );
        }
        return (
          <Fragment key={index}>
            {one.v.split("\n").map((line, at) => (
              <Fragment key={at}>
                {at > 0 ? <br /> : null}
                {line}
              </Fragment>
            ))}
          </Fragment>
        );
      })}
    </>
  );
}

export function BlogBody({ blocks }: { blocks: Block[] }) {
  return (
    <div className="blog-body">
      {blocks.map((block, index) => {
        switch (block.t) {
          case "p":
            return block.text.trim() ? (
              <p key={index} dir="auto">
                <Inline text={block.text} />
              </p>
            ) : null;
          case "h2":
            return !block.text.trim() ? null : (
              <h2 key={index} id={`s-${index}`} dir="auto">
                {block.text}
              </h2>
            );
          case "h3":
            return !block.text.trim() ? null : (
              <h3 key={index} dir="auto">
                {block.text}
              </h3>
            );
          case "quote":
            return (
              <blockquote key={index} dir="auto">
                <Inline text={block.text} />
              </blockquote>
            );
          case "tip":
            return (
              <aside key={index} className="blog-tip" dir="auto">
                <span aria-hidden className="blog-tip-mark">✦</span>
                <span>
                  <Inline text={block.text} />
                </span>
              </aside>
            );
          case "ul":
          case "ol": {
            const List = block.t === "ul" ? "ul" : "ol";
            return (
              <List key={index} dir="auto">
                {block.items.filter((item) => item.trim()).map((item, at) => (
                  <li key={at}>
                    <Inline text={item} />
                  </li>
                ))}
              </List>
            );
          }
          case "img":
            return (
              <figure key={index}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/site-media/${block.mediaId}`} alt={block.caption} loading="lazy" />
                {block.caption ? <figcaption dir="auto">{block.caption}</figcaption> : null}
              </figure>
            );
          case "hr":
            return <hr key={index} />;
        }
      })}
    </div>
  );
}
