---
title: Privacy Policy
description: What the Wikae app, the website and Wikae's server collect, who processes it, how long it's kept and how to delete it.
last-updated: 2026-11-12
---

# Privacy Policy

Wikae is run by Sidali Djeghbal ("Wikae", "we"). Contact: contact@djeghbal.me.

The short version: the app is free, works without an account and sends us nothing. If you use Sync, your collection is encrypted on your device and we can't read it. We keep the minimum needed to run optional accounts, and we don't sell data, sell products, show ads or use analytics.

## 1. The app

The Wikae app stores your collection (decks, cards, reviews, media, settings) on your own device. It has no analytics, crash reporting or advertising, and it never sends your collection to us. It contacts these outside services only when you use the corresponding feature:

| When | The app contacts | What it sends |
|---|---|---|
| you open the Market or install a deck, card type or theme | GitHub (raw.githubusercontent.com, api.github.com) | a normal web request for the free public catalogue and its files |
| the desktop app is open (at most every 10 minutes), and when you install an update | GitHub (api.github.com, github.com) | a normal web request to check for a newer version |
| you turn on AI grading and answer an AI-graded card, ask for feedback, use Edit for me, or use Ask Wikae | the AI provider you set up (see below) | the card, your answer (including drawings and images), your message, any file you attach, and the parts of your collection Ask Wikae reads to do what you asked |
| you sign in to ChatGPT for AI features, and every few minutes while you're signed in | OpenAI | OpenAI's own sign-in, then a request for the list of models your plan offers; the sign-in token stays on your device |
| you use an optional account or Sync | our sync server (or the self-hosted server you configured) | see sections 3 to 5 |

**AI providers.** AI features are off until you add a key or sign in. You choose the provider: OpenRouter, OpenAI (through an API key or your ChatGPT sign-in), or any compatible server, including one on your own computer. OpenRouter passes each request on to the company that runs the model you picked. Content you send to an AI provider goes straight from your device to that provider, under your own account with it. Wikae never receives it. That provider's privacy policy applies.

**Card types.** Card types, including ones from the Market, run in a sandbox that can't reach the internet. They can only load files from Wikae itself.

## 2. The website

sidali-djeghbal.github.io/wikae is a static site hosted on GitHub Pages. It sets no cookies and runs no analytics. GitHub receives your IP address and browser details when you load it, as any web host does. While you read it, your browser also asks GitHub's API for the project's star count and loads the Market catalogue from GitHub ([GitHub's privacy statement](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement)). Links to external sites take you to those sites; the website doesn't embed trackers.

## 3. Accounts and Sync: what we collect

An account is optional and free. You need one only if you use cloud Sync (folder sync and offline study need no account).

| Data | Why | How long |
|---|---|---|
| Your email address | to sign you in (one-time sign-in codes) and send account security email | while your account exists |
| Devices: the name you give each one, how it signed in, when it was added, last used and last signed in | so you can see and revoke them | until you delete the account |
| Passkey public keys | to verify passkey sign-ins (we never get the private key) | until you remove the passkey or delete the account |
| Sign-in requests: your email address, IP address and time, with the code/link stored only as a hash | to make each code work once and limit abuse | deleted a day after the code expires (codes last 15 minutes) |
| Email change requests: old and new address, IP address and time, with the link stored only as a hash | to confirm the new address | deleted a day after the link expires |
| A security log of sign-ins and account events: account id, IP address, time, and for sign-in attempts a hash of the email address | to detect abuse and investigate incidents | 12 months, also after you delete your account |
| **Your encrypted collection** (encrypted changes, encrypted media and your wrapped keys), with its size, upload times and which of your devices uploaded each change | to sync your devices | until you delete your account |
| Emails you send to contact@djeghbal.me | to answer you | as long as needed to help you |

**What we can't see.** Sync encrypts your collection on your device with a key that only your devices hold. That key is protected by your Sync password, your recovery key or your passkey, and we never receive any of them. The server stores only ciphertext. We cannot read your decks, cards, answers, reviews, media or deck names, and we can't hand them to anyone, including in response to a legal demand. What the server can see is how much you store, how many changes you upload and when.

## 4. Who processes data for us

| Provider | What it does | Where |
|---|---|---|
| DigitalOcean | hosts the server, database and encrypted storage, and its backups | Canada / EU |
| Resend | sends sign-in and account email (your address and the message) | United States |
| GitHub | hosts the website, the public Market catalogue and app downloads | United States |

Each provider is bound by its contract with us to protect data and use it only to provide its service.

We don't sell or rent personal information, and we don't share it for advertising. We disclose it only to the providers above, when the law requires it, or to protect users and the service from fraud or abuse.

## 5. Deleting your data

- **Delete your account** in the app (Settings → Account → Delete account), or by writing to contact@djeghbal.me from the address on the account. Deleting immediately removes your email address, devices, passkeys, pending sign-in and email-change links, and your entire encrypted collection from the server. The security log keeps its rows until their 12 months are up.
- **Backups** of the server are encrypted and kept for at most 35 days, so deleted data is gone from them within 35 days.
- Deleting your account doesn't touch the collection on your devices. To remove that, uninstall the app, or on a computer delete the `.wikae` folder in your home folder.

## 6. Your rights

You can ask us to access, correct, export or delete your personal information, or ask questions about how we handle it, by writing to contact@djeghbal.me. We answer within 30 days. Once you're signed in you can also do most of it yourself: change your email, see and revoke devices, download a copy of your account data, and delete your account. Your collection lives on your devices, and you can export any deck as a pack at any time.

## 7. Security

Sync data is end-to-end encrypted. Sign-in codes and device tokens are stored only as hashes, and a device's sign-in expires after 90 days without use. Connections to our server use HTTPS. Access to the server is limited to Wikae's operator. If a breach puts your information at real risk, we'll tell you and the authorities the law requires us to tell.

## 8. Children

The online services are for people 13 and older. We don't knowingly collect information from younger children; if you believe a child under 13 has an account, write to us and we'll delete it.

## 9. Changes

If we change this policy in a way that matters, we'll email account holders before it takes effect and update the date above.
