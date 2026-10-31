import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime"
import { renderToStaticMarkup } from "react-dom/server"
import { NextIntlClientProvider } from "next-intl"
import assert from "node:assert/strict"
import { createElement } from "react"
import { test } from "node:test"
import { load } from "cheerio"

import { DemoNewMatch, DemoPlayerProfile, DemoPlayers } from "./native-examples"
import { walkthroughSteps } from "@/domain/onboarding/walkthrough"
import { WalkthroughContext } from "./walkthrough-context"
import { SectionExamples } from "./section-examples"
import { getDictionary } from "@/i18n/dictionaries"

const router = {
    back() {},
    forward() {},
    refresh() {},
    push() {},
    replace() {},
    prefetch() {},
    bfcacheId: "tour-test",
}
const shellSteps = new Set([
    "welcome",
    "workspace",
    "account",
    "finish",
    "players-nav",
])

test("tour spotlights resolve to the rendered example sections and actions for every role", () => {
    for (const kind of [
        "welcome",
        "manager",
        "competitions",
        "member",
        "competition-member",
    ] as const) {
        for (const step of walkthroughSteps(kind, false)) {
            if (shellSteps.has(step.id)) continue
            const limited =
                kind === "competitions" || kind === "competition-member"
            const canManage =
                kind === "manager" ||
                kind === "competitions" ||
                kind === "welcome"
            const props = {
                dictionary: getDictionary("en"),
                locale: "en" as const,
                serverId: "sample-clan",
            }
            const example =
                step.mock === "match"
                    ? createElement(DemoNewMatch, props)
                    : step.mock === "players"
                      ? createElement(DemoPlayers, props)
                      : step.mock === "profile"
                        ? createElement(DemoPlayerProfile, props)
                        : step.chapter !== "players" &&
                            step.chapter !== "performance"
                          ? createElement(SectionExamples, {
                                ...props,
                                chapter: step.chapter,
                                limited,
                                canManage,
                            })
                          : null
            const html = renderToStaticMarkup(
                // next-intl requires children in its props type when using createElement.
                // eslint-disable-next-line react/no-children-prop
                createElement(NextIntlClientProvider, {
                    locale: "en",
                    messages: getDictionary("en"),
                    timeZone: "UTC",
                    children: createElement(
                        AppRouterContext.Provider,
                        { value: router },
                        createElement(
                            WalkthroughContext.Provider,
                            {
                                value: {
                                    active: true,
                                    step,
                                    limited,
                                    canManage,
                                    phase: 6,
                                    exampleNow: Date.UTC(2030, 3, 12),
                                    next() {},
                                },
                            },
                            createElement(
                                "div",
                                { id: "onboarding-page" },
                                example
                            )
                        )
                    ),
                })
            )
            const $ = load(html)
            const target = $(step.selector)
            assert.ok(
                target.length > 0,
                `${kind}/${step.id}: missing ${step.selector}`
            )
            if (step.action === "advance") {
                assert.ok(
                    target.first().is("a, button"),
                    `${step.id}: actionable target`
                )
            } else {
                assert.equal(
                    target.length,
                    1,
                    `${kind}/${step.id}: unique section`
                )
                assert.ok(
                    !target.is(
                        'h1, input, button, a, [role="switch"], [role="radio"]'
                    ),
                    `${step.id}: spotlight includes context`
                )
            }
        }
    }
})
