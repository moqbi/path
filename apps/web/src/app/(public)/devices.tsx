import type { SiteKey } from "@/lib/site";

/*
  «الأجهزة المدعومة» (القاعدة ٤٦٨): آيفون قائماً ومُداراً، وآيباد، وآيفون القابل للطيّ —
  كلٌّ في إطاره برسمٍ من CSS، وما على شاشاته لقطاتٌ حقيقيّة من داخل التطبيق
  (`public/shots`) لا رسومٌ مصنوعة. والشاشةُ العريضة لوحتان كما يرسمها التطبيق
  (القاعدة ٤٦٤): القائمةُ في طرف البداية — يميناً — وما يُفتح منها بجانبها.
  النصوصُ من اللوحة (`devices.*` في `lib/site.ts`)، والرسومُ هنا (القاعدة ١١٠).
*/

type Text = Record<SiteKey, string>;

function Shot({ src, alt }: { src: string; alt: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/shots/${src}.webp`} alt={alt} loading="lazy" decoding="async" />;
}

/** لوحتان: القائمةُ يميناً بعرضها، واللوحةُ تملأ ما بقي. */
function Split({ list, pane, listShare, crease }: { list: string; pane: string; listShare: string; crease?: boolean }) {
  return (
    <div className={crease ? "d-screen d-split d-crease" : "d-screen d-split"}>
      <div style={{ flexBasis: listShare }}>
        <Shot src={list} alt="قائمة اللحظات" />
      </div>
      <div style={{ flex: 1 }}>
        <Shot src={pane} alt="ما يُفتح بجانبها" />
      </div>
    </div>
  );
}

export function Devices({ text }: { text: Text }) {
  return (
    <section id="devices" className="l-wide scroll-mt-20 pt-20">
      <div className="text-center">
        <span className="l-pill">{text["devices.badge"]}</span>
        <h2 className="l-title mt-3">{text["devices.title"]}</h2>
        <p className="l-sub mx-auto">{text["devices.sub"]}</p>
      </div>

      <div className="d-grid mt-10">
        <article className="d-card">
          <div className="d-stage" aria-hidden>
            <figure className="d-dev d-phone">
              <div className="d-screen">
                <Shot src="timeline" alt="" />
              </div>
            </figure>
            <figure className="d-dev d-phone-land">
              <Split list="timeline" pane="profile" listShare="46%" />
            </figure>
            <span className="d-tag d-tag-a">قائماً</span>
            <span className="d-tag d-tag-b">مُداراً</span>
          </div>
          <h3 className="d-name">{text["devices.iphone.title"]}</h3>
          <p className="d-body">{text["devices.iphone.body"]}</p>
        </article>

        <article className="d-card">
          <div className="d-stage" aria-hidden>
            <figure className="d-dev d-pad">
              <Split list="timeline" pane="circle" listShare="40%" />
            </figure>
          </div>
          <h3 className="d-name">{text["devices.ipad.title"]}</h3>
          <p className="d-body">{text["devices.ipad.body"]}</p>
        </article>

        <article className="d-card">
          <div className="d-stage" aria-hidden>
            <figure className="d-dev d-fold">
              <Split list="circle" pane="notes" listShare="50%" crease />
            </figure>
            <figure className="d-dev d-phone d-phone-folded">
              <div className="d-screen">
                <Shot src="hero" alt="" />
              </div>
            </figure>
            <span className="d-tag d-tag-c">مطويّاً</span>
            <span className="d-tag d-tag-d">مفتوحاً</span>
          </div>
          <h3 className="d-name">{text["devices.fold.title"]}</h3>
          <p className="d-body">{text["devices.fold.body"]}</p>
        </article>
      </div>

      <p className="mt-5 text-center text-[12.5px] text-muted">{text["devices.note"]}</p>
    </section>
  );
}
