# GitHub issue synchronization

This optional, installation-wide integration sends new bug reports to one repository. Use a **private repository**: report text and server context are copied verbatim. Reporter account IDs and attachment URLs are not copied. Review reports for sensitive content before enabling this integration.

## Setup

1. Enable Issues in the target repository. Under your GitHub account or organization **Settings → Developer settings → GitHub Apps**, select **New GitHub App**. Give it a name (for example, `Logi Reports`) and your Logi homepage URL.
2. Enable the app's webhook and enter `https://YOUR_LOGI_HOST/api/webhooks/github` as the webhook URL. Set a strong random webhook secret. Keep SSL verification enabled. No OAuth callback URL, client secret, user authorization, or device flow is needed.
3. Under **Repository permissions**, grant **Issues: Read and write**. Metadata read access is implicit; leave other permissions unset. Subscribe to **Issues** and **Issue comments**. Restrict installation to your own account if the app is only for you; an organization-owned app can be private and installed on that organization.
4. Create the app and copy its numeric **App ID** (not its client ID). Under **Private keys**, generate a private key and securely save the downloaded `.pem` file.
5. Select **Install App**, choose the account/organization that owns the repository, select **Only select repositories**, and select the target repository. Copy the numeric installation ID from its installation settings URL, for example `https://github.com/settings/installations/12345678` or the corresponding organization settings URL.
6. Configure these **Convex deployment environment** variables:

   | Variable | Value |
   | --- | --- |
   | `LOGI_GITHUB_REPOSITORY` | `OWNER/REPO` |
   | `LOGI_GITHUB_APP_ID` | Numeric App ID |
   | `LOGI_GITHUB_INSTALLATION_ID` | Numeric installation ID |
   | `LOGI_GITHUB_PRIVATE_KEY` | Entire downloaded RSA PEM, including BEGIN/END lines |

   All four are required together. Multiline PEM values and PEM with literal `\n` separators are accepted. Store the private key using your environment manager's secret input; never commit it or use a `NEXT_PUBLIC_` prefix. Leave all four unset to disable outbound synchronization. Logi signs a short-lived app JWT and automatically obtains and refreshes installation tokens scoped to Issues write access on the selected repository.
7. In the **Next.js host environment**, set `LOGI_GITHUB_REPOSITORY` and `LOGI_GITHUB_WEBHOOK_SECRET` to the repository and the app webhook's secret. Keep `INTERNAL_AUTH_SECRET` identical in Next.js and Convex as usual. The private key is needed only by Convex. Restart/redeploy the dashboard after changing its environment.
8. Deploy the Convex functions/schema and dashboard. Submit a test report, wait up to a minute, and reload the inbox to see its GitHub link. Resolve it in Logi and confirm the app bot closes it with a status comment. Reopen it in GitHub and reload Logi: the report should be New. Add a GitHub comment and confirm it appears in Logi. Inspect the app's **Advanced → Recent deliveries** for webhook diagnostics.

### Migrating from a personal token

Configure the app on the same repository; existing issue links remain valid. Remove `LOGI_GITHUB_TOKEN` from Convex (it is no longer used), verify app-based delivery, then revoke the old personal token. Remove the old repository webhook after enabling the app webhook to avoid duplicate deliveries. The app uses the same callback URL and supports the existing issue links and recovery markers.

### Key rotation

Generate another private key in the app settings, replace `LOGI_GITHUB_PRIVATE_KEY` in Convex, verify a successful sync, then delete the old key in GitHub. Installation tokens refresh automatically; the app private key must be rotated by the operator. Uninstalling or suspending the app stops API access and queued writes retain their retry behavior.

References: [registering a GitHub App](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app), [installation tokens](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app), [app webhooks](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/using-webhooks-with-github-apps).

## Behavior and operations

- New reports are queued transactionally. The Convex cron processes up to ten jobs each minute. Existing reports are not bulk-exported; changing an existing report's status queues it.
- New and Investigating map to an open issue; Resolved maps to closed. Dashboard status changes add a GitHub status comment. GitHub reopening maps Resolved to New, while an already open Investigating report retains its status.
- Webhooks update only already-linked reports; arbitrary GitHub issues never create Logi reports. GitHub title/body edits do not overwrite the original submitted report. Comments are a read-only mirror, not a second dashboard comment editor.
- Local pending changes take precedence over incoming GitHub state. Once delivered, subsequent GitHub close/reopen changes apply normally. The inbox is not live; reload to see inbound updates and delivery results.
- Sync errors appear in the inbox and retry automatically. An issue creation marker allows retry recovery after a lost response. Do not remove these HTML markers from issue descriptions or status comments. GitHub does not provide transactional exactly-once issue creation.
- Failed webhook deliveries return a non-success response. Inspect the GitHub App's Recent deliveries and manually redeliver after resolving outages; GitHub does not automatically retry failed deliveries. Deliveries fetch the current issue and comments, so redelivery is safe.
- Keep the repository setting stable once issues are linked. Changing it stops writes to old links with a visible error. Issue transfer/deletion and repository migration require operator intervention.
- Private reports remain excluded from clan `/api/v1` keys. This integration uses authenticated server-to-server operations and a signed GitHub callback, not clan API permissions.
