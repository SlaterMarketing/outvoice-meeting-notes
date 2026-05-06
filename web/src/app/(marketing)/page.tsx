import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import Link from "next/link";

export default async function LandingPage() {
  const s = await getSession();
  if (s) redirect("/dashboard");

  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="border-b border-[#1a1917]/10 px-5 pb-20 pt-16 md:px-8 md:pb-28 md:pt-24">
        <div className="mx-auto max-w-4xl">
          <p className="mb-6 text-center text-sm font-medium uppercase tracking-[0.2em] text-[#1a1917]/50">
            Meeting notes, without the busywork
          </p>
          <h1 className="font-display text-center text-[2.75rem] font-medium leading-[1.08] tracking-tight text-[#1a1917] sm:text-5xl md:text-6xl md:leading-[1.05]">
            Join the call.
            <br />
            <span className="text-[#1a1917]/72">Leave with clarity.</span>
          </h1>
          <p className="mx-auto mt-8 max-w-xl text-center text-lg leading-relaxed text-[#1a1917]/65 md:text-xl">
            Capture Meet, Zoom, and Teams in Chrome—then open a clean transcript, short notes,
            and follow-ups in your library.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-5">
            <Link
              href="/login"
              className="w-full rounded-full bg-[#1a1917] px-8 py-3.5 text-center text-sm font-semibold text-[#f7f5f2] transition hover:bg-[#2d2c29] sm:w-auto"
            >
              Start free
            </Link>
            <p className="text-center text-sm text-[#1a1917]/50 sm:text-left">
              Magic-link sign-in. No card for the basics.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-[#1a1917]/10 px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-6xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#c45c3e]">
            How it works
          </p>
          <h2 className="font-display max-w-2xl text-3xl font-medium tracking-tight text-[#1a1917] md:text-4xl">
            Show up. Speak. We handle the rewrite.
          </h2>
          <p className="mt-4 max-w-xl text-[#1a1917]/60">
            Built for people who live in the browser—one flow from tab audio to a page you can
            search later.
          </p>

          <div className="mt-16 grid gap-16 md:grid-cols-[1fr_1.1fr] md:gap-12 lg:gap-20">
            <ol className="space-y-12">
              <li className="flex gap-6 border-l-2 border-[#1a1917]/12 pl-6">
                <span className="font-display text-2xl font-medium tabular-nums text-[#1a1917]/35">
                  01
                </span>
                <div>
                  <h3 className="font-display text-xl font-medium text-[#1a1917]">Open the tab</h3>
                  <p className="mt-2 text-[#1a1917]/60">
                    Start capture from Google Meet, Zoom web, or Microsoft Teams in Chrome. Keep
                    the helper window open while you meet—you stay in control of start and stop.
                  </p>
                </div>
              </li>
              <li className="flex gap-6 border-l-2 border-[#1a1917]/12 pl-6">
                <span className="font-display text-2xl font-medium tabular-nums text-[#1a1917]/35">
                  02
                </span>
                <div>
                  <h3 className="font-display text-xl font-medium text-[#1a1917]">
                    Transcript → notes
                  </h3>
                  <p className="mt-2 text-[#1a1917]/60">
                    We turn raw audio into text, then shape it into skimmable notes and suggested
                    follow-ups—so you are not staring at a wall of transcript.
                  </p>
                </div>
              </li>
              <li className="flex gap-6 border-l-2 border-[#1a1917]/12 pl-6">
                <span className="font-display text-2xl font-medium tabular-nums text-[#1a1917]/35">
                  03
                </span>
                <div>
                  <h3 className="font-display text-xl font-medium text-[#1a1917]">
                    Send it forward
                  </h3>
                  <p className="mt-2 text-[#1a1917]/60">
                    Everything lands in your library: open, read, copy. Drop lines into email,
                    Slack, or your doc stack—little cleanup required.
                  </p>
                </div>
              </li>
            </ol>

            <div className="flex flex-col justify-center">
              <div className="rounded-2xl border border-[#1a1917]/12 bg-white/60 p-6 shadow-sm md:p-8">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#1a1917]/45">
                  Rough transcript
                </p>
                <p className="mt-3 border-l-2 border-[#c45c3e]/40 pl-4 text-sm italic leading-relaxed text-[#1a1917]/55">
                  &ldquo;so yeah um client loved the proposal we should kick off next week they want
                  the branding sprint first and social after can someone send the revised scope by
                  wednesday&rdquo;
                </p>
                <div className="my-8 h-px w-full bg-[#1a1917]/10" />
                <p className="text-xs font-semibold uppercase tracking-wider text-[#1a1917]/45">
                  In your library
                </p>
                <h4 className="font-display mt-3 text-lg font-medium text-[#1a1917]">
                  Client kickoff
                </h4>
                <ul className="mt-4 space-y-2 text-sm leading-relaxed text-[#1a1917]/75">
                  <li>— Client approved the proposal; target kickoff next week.</li>
                  <li>
                    — Prioritize branding sprint first, then social scope; revised scope needed by
                    Wednesday.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Who it’s for */}
      <section className="border-b border-[#1a1917]/10 px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-6xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#c45c3e]">
            Who it&apos;s for
          </p>
          <h2 className="font-display max-w-xl text-3xl font-medium tracking-tight text-[#1a1917] md:text-4xl">
            For people who talk faster than they type
          </h2>

          <div className="mt-14 divide-y divide-[#1a1917]/10 border-y border-[#1a1917]/10">
            {[
              {
                title: "Consultants & operators",
                body: "Back-to-back calls. Capture the decisions while memory is fresh—then share a tight recap.",
              },
              {
                title: "Sales & success",
                body: "Log what was promised, who owns it, and what happens next—without re-listening.",
              },
              {
                title: "Founders & hiring",
                body: "Investor updates, interviews, council meetings—one place for the narrative.",
              },
              {
                title: "Anyone on Meet, Zoom, or Teams web",
                body: "If your meeting runs in Chrome, you can route audio into notes you actually open later.",
              },
            ].map((row) => (
              <div
                key={row.title}
                className="grid gap-3 py-8 md:grid-cols-[minmax(0,240px)_1fr] md:gap-12 md:py-10"
              >
                <h3 className="font-display text-lg font-medium text-[#1a1917]">{row.title}</h3>
                <p className="text-[#1a1917]/62 leading-relaxed">{row.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#c45c3e]">
            Questions
          </p>
          <h2 className="font-display text-3xl font-medium tracking-tight text-[#1a1917] md:text-4xl">
            Common questions
          </h2>
          <dl className="mt-12 space-y-2">
            {[
              {
                q: "Do I install anything besides Chrome?",
                a: "You add a small capture helper for Chrome (load unpacked while you iterate). Your library runs in the browser.",
              },
              {
                q: "Does this work with desktop Zoom or Teams?",
                a: "The first version targets Meet, Zoom web, and Teams web in Chrome. Native desktop clients are not covered yet.",
              },
              {
                q: "Who is responsible for recording rules?",
                a: "You are. Only capture when your organization and everyone on the call agrees it is appropriate.",
              },
              {
                q: "Can I self-host?",
                a: "The project is open source: run your own instance and point the capture helper at your library URL.",
              },
            ].map((item) => (
              <div key={item.q} className="border-b border-[#1a1917]/10 py-6 first:pt-0">
                <dt className="font-medium text-[#1a1917]">{item.q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-[#1a1917]/62">{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="border-t border-[#1a1917]/10 bg-[#ede9e2]/80 px-5 py-20 md:px-8 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-medium tracking-tight text-[#1a1917] md:text-4xl">
            Hear it once. Keep it forever.
          </h2>
          <p className="mt-4 text-[#1a1917]/60">
            Sign in with email, connect capture from Settings, and ship your next meeting to the
            library.
          </p>
          <Link
            href="/login"
            className="mt-8 inline-flex rounded-full bg-[#1a1917] px-8 py-3.5 text-sm font-semibold text-[#f7f5f2] transition hover:bg-[#2d2c29]"
          >
            Get started
          </Link>
        </div>
      </section>
    </main>
  );
}
